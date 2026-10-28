import { parseRfc } from './rfc-parser.js';
import { renderDocument } from './render.js';
import { normalizePdfInput, openPdf, createRegionRenderer, completePdfMeta, sha256Hex, pdfStore, fileKey } from './pdf-reader.js';
import { parseTranslation, applyTranslation, makeTemplate, stringifyTranslation, rfcTranslationPath, pdfTranslationPath } from './translation.js';

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
function openInNewTab(url) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const $ = (sel) => document.querySelector(sel);
const els = {
  home: $('#home'),
  doc: $('#doc'),
  status: $('#status'),
  topbar: $('.topbar'),
  barTitle: $('#bar-title'),
  btnHome: $('#btn-home'),
  btnLang: $('#btn-lang'),
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
  pdfForm: $('#pdf-form'),
  pdfInput: $('#pdf-input'),
  pdfFile: $('#pdf-file'),
};

// ---------- 設定 ----------
// lang: 日本語訳がある文書を開いたときの表示 (orig: 原文 / ja: 日本語訳)。閲覧画面で切り替えると、最後に選んだほうになる
const defaults = { fs: 17, theme: 'system', wrap: true, source: '', lang: 'orig' };
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
  document.querySelectorAll('#lang-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === settings.lang)));
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
$('#lang-seg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  settings.lang = b.dataset.lang === 'ja' ? 'ja' : 'orig';
  saveSettings();
  applySettings();
  // 日本語訳のある文書を開いていれば、その場で切り替える
  if (current?.tr?.ja) setLang(settings.lang);
});
els.sourceInput.addEventListener('change', () => {
  settings.source = els.sourceInput.value.trim();
  saveSettings();
});
// 消すのはブラウザ側のキャッシュと履歴だけ。GitHub (rfcs/) に保存した RFC テキストは残し、引き続き表示する
$('#clear-cache').addEventListener('click', async () => {
  if (!window.confirm('ブラウザのキャッシュと最近読んだ履歴 (端末に保存した PDF を含む) を削除します。\nGitHub に保存した RFC テキストは削除されず、引き続き表示されます。よろしいですか？')) return;
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    Object.keys(localStorage)
      .filter((k) => k === RECENT_KEY || k.startsWith(POS_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    await pdfStore.clear();
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
els.btnToc.addEventListener('click', () => {
  // いま読んでいる節を目次の中で示す
  markCurrentHeading();
  const cur = els.tocBody.querySelector('a.current');
  if (cur) cur.scrollIntoView({ block: 'center' });
});
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

// GitHub に置いた翻訳ファイル (rfcs/ja/rfcNNNN.json、pdfs/ja/<ID>.json)。
// 無ければ null、あるのに読めなければ { path, error } (画面にエラーを出して原文を表示する)
async function fetchTranslation(path) {
  let text;
  try {
    // 置き換えたらすぐ反映されるよう、HTTP キャッシュに頼らずサーバーに確認する
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) return null;
    text = await res.text();
  } catch {
    return null;
  }
  // 存在しないファイルにも HTML (トップページなど) を返すサーバーでは、翻訳なしとみなす
  if (/^\s*</.test(text)) return null;
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { path, error: `JSON の書き方に誤りがあります (${e.message})` };
  }
  try {
    return { path, data: parseTranslation(json) };
  } catch (e) {
    return { path, error: e.message };
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
function pushRecent(entry) {
  const list = loadRecent().filter((r) => (entry.pdf ? r.pdf !== entry.pdf : r.n !== entry.n));
  list.unshift({ ...entry, t: Date.now() });
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
    .map((r) => {
      const when = `<span class="when">${new Date(r.t).toLocaleString('ja-JP')}</span>`;
      if (r.pdf) return `<li><a href="?pdf=${encodeURIComponent(r.pdf)}" data-pdf="${escapeHtml(r.pdf)}"><span class="num">PDF</span><span class="ttl">${escapeHtml(r.title || r.pdf)}</span>${when}</a></li>`;
      return `<li><a href="?rfc=${r.n}" data-rfc="${r.n}"><span class="num">RFC ${r.n}</span><span class="ttl">${escapeHtml(r.title || '')}</span>${when}</a></li>`;
    })
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
      .map((r) => {
        // translations.ja は日本語訳の題名 (題名が未訳なら空文字)
        const ja = typeof r.translations?.ja === 'string';
        const title = settings.lang === 'ja' && ja && r.translations.ja ? r.translations.ja : r.title;
        return `<li><a href="?rfc=${r.number}" data-rfc="${r.number}"><span class="num">RFC ${r.number}</span>${ja ? '<span class="tag">日本語訳</span>' : ''}<span class="ttl">${escapeHtml(title || '')}</span>${r.date ? `<span class="when">${escapeHtml(r.date)}</span>` : ''}</a></li>`;
      })
      .join('');
  } catch {
    /* ignore */
  }
}

// ---------- 画面遷移 ----------
// current: 表示中の文書
//   { kind: 'rfc' | 'pdf', n? | pdfKey?, doc (原文の構造), tr (翻訳: { path, data, ja: { doc, total, translated }, error }),
//     lang ('orig' | 'ja'), posKey, notices, regions?, cleanup?, ... }
let current = null;
let loadToken = null; // 後から開いた文書が先に表示されないよう、読み込みごとに作り直す
let headingObserver = null;
let markCurrentHeading = () => {};

function leaveDocument() {
  current?.cleanup?.();
  current = null;
  anchorCache = null;
  els.btnLang.hidden = true;
}

function showHome() {
  leaveDocument();
  loadToken = null;
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

function startLoading(label, message) {
  leaveDocument();
  els.home.hidden = true;
  els.doc.hidden = true;
  els.doc.innerHTML = '';
  els.btnToc.hidden = true;
  els.barTitle.innerHTML = `<small>${label}</small>`;
  document.title = `${label} - RFC Reader`;
  showStatus(`<span class="spinner"></span>${message}`);
  loadToken = Symbol('load');
  return loadToken;
}

async function showRfc(n, { hash = '', restore = true, lang = null } = {}) {
  if (!Number.isInteger(n) || n <= 0 || n > 99999) {
    showStatus('RFC 番号は 1 〜 99999 の整数で指定してください。', { error: true });
    return;
  }
  const token = startLoading(`RFC ${n}`, `RFC ${n} を取得しています…`);
  const stale = () => loadToken !== token;
  // 日本語訳は本文と並行して取りに行く
  const trPromise = fetchTranslation(rfcTranslationPath(n));
  let result;
  try {
    result = await fetchRfcText(n, (src) => {
      if (stale()) return;
      showStatus(`<span class="spinner"></span>RFC ${n} を取得しています… <small>(${escapeHtml(src.name)})</small>`);
    });
  } catch (e) {
    if (stale()) return;
    showStatus(`<strong>RFC ${n} を読み込めませんでした。</strong>`, {
      error: true,
      details: e.details || [e.message],
      actions: `${REPO ? `<a class="btn" href="${escapeHtml(saveIssueUrl(n))}" target="_blank" rel="noopener">GitHub に保存して読む</a>` : ''}<a class="btn secondary" href="https://www.rfc-editor.org/rfc/rfc${n}.html" target="_blank" rel="noopener">rfc-editor.org で開く</a><button class="btn secondary" id="retry">再試行</button>${REPO ? '<p class="help">「GitHub に保存して読む」は Issue の作成画面を開きます。送信すると GitHub Actions が本文を取得して保存するので、数分後にこのページを再読み込みしてください。</p>' : ''}`,
    });
    $('#retry')?.addEventListener('click', () => showRfc(n, { hash, restore, lang }));
    return;
  }
  if (stale()) return;

  let doc;
  try {
    doc = parseRfc(result.text, { number: n });
  } catch (e) {
    console.error(e);
    showStatus(`<strong>表示の変換に失敗しました。</strong> ${escapeHtml(e.message)}`, {
      error: true,
      actions: `<a class="btn secondary" href="https://www.rfc-editor.org/rfc/rfc${n}.html" target="_blank" rel="noopener">rfc-editor.org で開く</a>`,
    });
    return;
  }
  const tr = await trPromise;
  if (stale()) return;
  current = { kind: 'rfc', n, doc, source: result.source, posKey: POS_PREFIX + n, notices: '' };
  prepareTranslation(current, tr, lang);
  if (!present({ hash, restore })) {
    leaveDocument();
    return;
  }
  pushRecent(recentEntry());

  fetchRfcInfo(n).then((info) => {
    if (!info || !current || current.n !== n) return;
    const nums = (arr) => (Array.isArray(arr) ? arr.map((s) => String(s).replace(/\D/g, '')).filter(Boolean) : []);
    const links = (arr) => arr.map((x) => `<a href="?rfc=${x}" data-rfc="${x}">RFC ${x}</a>`).join(', ');
    const obsBy = nums(info.obsoleted_by);
    const updBy = nums(info.updated_by);
    const parts = [];
    if (obsBy.length) parts.push(`<div class="notice warn">この RFC は ${links(obsBy)} によって廃止 (obsoleted) されています。</div>`);
    if (updBy.length) parts.push(`<div class="notice">この RFC は ${links(updBy)} によって更新 (updated) されています。</div>`);
    if (info.errata_url && info.errata_url !== '') parts.push(`<div class="notice"><a href="${escapeHtml(info.errata_url)}" target="_blank" rel="noopener">正誤表 (Errata) があります</a></div>`);
    current.notices = parts.join('');
    fillNotices();
  });
}

// ---------- 日本語訳 ----------
function prepareTranslation(cur, tr, lang) {
  cur.tr = tr ? { path: tr.path, data: tr.data || null, ja: null, error: tr.error || '' } : null;
  if (cur.tr?.data) {
    try {
      cur.tr.ja = applyTranslation(cur.doc, cur.tr.data);
    } catch (e) {
      console.error(e);
      cur.tr.error = `訳文を当てはめられませんでした (${e.message})`;
    }
  }
  cur.lang = cur.tr?.ja && (lang || settings.lang) === 'ja' ? 'ja' : 'orig';
}

function translationPathOf(cur) {
  if (cur.kind === 'rfc') return rfcTranslationPath(cur.n);
  return cur.pdfId ? pdfTranslationPath(cur.pdfId) : '';
}

// 原文と日本語訳を切り替える。構造が同じなので、読んでいた位置の要素に合わせて表示し直す
function setLang(lang) {
  if (!current?.tr?.ja) return;
  lang = lang === 'ja' ? 'ja' : 'orig';
  // 次に日本語訳のある文書を開いたときも、最後に選んだほうで表示する
  settings.lang = lang;
  saveSettings();
  applySettings();
  if (current.lang === lang) return;
  const anchor = readingAnchor();
  current.lang = lang;
  dropLangParam();
  present({ anchor });
  pushRecent(recentEntry());
}

// URL の lang (?rfc=7591&lang=ja) はその表示だけの指定。切り替えたら外して、以後は設定に従う
function dropLangParam() {
  const u = new URL(location.href);
  if (!u.searchParams.has('lang')) return;
  u.searchParams.delete('lang');
  history.replaceState(history.state, '', `${u.pathname}${u.search}${u.hash}`);
}

function updateLangButton() {
  const has = !!current?.tr?.ja;
  els.btnLang.hidden = !has;
  if (!has) return;
  const ja = current.lang === 'ja';
  const label = ja ? '原文に切り替え' : '日本語訳に切り替え';
  els.btnLang.textContent = ja ? '原文' : '日本語';
  els.btnLang.setAttribute('aria-label', label);
  els.btnLang.title = label;
}
els.btnLang.addEventListener('click', () => setLang(current?.lang === 'ja' ? 'orig' : 'ja'));

// 翻訳ファイルのひな形 (原文の文字列ごとに訳文を書き込む欄) を書き出す。既存の訳文は引き継ぐ
function exportTranslation() {
  const cur = current;
  const path = cur && translationPathOf(cur);
  if (!path) return;
  const meta = cur.doc.meta;
  const source =
    cur.kind === 'rfc'
      ? { type: 'rfc', number: cur.n, title: meta.title || '' }
      : { type: 'pdf', id: cur.pdfId, sha256: cur.sha256, name: cur.name, ...(cur.url ? { url: cur.url } : {}), title: meta.title || '', pages: meta.pages };
  const text = stringifyTranslation(makeTemplate(cur.doc, { source, previous: cur.tr?.data || null }));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = path.split('/').pop();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ---------- 表示 ----------
function shownTitle() {
  const doc = current.lang === 'ja' ? current.tr.ja.doc : current.doc;
  const title = doc.meta.title || '';
  return current.kind === 'rfc' && title === `RFC ${current.n}` ? '' : title;
}

function recentEntry() {
  return current.kind === 'rfc' ? { n: current.n, title: shownTitle() } : { pdf: current.pdfKey, title: shownTitle() };
}

function headActionsHtml(cur) {
  let html = '';
  if (cur.kind === 'rfc') {
    if (cur.source.local) html += '<p class="doc-actions"><span class="stored-badge">GitHub に保存済み</span></p>';
    else if (REPO) html += `<p class="doc-actions"><a class="btn small" id="save-github" href="${escapeHtml(saveIssueUrl(cur.n))}" target="_blank" rel="noopener">GitHub に保存</a><span class="hint">Issue の作成画面が開きます。送信すると GitHub Actions が本文を rfcs/ に保存します。</span></p>`;
  }
  if (cur.tr?.ja) {
    const { total, translated } = cur.tr.ja;
    const hints = [];
    if (translated < total) hints.push(`翻訳済み ${Math.floor((translated / total) * 100)}%。訳文のない部分は原文のまま表示します。`);
    if (cur.tr.data.note) hints.push(escapeHtml(cur.tr.data.note));
    const buttons = [
      ['orig', '原文'],
      ['ja', '日本語訳'],
    ].map(([l, label]) => `<button type="button" data-lang="${l}" aria-pressed="${cur.lang === l}">${label}</button>`);
    html += `<div class="lang-switch"><div class="seg" role="group" aria-label="表示する言語">${buttons.join('')}</div>${hints.length ? `<p class="hint">${hints.join(' ')}</p>` : ''}</div>`;
  }
  return html;
}

function translationFootHtml(cur) {
  const path = translationPathOf(cur);
  if (!path) return '';
  const code = `<code>${escapeHtml(path)}</code>`;
  // GitHub 上にあるファイルは、編集できるよう GitHub の画面へのリンクにする
  const file = cur.tr && REPO ? `<a href="https://github.com/${REPO}/blob/main/${escapeHtml(path)}" target="_blank" rel="noopener">${code}</a>` : code;
  const label = cur.tr?.data ? '日本語訳' : cur.tr ? '日本語訳のファイル (読み込めません)' : '日本語訳のファイル (未作成)';
  return `<p class="tr-foot">${label}: ${file}<button type="button" class="linkbtn" id="export-translation">翻訳用ファイル (JSON) を書き出す</button></p><p class="hint">書き出したファイルの "dst" に "src" (原文) の訳文を書き込み、GitHub の ${code} に置くと、原文と日本語訳を切り替えて読めます。</p>`;
}

function footerHtml(cur) {
  let html;
  if (cur.kind === 'rfc') {
    const n = cur.n;
    html = `取得元: ${escapeHtml(cur.source.name)} ・ <a href="https://www.rfc-editor.org/rfc/rfc${n}.html" target="_blank" rel="noopener">rfc-editor.org の原文</a><a href="https://www.rfc-editor.org/rfc/rfc${n}.txt" target="_blank" rel="noopener">テキスト版</a><a href="https://datatracker.ietf.org/doc/rfc${n}/" target="_blank" rel="noopener">Datatracker</a>`;
  } else {
    const origin = cur.url
      ? `取得元: <a href="${escapeHtml(cur.url)}" target="_blank" rel="noopener">${escapeHtml(cur.url)}</a>`
      : `端末のファイル: ${escapeHtml(cur.name)} ・ <a href="#" id="open-original">元の PDF を開く</a>`;
    html = `${origin}<p class="hint">PDF の文字の位置から自動で組み直した表示です。図・表・数式はページから切り出した画像で、タップすると拡大します。崩れている箇所は元の PDF を参照してください。</p>`;
  }
  return html + translationFootHtml(cur);
}

// rfc-editor.org の廃止・更新情報と、翻訳ファイルを読めなかったときの案内
function fillNotices() {
  const slot = els.doc.querySelector('[data-status-slot]');
  if (!slot || !current) return;
  const trError = current.tr?.error ? `<div class="notice warn">日本語訳のファイル (${escapeHtml(current.tr.path)}) を読み込めなかったため、原文を表示しています: ${escapeHtml(current.tr.error)}</div>` : '';
  slot.innerHTML = trError + (current.notices || '');
}

// current を表示する (開いたとき・原文と日本語訳を切り替えたとき)。
// anchor を渡すとその位置 (readingAnchor) へ、渡さなければ hash の位置か前回の位置へ移る
function present({ hash = '', restore = true, anchor } = {}) {
  const cur = current;
  const ja = cur.lang === 'ja' ? cur.tr.ja : null;
  const doc = ja ? ja.doc : cur.doc;
  let rendered;
  try {
    rendered = renderDocument(doc, { rfcHref: (num, frag) => `?rfc=${num}${frag ? `#${frag}` : ''}` });
  } catch (e) {
    console.error(e);
    showStatus(`<strong>表示の変換に失敗しました。</strong> ${escapeHtml(e.message)}`, {
      error: true,
      actions: cur.kind === 'rfc' ? `<a class="btn secondary" href="https://www.rfc-editor.org/rfc/rfc${cur.n}.html" target="_blank" rel="noopener">rfc-editor.org で開く</a>` : '',
    });
    return false;
  }
  hideStatus();
  if (ja) els.doc.lang = cur.tr.data.lang;
  else if (cur.kind === 'rfc') els.doc.lang = 'en';
  else els.doc.removeAttribute('lang');
  els.doc.innerHTML = `${rendered.html}<footer class="docfoot">${footerHtml(cur)}</footer>`;
  els.doc.hidden = false;
  anchorCache = null;
  els.doc.querySelector('.rfc-head .status-slot')?.insertAdjacentHTML('beforebegin', headActionsHtml(cur));
  fillNotices();
  const title = shownTitle();
  if (cur.kind === 'rfc') {
    els.barTitle.innerHTML = `<small>RFC ${cur.n}</small>${escapeHtml(title)}`;
    document.title = `RFC ${cur.n}${title ? `: ${title}` : ''} - RFC Reader`;
  } else {
    els.barTitle.innerHTML = `<small>PDF</small>${escapeHtml(title)}`;
    document.title = `${title} - RFC Reader`;
  }
  els.tocBody.innerHTML = rendered.tocHtml || '<p class="empty">見出しを検出できませんでした。</p>';
  els.btnToc.hidden = false;
  updateLangButton();
  cur.regions?.attach(els.doc);
  observeHeadings();
  if (anchor !== undefined) {
    requestAnimationFrame(() => {
      restoreAnchor(anchor);
      updateProgress();
    });
  } else restoreScroll(hash, restore);
  return true;
}

els.doc.addEventListener('click', (e) => {
  const lb = e.target.closest('.lang-switch [data-lang]');
  if (lb) {
    setLang(lb.dataset.lang);
    return;
  }
  if (e.target.closest('#export-translation')) {
    exportTranslation();
    return;
  }
  if (e.target.closest('#open-original')) {
    e.preventDefault();
    current?.openOriginal?.();
  }
});

// ---------- 読んでいる位置 ----------
// 原文と日本語訳は同じ構造なので、「何番目の段落 (見出し・行・セル…) の何割の位置か」で対応づける。
// 文字サイズを変えた後や、前回と違う言語で開いたときも同じ箇所に戻れる
const ANCHOR_SEL = ['.rfc-head', ...['h2', 'h3', 'h4', 'h5', 'h6', 'p', 'pre', 'li', 'dt', 'dd', 'tr', 'figcaption', '.pdf-region'].map((s) => `.rfc-body ${s}`)].join(', ');
let anchorCache = null;
function anchorElements() {
  if (!anchorCache) anchorCache = [...els.doc.querySelectorAll(ANCHOR_SEL)].filter((el) => !el.closest('.toc-inline'));
  return anchorCache;
}
const viewTop = () => els.topbar.getBoundingClientRect().bottom;

// 画面の上端 (トップバーの下) にある要素とその中の位置。先頭にいるときは null
function readingAnchor() {
  const list = anchorElements();
  if (!list.length || window.scrollY < 1) return null;
  const top = viewTop();
  // 文書の順に並んだ要素の上端は単調に増えるので、二分探索で上端が画面の上端より上にある最後の要素を探す
  let lo = 0;
  let hi = list.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].getBoundingClientRect().top <= top) {
      idx = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (idx < 0) return null;
  // その要素が既に終わっていれば、まだ続いている外側の要素 (箇条書きの項目など) を使う
  let i = idx;
  for (let k = idx; k >= Math.max(0, idx - 40); k--) {
    if (list[k].getBoundingClientRect().bottom > top) {
      i = k;
      break;
    }
  }
  const r = list[i].getBoundingClientRect();
  const f = r.height > 0 ? Math.min(1, Math.max(0, (top - r.top) / r.height)) : 0;
  return { i, f: Math.round(f * 1000) / 1000 };
}

function restoreAnchor(anchor) {
  const list = anchorElements();
  const el = anchor && list[Math.min(anchor.i, list.length - 1)];
  if (!el) {
    window.scrollTo(0, 0);
    return;
  }
  const r = el.getBoundingClientRect();
  window.scrollTo(0, Math.max(0, window.scrollY + r.top - viewTop() + (anchor.f || 0) * r.height));
}

function savedPosition(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    // 以前の形式 (スクロール量の数値だけ)
    if (/^\d+$/.test(raw)) return { y: Number(raw) };
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// スクロール位置: ハッシュがあればそこへ、なければ前回位置へ
function restoreScroll(hash, restore) {
  requestAnimationFrame(() => {
    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.replace(/^#/, '')));
      if (target) target.scrollIntoView();
      else window.scrollTo(0, 0);
    } else if (restore && current) {
      const pos = savedPosition(current.posKey);
      // 前回と違う言語・文字サイズで開いても同じ箇所に戻れるよう、要素の位置を優先する
      if (pos && pos.i !== undefined) restoreAnchor(pos);
      else window.scrollTo(0, pos ? Number(pos.y) || 0 : 0);
    } else {
      window.scrollTo(0, 0);
    }
    updateProgress();
  });
}

// ---------- PDF ----------
const memPdfs = new Map(); // IndexedDB を使えないときの保存先
const isPdfBytes = (buf) => String.fromCharCode(...new Uint8Array(buf.slice(0, 1024))).includes('%PDF-');

async function loadPdfBytes(key) {
  if (key.startsWith('local:')) {
    const rec = memPdfs.get(key) || (await pdfStore.get(key));
    if (!rec) throw new Error('この端末には保存されていません。もう一度ファイルを選んで開いてください。');
    return { bytes: rec.bytes, name: rec.name || 'PDF', url: '' };
  }
  const url = new URL(key, location.href).href;
  const cached = await pdfStore.get(key);
  if (cached) return { bytes: cached.bytes, name: cached.name, url };
  let res;
  try {
    res = await fetch(url);
  } catch {
    const err = new Error('PDF を取得できませんでした (ブラウザからの取得が許可されていないか、ネットワークエラーです)。');
    err.cors = true;
    throw err;
  }
  if (!res.ok) throw new Error(`PDF を取得できませんでした (HTTP ${res.status})。`);
  const bytes = await res.arrayBuffer();
  if (!isPdfBytes(bytes)) throw new Error('PDF ファイルではないようです。');
  const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'PDF');
  await pdfStore.put({ key, name, bytes });
  return { bytes, name, url };
}

async function showPdf(key, { hash = '', restore = true, lang = null } = {}) {
  const token = startLoading('PDF', 'PDF を読み込んでいます…');
  const stale = () => loadToken !== token;
  let src;
  let opened;
  let hex = '';
  let tr = null;
  try {
    src = await loadPdfBytes(key);
    if (stale()) return;
    // 日本語訳 (pdfs/ja/<SHA-256 の先頭 16 文字>.json) は解析と並行して取りに行く
    hex = await sha256Hex(src.bytes);
    const trPromise = hex ? fetchTranslation(pdfTranslationPath(hex.slice(0, 16))) : Promise.resolve(null);
    showStatus('<span class="spinner"></span>PDF を解析しています…');
    opened = await openPdf(src.bytes, {
      onProgress: (i, total) => {
        if (!stale()) showStatus(`<span class="spinner"></span>PDF を解析しています… <small>(${i} / ${total} ページ)</small>`);
      },
    });
    tr = await trPromise;
  } catch (e) {
    if (stale()) return;
    console.error(e);
    const remote = !key.startsWith('local:');
    showStatus(`<strong>PDF を表示できませんでした。</strong> ${escapeHtml(e.message)}`, {
      error: true,
      actions: `${remote ? `<a class="btn secondary" href="${escapeHtml(new URL(key, location.href).href)}" target="_blank" rel="noopener">元の PDF を開く</a>` : ''}<button class="btn secondary" id="pick-again">ファイルを選んで開く</button>${e.cors ? '<p class="help">このサイトはブラウザからの直接の取得を許可していません。PDF を端末に保存してから「ファイルを選んで開く」で開いてください。</p>' : ''}`,
    });
    $('#pick-again')?.addEventListener('click', () => els.pdfFile.click());
    return;
  }
  if (stale()) {
    opened.destroy();
    return;
  }
  const { doc, pdf } = opened;
  completePdfMeta(doc, src);
  const regions = createRegionRenderer(pdf);
  let blobUrl = '';
  current = {
    kind: 'pdf',
    pdfKey: key,
    doc,
    posKey: `${POS_PREFIX}pdf:${key}`,
    pdfId: hex.slice(0, 16),
    sha256: hex,
    name: src.name,
    url: src.url,
    notices: '',
    regions,
    openOriginal: () => {
      if (!blobUrl) blobUrl = URL.createObjectURL(new Blob([src.bytes], { type: 'application/pdf' }));
      openInNewTab(blobUrl);
    },
    cleanup: () => {
      regions.destroy();
      opened.destroy();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    },
  };
  prepareTranslation(current, tr, lang);
  if (!present({ hash, restore })) {
    leaveDocument();
    return;
  }
  pushRecent(recentEntry());
  pdfStore.touch(key, { title: doc.meta.title });
}

els.pdfForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const url = normalizePdfInput(els.pdfInput.value);
  if (!url) return;
  els.pdfInput.blur();
  navigatePdf(url);
});

els.pdfFile.addEventListener('change', async () => {
  const file = els.pdfFile.files && els.pdfFile.files[0];
  els.pdfFile.value = '';
  if (!file) return;
  try {
    const bytes = await file.arrayBuffer();
    if (!isPdfBytes(bytes)) {
      showStatus('PDF ファイルを選んでください。', { error: true });
      return;
    }
    const key = await fileKey(bytes, file);
    const rec = { key, name: file.name, bytes };
    memPdfs.set(key, rec);
    await pdfStore.put(rec);
    navigatePdf(key);
  } catch (e) {
    showStatus(`ファイルを読み込めませんでした: ${escapeHtml(e.message)}`, { error: true });
  }
});

function observeHeadings() {
  if (headingObserver) headingObserver.disconnect();
  headingObserver = null;
  markCurrentHeading = () => {};
  const headings = [...els.doc.querySelectorAll('.rfc-body h2, .rfc-body h3, .rfc-body h4, .rfc-body h5, .rfc-body h6')];
  if (!headings.length || !('IntersectionObserver' in window)) return;
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
  markCurrentHeading = markCurrent;
  headingObserver = new IntersectionObserver(markCurrent, { rootMargin: '-56px 0px 0px 0px' });
  headings.forEach((h) => headingObserver.observe(h));
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
      if (!current) return;
      try {
        // スクロール量に加えて、言語や文字サイズに依らない位置 (何番目の要素か) も残す
        localStorage.setItem(current.posKey, JSON.stringify({ y: Math.round(window.scrollY), ...readingAnchor() }));
      } catch {
        /* ignore */
      }
    }, 200);
  },
  { passive: true },
);
els.fab.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ---------- ルーティング ----------
const langParam = (v) => (v === 'ja' ? 'ja' : /^(orig|original|en|source)$/i.test(v || '') ? 'orig' : null);

function parseLocation() {
  const params = new URLSearchParams(location.search);
  const lang = langParam(params.get('lang'));
  const pdf = params.get('pdf');
  if (pdf) return { n: null, pdf, hash: location.hash, lang };
  let n = params.get('rfc');
  if (!n) {
    const m = /^#\/?rfc\/?(\d+)/i.exec(location.hash) || /^#rfc(\d+)$/i.exec(location.hash);
    if (m) return { n: Number(m[1]), hash: '', lang };
  }
  if (!n) return { n: null, hash: location.hash, lang };
  n = Number(String(n).replace(/\D/g, ''));
  return { n, hash: location.hash, lang };
}

function route({ restore = true } = {}) {
  closeDrawers();
  const { n, pdf, hash, lang } = parseLocation();
  // 同じ文書の中のリンク (目次・節の参照) で戻る・進むときは、読み込み直さずにその位置へ移る
  if (current && ((pdf && current.pdfKey === pdf) || (!pdf && n && current.n === n))) {
    if (lang && lang !== current.lang && current.tr?.ja) {
      const anchor = hash ? undefined : readingAnchor();
      current.lang = lang;
      present({ hash, restore: false, anchor });
      return;
    }
    const target = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
    if (target) target.scrollIntoView();
    else if (!hash) window.scrollTo(0, 0);
    return;
  }
  if (pdf) showPdf(pdf, { hash, restore, lang });
  else if (n) showRfc(n, { hash, restore, lang });
  else showHome();
}

function navigatePdf(key, hash = '') {
  history.pushState(null, '', `?pdf=${encodeURIComponent(key)}${hash}`);
  route({ restore: !hash });
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
  const p = e.target.closest('a[data-pdf]');
  if (p && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
    e.preventDefault();
    navigatePdf(p.dataset.pdf);
    return;
  }
  const a = e.target.closest('a[data-rfc]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  const n = Number(a.dataset.rfc);
  if (!n) return;
  e.preventDefault();
  const u = new URL(a.getAttribute('href'), location.href);
  if (current && current.n === n && u.hash) {
    const t = document.getElementById(decodeURIComponent(u.hash.slice(1)));
    if (t) {
      const lang = new URLSearchParams(location.search).get('lang');
      history.pushState(null, '', `?rfc=${n}${lang ? `&lang=${encodeURIComponent(lang)}` : ''}${u.hash}`);
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
