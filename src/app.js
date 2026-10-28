import { parseRfc } from './rfc-parser.js';
import { renderDocument } from './render.js';

const SETTINGS_KEY = 'rfcreader:settings';
const RECENT_KEY = 'rfcreader:recent';
const POS_PREFIX = 'rfcreader:pos:';
const MAX_RECENT = 20;

// ---------- GitHub への保存 (Issue 経由) ----------
// <meta name="github-repo"> か、github.io の URL から owner/repo を決める。
function detectRepo() {
  const meta = (document.querySelector('meta[name="github-repo"]')?.content || '').trim();
  if (/^[\w.-]+\/[\w.-]+$/.test(meta)) return meta;
  const m = /^([\w-]+)\.github\.io$/i.exec(location.hostname);
  if (!m) return '';
  const seg = location.pathname.split('/').filter(Boolean)[0];
  return seg ? `${m[1]}/${seg}` : '';
}
const REPO = detectRepo();
function issueUrl(title, body) {
  return `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
function saveIssueUrl(n) {
  return issueUrl(
    `save rfc ${n}`,
    `このまま「Submit new issue」を押すと、GitHub Actions が RFC ${n} の本文を rfc-editor.org から取得して \`rfcs/rfc${n}.txt\` に保存し、サイトを再デプロイします。完了するとこの Issue は自動で閉じられます。`,
  );
}
const $ = (sel) => document.querySelector(sel);
const els = {
  home: $('#home'),
  doc: $('#doc'),
  status: $('#status'),
  barTitle: $('#bar-title'),
  btnHome: $('#btn-home'),
  btnToc: $('#btn-toc'),
  btnSettings: $('#btn-settings'),
  progress: $('#progress'),
  fab: $('#fab-top'),
  tocDrawer: $('#toc-drawer'),
  tocBody: $('#toc-body'),
  settingsDrawer: $('#settings-drawer'),
  form: $('#rfc-form'),
  input: $('#rfc-input'),
  recentWrap: $('#home-recent'),
  recentList: $('#recent-list'),
  storedWrap: $('#home-stored'),
  storedList: $('#stored-list'),
  fsOut: $('#fs-out'),
  sourceInput: $('#source-input'),
};

