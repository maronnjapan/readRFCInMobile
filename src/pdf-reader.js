// PDF の読み込み (pdf.js の遅延読み込み)、解析、図の切り出し描画、端末内への保存 (IndexedDB)。ブラウザ専用。
import { extractPdf } from './pdf-extract.js';
import { layoutPdf } from './pdf-layout.js';

const PDFJS_VERSION = '6.4.299';
// CJK の CMap や標準フォントなど、必要になったときだけ取得するデータ
const PDFJS_CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}`;

let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('../vendor/pdfjs/pdf.min.mjs').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
      return lib;
    });
    pdfjsPromise.catch(() => {
      pdfjsPromise = null;
    });
  }
  return pdfjsPromise;
}

// arXiv の ID や abs ページの URL は PDF の URL に直す
export function normalizePdfInput(input) {
  const s = String(input || '').trim();
  let m;
  if ((m = /^(?:arxiv:\s*)?(\d{4}\.\d{4,5}(?:v\d+)?)$/i.exec(s))) return `https://arxiv.org/pdf/${m[1]}`;
  if ((m = /^(?:arxiv:\s*)?([a-z-]+(?:\.[A-Z]{2})?\/\d{7}(?:v\d+)?)$/i.exec(s))) return `https://arxiv.org/pdf/${m[1]}`;
  if ((m = /^https?:\/\/(?:www\.|export\.)?arxiv\.org\/(?:abs|pdf|html)\/([^?#]+?)(?:\.pdf)?(?:[?#].*)?$/i.exec(s))) return `https://arxiv.org/pdf/${m[1]}`;
  return s;
}

// PDF を解析して、render.js で表示できる文書構造にする
export async function openPdf(bytes, { onProgress } = {}) {
  const lib = await loadPdfjs();
  const task = lib.getDocument({
    // pdf.js は渡したバッファをワーカーへ移して使えなくするので、複製を渡す
    data: bytes.slice(0),
    cMapUrl: `${PDFJS_CDN}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${PDFJS_CDN}/standard_fonts/`,
    wasmUrl: `${PDFJS_CDN}/wasm/`,
    verbosity: 0,
  });
  const pdf = await task.promise;
  const data = await extractPdf(pdf, { onPage: (i, n) => onProgress?.(i, n) });
  const chars = data.pages.reduce((a, p) => a + p.items.reduce((b, it) => b + it.s.length, 0), 0);
  if (chars < data.numPages * 20) {
    await task.destroy();
    const err = new Error('この PDF には文字の情報がほとんどありません (スキャンした画像の PDF かもしれません)。');
    err.noText = true;
    throw err;
  }
  const doc = layoutPdf(data);
  return { pdf, doc, destroy: () => task.destroy() };
}

// 図・表・数式の領域を、画面に近づいたときにページから切り出して描く
export function renderRegions(container, pdf) {
  const els = [...container.querySelectorAll('.pdf-region[data-region]')];
  if (!els.length) return () => {};
  let alive = true;
  const draw = async (el) => {
    if (el.dataset.drawn) return;
    el.dataset.drawn = '1';
    try {
      const page = await pdf.getPage(Number(el.dataset.page) + 1);
      const [x0, y0, x1, y1] = el.dataset.region.split(',').map(Number);
      const cssW = el.clientWidth || 360;
      const dpr = window.devicePixelRatio || 1;
      // 拡大表示 (タップ) しても読めるよう、表示幅の 2 倍程度の解像度で描く
      const scale = Math.min(5, Math.max(1.5, ((cssW * 2) / (x1 - x0)) * Math.min(dpr, 2)));
      const vp = page.getViewport({ scale, offsetX: -x0 * scale, offsetY: -y0 * scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil((x1 - x0) * scale);
      canvas.height = Math.ceil((y1 - y0) * scale);
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: vp, background: '#ffffff' }).promise;
      if (!alive) return;
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!alive || !blob) return;
      const img = new Image();
      img.alt = el.getAttribute('aria-label') || '';
      img.decoding = 'async';
      img.src = URL.createObjectURL(blob);
      el.replaceChildren(img);
      el.classList.add('drawn');
    } catch (e) {
      el.classList.add('failed');
      el.textContent = '図を描画できませんでした';
      console.error(e);
    }
  };
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              io.unobserve(en.target);
              draw(en.target);
            }
          });
        },
        { rootMargin: '800px 0px' },
      )
    : null;
  els.forEach((el) => (io ? io.observe(el) : draw(el)));
  const onClick = (e) => {
    const r = e.target.closest('.pdf-region.drawn');
    if (r) r.classList.toggle('zoom');
  };
  container.addEventListener('click', onClick);
  return () => {
    alive = false;
    io?.disconnect();
    container.removeEventListener('click', onClick);
    container.querySelectorAll('.pdf-region img').forEach((img) => URL.revokeObjectURL(img.src));
  };
}

// ---------- 端末内の保存 (IndexedDB) ----------
// ファイルとして開いた PDF や URL から取得した PDF を保存し、履歴から開き直せるようにする

const DB_NAME = 'rfcreader';
const STORE = 'pdfs';
const MAX_PDFS = 12;

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB を使えません'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const store = t.objectStore(STORE);
      let result;
      Promise.resolve(fn(store)).then((r) => {
        result = r;
      });
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

const reqP = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export const pdfStore = {
  async get(key) {
    try {
      return await tx('readonly', (s) => reqP(s.get(key)));
    } catch {
      return null;
    }
  },
  async put(rec) {
    try {
      await tx('readwrite', (s) => reqP(s.put({ ...rec, t: Date.now() })));
      // 古いものから消して件数を抑える
      const all = await tx('readonly', (s) => reqP(s.getAll()));
      const old = all.sort((a, b) => b.t - a.t).slice(MAX_PDFS);
      if (old.length) await tx('readwrite', (s) => Promise.all(old.map((r) => reqP(s.delete(r.key)))));
    } catch {
      /* 保存できなくても表示は続ける */
    }
  },
  async touch(key, patch = {}) {
    try {
      const rec = await this.get(key);
      if (rec) await tx('readwrite', (s) => reqP(s.put({ ...rec, ...patch, t: Date.now() })));
    } catch {
      /* ignore */
    }
  },
  async clear() {
    try {
      await tx('readwrite', (s) => reqP(s.clear()));
    } catch {
      /* ignore */
    }
  },
};

// ファイルの内容から履歴用のキーを作る
export async function fileKey(bytes, file) {
  try {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return `local:${[...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    let h = 0;
    const view = new Uint8Array(bytes);
    for (let i = 0; i < view.length; i += 97) h = (h * 31 + view[i]) >>> 0;
    return `local:${(file?.size || view.length).toString(16)}${h.toString(16)}`;
  }
}
