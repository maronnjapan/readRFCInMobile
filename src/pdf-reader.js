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

// 解析結果の題名と取得元を、表示用に補う (題名が取れなければファイル名にする)。翻訳ファイルのひな形も同じ題名を使う
export function completePdfMeta(doc, { name = '', url = '' } = {}) {
  if (url) doc.meta.source = new URL(url).hostname;
  if (!doc.meta.title) doc.meta.title = name.replace(/\.pdf$/i, '');
  return doc;
}

// PDF の中身の SHA-256 (16 進)。日本語訳のファイル名 (先頭 16 文字) に使う。計算できない環境では空文字
export async function sha256Hex(bytes) {
  try {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
}

// ページの一部 (図・表・数式) を切り出して画像にし、その object URL を返す
async function drawRegion(pdf, el) {
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
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp, background: '#ffffff' }).promise;
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return blob ? URL.createObjectURL(blob) : null;
}

// 図・表・数式の領域を、画面に近づいたときにページから切り出して描く。
// 原文と日本語訳を切り替えて描き直しても、同じ領域の画像は使い回す
export function createRegionRenderer(pdf) {
  const images = new Map(); // "ページ|領域" → Promise<object URL | null>
  let detach = null;
  const image = (el) => {
    const key = `${el.dataset.page}|${el.dataset.region}`;
    if (!images.has(key)) {
      images.set(
        key,
        drawRegion(pdf, el).catch((e) => {
          console.error(e);
          return null;
        }),
      );
    }
    return images.get(key);
  };
  const attach = (container) => {
    detach?.();
    const els = [...container.querySelectorAll('.pdf-region[data-region]')];
    let alive = true;
    const show = async (el) => {
      if (el.dataset.drawn) return;
      el.dataset.drawn = '1';
      const url = await image(el);
      if (!alive) return;
      if (!url) {
        el.classList.add('failed');
        el.textContent = '図を描画できませんでした';
        return;
      }
      const img = new Image();
      img.alt = el.getAttribute('aria-label') || '';
      img.decoding = 'async';
      img.src = url;
      el.replaceChildren(img);
      el.classList.add('drawn');
    };
    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((en) => {
              if (en.isIntersecting) {
                io.unobserve(en.target);
                show(en.target);
              }
            });
          },
          { rootMargin: '800px 0px' },
        )
      : null;
    els.forEach((el) => (io ? io.observe(el) : show(el)));
    const onClick = (e) => {
      const r = e.target.closest('.pdf-region.drawn');
      if (r) r.classList.toggle('zoom');
    };
    container.addEventListener('click', onClick);
    detach = () => {
      alive = false;
      io?.disconnect();
      container.removeEventListener('click', onClick);
    };
  };
  const destroy = () => {
    detach?.();
    detach = null;
    for (const p of images.values()) p.then((url) => url && URL.revokeObjectURL(url));
    images.clear();
  };
  return { attach, destroy };
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

// ファイルの内容から履歴用のキーを作る (SHA-256 の先頭 16 文字。日本語訳のファイル名と同じ)
export async function fileKey(bytes, file) {
  const hex = await sha256Hex(bytes);
  if (hex) return `local:${hex.slice(0, 16)}`;
  let h = 0;
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 97) h = (h * 31 + view[i]) >>> 0;
  return `local:${(file?.size || view.length).toString(16)}${h.toString(16)}`;
}