// ---------- 設定 ----------
const defaults = { fs: 17, theme: 'system', wrap: true, source: '' };
let settings = { ...defaults };
try {
  settings = { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
} catch {
  /* ignore */
}
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
function applySettings() {
  const root = document.documentElement;
  root.style.setProperty('--fs', `${settings.fs}px`);
  if (settings.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
  if (settings.wrap) root.dataset.wrap = 'on';
  else delete root.dataset.wrap;
  els.fsOut.textContent = `${settings.fs}px`;
  document.querySelectorAll('#theme-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === settings.theme)));
  document.querySelectorAll('#wrap-seg button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.wrap === 'on') === settings.wrap)));
  els.sourceInput.value = settings.source || '';
}

$('#fs-dec').addEventListener('click', () => {
  settings.fs = Math.max(13, settings.fs - 1);
  saveSettings();
  applySettings();
});
$('#fs-inc').addEventListener('click', () => {
  settings.fs = Math.min(26, settings.fs + 1);
  saveSettings();
  applySettings();
});
$('#theme-seg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  settings.theme = b.dataset.theme;
  saveSettings();
  applySettings();
});
$('#wrap-seg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  settings.wrap = b.dataset.wrap === 'on';
  saveSettings();
  applySettings();
});
els.sourceInput.addEventListener('change', () => {
  settings.source = els.sourceInput.value.trim();
  saveSettings();
});
// 消すのはブラウザ側のキャッシュと履歴だけ。GitHub (rfcs/) に保存した RFC テキストは残し、引き続き表示する
$('#clear-cache').addEventListener('click', async () => {
  if (!window.confirm('ブラウザのキャッシュと最近読んだ履歴を削除します。\nGitHub に保存した RFC テキストは削除されず、引き続き表示されます。よろしいですか？')) return;
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    Object.keys(localStorage)
      .filter((k) => k === RECENT_KEY || k.startsWith(POS_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    renderRecent();
    renderStored();
    showStatus('キャッシュと履歴を削除しました。GitHub に保存した RFC はそのまま表示されます。', { autoHide: true });
  } catch (e) {
    showStatus(`削除に失敗しました: ${e.message}`, { error: true });
  }
  closeDrawers();
});

// ---------- ドロワー ----------
function openDrawer(d) {
  closeDrawers();
  d.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeDrawers() {
  [els.tocDrawer, els.settingsDrawer].forEach((d) => {
    d.hidden = true;
  });
  document.body.style.overflow = '';
}
document.querySelectorAll('.drawer [data-close]').forEach((el) => el.addEventListener('click', closeDrawers));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDrawers();
});
els.btnToc.addEventListener('click', () => openDrawer(els.tocDrawer));
els.btnSettings.addEventListener('click', () => openDrawer(els.settingsDrawer));
els.tocBody.addEventListener('click', (e) => {
  if (e.target.closest('a')) closeDrawers();
});

// ---------- 取得元 ----------
function sources(n) {
  const list = [];
  if (settings.source && settings.source.includes('{n}')) {
    list.push({ name: '設定した取得元', url: settings.source.replace(/\{n\}/g, String(n)) });
  }
  list.push({ name: 'このサイトに保存済みのテキスト (rfcs/)', url: `rfcs/rfc${n}.txt`, local: true });
  list.push({ name: 'rfc-editor.org', url: `https://www.rfc-editor.org/rfc/rfc${n}.txt` });
  list.push({ name: 'ietf.org', url: `https://www.ietf.org/rfc/rfc${n}.txt` });
  return list;
}

async function fetchRfcText(n, onProgress) {
  const errors = [];
  for (const src of sources(n)) {
    onProgress?.(src);
    try {
      // rfcs/ は保存・削除で中身が変わるので、ブラウザの HTTP キャッシュ (GitHub Pages では 10 分) に頼らずサーバーに確認する
      const res = await fetch(src.url, { headers: { Accept: 'text/plain' }, cache: src.local ? 'no-cache' : 'default' });
      if (!res.ok) {
        errors.push(`${src.name}: HTTP ${res.status}`);
        continue;
      }
      const text = await res.text();
      if (!/Request for Comments|RFC\s*:?\s*\d|Network Working Group|Internet Engineering Task Force/i.test(text.slice(0, 4000))) {
        errors.push(`${src.name}: RFC のテキストではないようです`);
        continue;
      }
      return { text, source: src };
    } catch (e) {
      errors.push(`${src.name}: ${e.message || 'ネットワークエラー (CORS の可能性)'}`);
    }
  }
  const err = new Error('どの取得元からも読み込めませんでした。');
  err.details = errors;
  throw err;
}

// rfc-editor.org のメタデータ (廃止・更新情報)。取得できなければ黙ってスキップする。
async function fetchRfcInfo(n) {
  try {
    const res = await fetch(`https://www.rfc-editor.org/rfc/rfc${n}.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---------- 状態表示 ----------
let statusTimer = null;
function showStatus(html, { error = false, autoHide = false, details = [], actions = '' } = {}) {
  clearTimeout(statusTimer);
  els.status.hidden = false;
  els.status.className = `status${error ? ' error' : ''}`;
  els.status.innerHTML = `${html}${details.length ? `<ul>${details.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul>` : ''}${actions ? `<div class="actions">${actions}</div>` : ''}`;
  if (autoHide) statusTimer = setTimeout(hideStatus, 2500);
}
function hideStatus() {
  els.status.hidden = true;
  els.status.innerHTML = '';
}
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------- 履歴 ----------
function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}
function pushRecent(n, title) {
  const list = loadRecent().filter((r) => r.n !== n);
  list.unshift({ n, title, t: Date.now() });
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    /* ignore */
  }
}
function renderRecent() {
  const list = loadRecent();
  els.recentWrap.hidden = !list.length;
  els.recentList.innerHTML = list
    .map(
      (r) =>
        `<li><a href="?rfc=${r.n}" data-rfc="${r.n}"><span class="num">RFC ${r.n}</span><span class="ttl">${escapeHtml(r.title || '')}</span><span class="when">${new Date(r.t).toLocaleString('ja-JP')}</span></a></li>`,
    )
    .join('');
}
async function renderStored() {
  try {
    // 保存した直後でも一覧に出るよう、HTTP キャッシュに頼らずサーバーに確認する
    const res = await fetch('rfcs/index.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const list = await res.json();
    els.storedWrap.hidden = !Array.isArray(list) || !list.length;
    if (els.storedWrap.hidden) return;
    els.storedList.innerHTML = list
      .map(
        (r) =>
          `<li><a href="?rfc=${r.number}" data-rfc="${r.number}"><span class="num">RFC ${r.number}</span><span class="ttl">${escapeHtml(r.title || '')}</span>${r.date ? `<span class="when">${escapeHtml(r.date)}</span>` : ''}</a></li>`,
      )
      .join('');
  } catch {
    /* ignore */
  }
}

// ---------- 画面遷移 ----------
let current = null; // { n, doc }
let headingObserver = null;

function showHome() {
  current = null;
  els.doc.hidden = true;
  els.doc.innerHTML = '';
  els.home.hidden = false;
  els.btnToc.hidden = true;
  els.barTitle.textContent = 'RFC Reader';
  document.title = 'RFC Reader';
  hideStatus();
  renderRecent();
  renderStored();
  els.progress.style.width = '0';
  els.fab.classList.remove('show');
  if (headingObserver) headingObserver.disconnect();
}

async function showRfc(n, { hash = '', restore = true } = {}) {
  if (!Number.isInteger(n) || n <= 0 || n > 99999) {
    showStatus('RFC 番号は 1 〜 99999 の整数で指定してください。', { error: true });
    return;
  }
  els.home.hidden = true;
  els.doc.hidden = true;
  els.doc.innerHTML = '';
  els.btnToc.hidden = true;
  els.barTitle.innerHTML = `<small>RFC ${n}</small>`;
  document.title = `RFC ${n} - RFC Reader`;
  showStatus(`<span class="spinner"></span>RFC ${n} を取得しています…`);
  const token = (showRfc.token = Symbol('load'));
  let result;
  try {
    result = await fetchRfcText(n, (src) => {
      if (showRfc.token !== token) return;
      showStatus(`<span class="spinner"></span>RFC ${n} を取得しています… <small>(${escapeHtml(src.name)})</small>`);
    });
  } catch (e) {
    if (showRfc.token !== token) return;
    showStatus(`<strong>RFC ${n} を読み込めませんでした。</strong>`, {
      error: true,
      details: e.details || [e.message],
      actions: `${REPO ? `<a class="btn" href="${escapeHtml(saveIssueUrl(n))}" target="_blank" rel="noopener">GitHub に保存して読む</a>` : ''}<a class="btn secondary" href="https://www.rfc-editor.org/rfc/rfc${n}.html" target="_blank" rel="noopener">rfc-editor.org で開く</a><button class="btn secondary" id="retry">再試行</button>${REPO ? '<p class="help">「GitHub に保存して読む」は Issue の作成画面を開きます。送信すると GitHub Actions が本文を取得して保存するので、数分後にこのページを再読み込みしてください。</p>' : ''}`,
    });
    $('#retry')?.addEventListener('click', () => showRfc(n, { hash, restore }));
    return;
  }
  if (showRfc.token !== token) return;

  let doc;
  let rendered;
  try {
    doc = parseRfc(result.text, { number: n });
    rendered = renderDocument(doc, { rfcHref: (num, frag) => `?rfc=${num}${frag ? `#${frag}` : ''}` });
  } catch (e) {
    console.error(e);
    showStatus(`<strong>表示の変換に失敗しました。</strong> ${escapeHtml(e.message)}`, {
      error: true,
      actions: `<a class="btn secondary" href="https://www.rfc-editor.org/rfc/rfc${n}.html" target="_blank" rel="noopener">rfc-editor.org で開く</a>`,
    });
    return;
  }
  hideStatus();
  current = { n, doc };
  els.doc.innerHTML = `${rendered.html}<footer class="docfoot">取得元: ${escapeHtml(result.source.name)} ・ <a href="https://www.rfc-editor.org/rfc/rfc${n}.html" target="_blank" rel="noopener">rfc-editor.org の原文</a><a href="https://www.rfc-editor.org/rfc/rfc${n}.txt" target="_blank" rel="noopener">テキスト版</a><a href="https://datatracker.ietf.org/doc/rfc${n}/" target="_blank" rel="noopener">Datatracker</a></footer>`;
  els.doc.hidden = false;
  const shortTitle = doc.meta.title && doc.meta.title !== `RFC ${n}` ? doc.meta.title : '';
  els.barTitle.innerHTML = `<small>RFC ${n}</small>${escapeHtml(shortTitle)}`;
  document.title = `RFC ${n}${shortTitle ? `: ${shortTitle}` : ''} - RFC Reader`;
  const actions = document.createElement('p');
  actions.className = 'doc-actions';
  if (result.source.local) {
    actions.innerHTML = '<span class="stored-badge">GitHub に保存済み</span>';
  } else if (REPO) {
    actions.innerHTML = `<a class="btn small" id="save-github" href="${escapeHtml(saveIssueUrl(n))}" target="_blank" rel="noopener">GitHub に保存</a><span class="hint">Issue の作成画面が開きます。送信すると GitHub Actions が本文を rfcs/ に保存します。</span>`;
  }
  if (actions.innerHTML) els.doc.querySelector('.rfc-head .status-slot')?.before(actions);
  els.tocBody.innerHTML = rendered.tocHtml || '<p class="empty">見出しを検出できませんでした。</p>';
  els.btnToc.hidden = false;
  pushRecent(n, shortTitle);
  observeHeadings();

  // スクロール位置: ハッシュがあればそこへ、なければ前回位置へ
  requestAnimationFrame(() => {
    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.replace(/^#/, '')));
      if (target) target.scrollIntoView();
      else window.scrollTo(0, 0);
    } else if (restore) {
      const pos = Number(localStorage.getItem(POS_PREFIX + n) || 0);
      window.scrollTo(0, pos);
    } else {
      window.scrollTo(0, 0);
    }
    updateProgress();
  });

  fetchRfcInfo(n).then((info) => {
    if (!info || !current || current.n !== n) return;
    const slot = els.doc.querySelector('[data-status-slot]');
    if (!slot) return;
    const nums = (arr) => (Array.isArray(arr) ? arr.map((s) => String(s).replace(/\D/g, '')).filter(Boolean) : []);
    const links = (arr) => arr.map((x) => `<a href="?rfc=${x}" data-rfc="${x}">RFC ${x}</a>`).join(', ');
    const obsBy = nums(info.obsoleted_by);
    const updBy = nums(info.updated_by);
    const parts = [];
    if (obsBy.length) parts.push(`<div class="notice warn">この RFC は ${links(obsBy)} によって廃止 (obsoleted) されています。</div>`);
    if (updBy.length) parts.push(`<div class="notice">この RFC は ${links(updBy)} によって更新 (updated) されています。</div>`);
    if (info.errata_url && info.errata_url !== '') parts.push(`<div class="notice"><a href="${escapeHtml(info.errata_url)}" target="_blank" rel="noopener">正誤表 (Errata) があります</a></div>`);
    slot.innerHTML = parts.join('');
  });
}

function observeHeadings() {
  if (headingObserver) headingObserver.disconnect();
  const headings = [...els.doc.querySelectorAll('.rfc-body h2, .rfc-body h3, .rfc-body h4, .rfc-body h5, .rfc-body h6')];
  if (!headings.length || !('IntersectionObserver' in window)) return;
  const visible = new Set();
  const markCurrent = () => {
    let cur = null;
    const barBottom = 60;
    for (const h of headings) {
      if (h.getBoundingClientRect().top <= barBottom + 8) cur = h;
      else break;
    }
    els.tocBody.querySelectorAll('a.current').forEach((a) => a.classList.remove('current'));
    if (cur) {
      const a = els.tocBody.querySelector(`a[href="#${CSS.escape(cur.id)}"]`);
      if (a) a.classList.add('current');
    }
  };
  headingObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => (en.isIntersecting ? visible.add(en.target) : visible.delete(en.target)));
      markCurrent();
    },
    { rootMargin: '-56px 0px 0px 0px' },
  );
  headings.forEach((h) => headingObserver.observe(h));
  els.tocDrawer.addEventListener('transitionend', markCurrent, { once: true });
  els.btnToc.addEventListener('click', () => {
    markCurrent();
    const cur = els.tocBody.querySelector('a.current');
    if (cur) cur.scrollIntoView({ block: 'center' });
  });
}

// ---------- スクロール ----------
let scrollTimer = null;
function updateProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const y = window.scrollY;
  els.progress.style.width = current && max > 0 ? `${Math.min(100, (y / max) * 100)}%` : '0';
  els.fab.classList.toggle('show', !!current && y > window.innerHeight);
}
window.addEventListener(
  'scroll',
  () => {
    updateProgress();
    if (!current) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      try {
        localStorage.setItem(POS_PREFIX + current.n, String(Math.round(window.scrollY)));
      } catch {
        /* ignore */
      }
    }, 200);
  },
  { passive: true },
);
els.fab.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ---------- ルーティング ----------
function parseLocation() {
  const params = new URLSearchParams(location.search);
  let n = params.get('rfc');
  if (!n) {
    const m = /^#\/?rfc\/?(\d+)/i.exec(location.hash) || /^#rfc(\d+)$/i.exec(location.hash);
    if (m) return { n: Number(m[1]), hash: '' };
  }
  if (!n) return { n: null, hash: location.hash };
  n = Number(String(n).replace(/\D/g, ''));
  return { n, hash: location.hash };
}

function route({ restore = true } = {}) {
  closeDrawers();
  const { n, hash } = parseLocation();
  if (n) showRfc(n, { hash, restore });
  else showHome();
}

function navigate(n, hash = '') {
  const url = `?rfc=${n}${hash}`;
  history.pushState(null, '', url);
  route({ restore: !hash });
}

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const n = Number(els.input.value.replace(/\D/g, ''));
  if (!n) return;
  els.input.blur();
  navigate(n);
});

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-rfc]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  const n = Number(a.dataset.rfc);
  if (!n) return;
  e.preventDefault();
  const u = new URL(a.getAttribute('href'), location.href);
  if (current && current.n === n && u.hash) {
    const t = document.getElementById(decodeURIComponent(u.hash.slice(1)));
    if (t) {
      history.pushState(null, '', `?rfc=${n}${u.hash}`);
      t.scrollIntoView();
      return;
    }
  }
  navigate(n, u.hash);
});

els.btnHome.addEventListener('click', () => {
  history.pushState(null, '', location.pathname);
  route();
});
window.addEventListener('popstate', () => route());

applySettings();
route();

// ---------- Service Worker ----------
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
