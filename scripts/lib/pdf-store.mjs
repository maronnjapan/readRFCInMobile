// pdfs/ ディレクトリ (GitHub に格納する PDF) の操作。
// CLI (fetch-pdf.mjs / issue-command.mjs) とテストの両方から使う。
//
// pdfs/index.json には保存した PDF を新しい順に載せる:
//   { file: 'arxiv-1706.03762.pdf', title, pages, size, sha256, url: 元の URL (ファイルとして保存したものは '') }
// アプリは url (無ければ sha256 の先頭 16 桁 = ファイルとして開いたときのキー) で保存済みかどうかを判定する。
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { repoRoot, USER_AGENT } from './rfc-store.mjs';
import { extractPdf } from '../../src/pdf-extract.js';
import { layoutPdf } from '../../src/pdf-layout.js';
import { normalizePdfInput } from '../../src/pdf-reader.js';

export const defaultPdfDir = join(repoRoot, 'pdfs');
// GitHub は 50 MB を超えるファイルの push に警告を出す (100 MB で拒否する)
export const MAX_PDF_BYTES = 50 * 1024 * 1024;

const mb = (n) => `${Math.round(n / 1024 / 1024)} MB`;
const sha256Of = (buf) => createHash('sha256').update(buf).digest('hex');
const isPdf = (buf) => buf.subarray(0, 1024).includes('%PDF-');

export function loadPdfIndex(dir = defaultPdfDir) {
  try {
    const list = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writePdfIndex(dir, list) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.json'), `${JSON.stringify(list, null, 2)}\n`);
}

export function listPdfFiles(dir = defaultPdfDir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.pdf$/i.test(f))
    .sort();
}

// ---------- 名前 ----------
// Issue の本文に添付したファイル (https://github.com/user-attachments/files/<番号>/<名前>、古い形式は /<owner>/<repo>/files/…)
const ATTACHMENT = String.raw`https://github\.com/(?:user-attachments/files|[\w.-]+/[\w.-]+/files)/\d+/[^\s()<>"'\`\]]+`;
export const isAttachmentUrl = (url) => new RegExp(`^${ATTACHMENT}$`).test(url);

// 保存するファイル名。使えない文字は - にして、末尾を .pdf にそろえる
export function pdfFileName(name) {
  const base = String(name || '')
    .normalize('NFC')
    .replace(/\.pdf$/i, '')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return `${[...base].slice(0, 80).join('').replace(/[-.]+$/, '') || 'document'}.pdf`;
}

// URL から付けるファイル名の元: arXiv は arxiv-<ID>、ほかは URL の最後の部分
export function nameFromUrl(url) {
  const arxiv = /^https:\/\/arxiv\.org\/pdf\/(.+)$/.exec(url);
  if (arxiv) return `arxiv-${arxiv[1].replace(/\//g, '-')}`;
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '') || u.hostname;
  } catch {
    return '';
  }
}

// ---------- 取得と解析 ----------
export async function downloadPdf(url, { maxBytes = MAX_PDF_BYTES, timeout = 120_000 } = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/pdf,*/*;q=0.8' }, signal: AbortSignal.timeout(timeout) }).catch((e) => {
    // "fetch failed" だけでは分からないので、原因 (名前解決の失敗など) を出す
    throw new Error(e.cause?.message || e.message);
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const chunks = [];
  let size = 0;
  for await (const chunk of res.body ?? []) {
    size += chunk.length;
    if (size > maxBytes) throw new Error(`${mb(maxBytes)} を超えています`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

let pdfjsPromise = null;
function loadPdfjs() {
  pdfjsPromise ??= import(pathToFileURL(join(repoRoot, 'vendor/pdfjs/pdf.min.mjs')).href).then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = pathToFileURL(join(repoRoot, 'vendor/pdfjs/pdf.worker.min.mjs')).href;
    return lib;
  });
  return pdfjsPromise;
}

// 一覧に出す題名とページ数を、アプリと同じ解析 (pdf-layout.js) で求める。pdf.js で開けない PDF は例外になる
export async function describePdf(buf) {
  const lib = await loadPdfjs();
  const task = lib.getDocument({ data: new Uint8Array(buf), verbosity: 0 });
  try {
    const pdf = await task.promise;
    let title = '';
    try {
      title = layoutPdf(await extractPdf(pdf)).meta.title;
    } catch {
      /* 題名が分からなくても保存はする */
    }
    return { title, pages: pdf.numPages };
  } finally {
    await task.destroy();
  }
}

// ---------- 保存・削除 ----------
// PDF の中身を pdfs/ に保存して index.json の先頭に載せる。
// 同じ内容が保存済みなら保存しない (ファイルとして保存した PDF を URL 付きで保存し直したときは、その URL を登録する)。
//   返り値: { status: 'saved' | 'linked' | 'exists', entry }
export async function addPdf(bytes, { dir = defaultPdfDir, name = '', url = '', log = () => {} } = {}) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (!isPdf(buf)) throw new Error('PDF ではありません');
  if (buf.length > MAX_PDF_BYTES) throw new Error(`${mb(MAX_PDF_BYTES)} を超えています`);
  const sha256 = sha256Of(buf);
  const index = loadPdfIndex(dir);
  const same = index.find((e) => e.sha256 === sha256 && existsSync(join(dir, e.file)));
  if (same) {
    if (!url || same.url) return { status: 'exists', entry: same };
    same.url = url;
    writePdfIndex(dir, index);
    log(`  ${same.file} に URL を登録しました`);
    return { status: 'linked', entry: same };
  }
  let info;
  try {
    info = await describePdf(buf);
  } catch (e) {
    throw new Error(`PDF を開けませんでした (${e.message})`);
  }
  let file = pdfFileName(name);
  if (existsSync(join(dir, file))) file = file.replace(/\.pdf$/, `-${sha256.slice(0, 8)}.pdf`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), buf);
  const entry = { file, title: info.title || file.replace(/\.pdf$/, ''), pages: info.pages, size: buf.length, sha256, url };
  writePdfIndex(dir, [entry, ...index.filter((e) => e.file !== file)]);
  log(`  -> ${join(dir, file)}`);
  return { status: 'saved', entry };
}

// URL (arXiv の ID も可) から PDF を取得して保存する。保存済みの URL は取得し直さない
export async function storePdfs(targets, { dir = defaultPdfDir, log = () => {} } = {}) {
  const result = { saved: [], linked: [], skipped: [], failed: [] };
  for (const target of targets) {
    const url = normalizePdfInput(target);
    const attachment = isAttachmentUrl(url);
    const known = !attachment && loadPdfIndex(dir).find((e) => e.url === url && existsSync(join(dir, e.file)));
    if (known) {
      log(`${url} は保存済みです (${known.file})`);
      result.skipped.push(known);
      continue;
    }
    log(`${url} を取得中…`);
    try {
      // 添付ファイルの URL は元の URL として残さない (アプリではファイルとして開いたときのキーで探す)
      const r = await addPdf(await downloadPdf(url), { dir, name: nameFromUrl(url), url: attachment ? '' : url, log });
      result[{ saved: 'saved', linked: 'linked', exists: 'skipped' }[r.status]].push(r.entry);
    } catch (e) {
      log(`  x ${url}: ${e.message}`);
      result.failed.push({ target: url, error: e.message });
    }
  }
  return result;
}

// ファイル名 (.pdf は省略可)・元の URL・内容のハッシュ (local:… またはその 16 進の先頭 8 桁以上) で当てる
function matchesPdf(entry, target) {
  const t = String(target).trim();
  const name = t.replace(/^(\.\/)?pdfs\//, '').toLowerCase();
  if ([name, `${name}.pdf`].includes(entry.file.toLowerCase())) return true;
  if (entry.url && entry.url === normalizePdfInput(t)) return true;
  const hash = /^(?:local:)?([0-9a-f]{8,64})$/i.exec(t);
  return !!hash && String(entry.sha256 || '').startsWith(hash[1].toLowerCase());
}

// index.json に載っていない PDF (pdfs/ に直接置いたもの) もファイル名で消せる
export function deletePdfs(targets, { dir = defaultPdfDir, log = () => {} } = {}) {
  let index = loadPdfIndex(dir);
  const result = { deleted: [], missing: [] };
  for (const target of targets) {
    const entry = index.find((e) => matchesPdf(e, target)) || listPdfFiles(dir).map((file) => ({ file })).find((e) => matchesPdf(e, target));
    if (!entry) {
      result.missing.push(target);
      continue;
    }
    rmSync(join(dir, entry.file), { force: true });
    index = index.filter((e) => e.file !== entry.file);
    log(`${entry.file} を削除しました`);
    result.deleted.push(entry);
  }
  writePdfIndex(dir, index);
  return result;
}

export function clearPdfs({ dir = defaultPdfDir, log = () => {} } = {}) {
  const index = loadPdfIndex(dir);
  const deleted = listPdfFiles(dir).map((file) => index.find((e) => e.file === file) || { file });
  for (const e of deleted) {
    rmSync(join(dir, e.file));
    log(`${e.file} を削除しました`);
  }
  writePdfIndex(dir, []);
  return { deleted };
}

// index.json を pdfs/ の中身に合わせる。直接置いた PDF を先頭に登録し、無くなった PDF を外す。
// 載っている PDF は元の URL と並び順を残し、内容が変わったものだけ題名を求め直す。
export async function reindexPdfs({ dir = defaultPdfDir, log = () => {} } = {}) {
  const old = loadPdfIndex(dir);
  const fresh = [];
  const current = new Map();
  for (const file of listPdfFiles(dir)) {
    const buf = readFileSync(join(dir, file));
    const sha256 = sha256Of(buf);
    const prev = old.find((e) => e.file === file);
    if (prev && prev.sha256 === sha256) {
      current.set(file, prev);
      continue;
    }
    let info = { title: '', pages: 0 };
    try {
      info = await describePdf(buf);
    } catch (e) {
      log(`  ! ${file}: ${e.message}`);
    }
    const entry = { file, title: info.title || file.replace(/\.pdf$/i, ''), pages: info.pages, size: buf.length, sha256, url: prev?.url || '' };
    if (prev) current.set(file, entry);
    else fresh.push(entry);
  }
  const list = [...fresh, ...old.filter((e) => current.has(e.file)).map((e) => current.get(e.file))];
  writePdfIndex(dir, list);
  return list;
}

// ---------- Issue のコマンド ----------
// Issue のタイトル (と本文) を PDF のコマンドとして解釈する。
//   "save pdf https://arxiv.org/abs/1706.03762"  -> { action: 'save',   targets: ['https://arxiv.org/pdf/1706.03762'] }
//   "save pdf" + 本文に添付した PDF              -> { action: 'save',   targets: ['https://github.com/user-attachments/files/…'] }
//   "delete pdf arxiv-1706.03762"                -> { action: 'delete', targets: ['arxiv-1706.03762'] }
//   "clear pdfs"                                 -> { action: 'clear',  targets: [] }
//   それ以外                                     -> { action: 'none',   targets: [] }
// save pdf の本文からは添付ファイルを、タイトルに URL が無いときは本文の URL も対象にする。
// 対象が見つからなくても save として返す (添付し忘れを Issue のコメントで知らせるため)。
export function parsePdfIssue(title, body = '') {
  const t = String(title || '').trim();
  const words = (s) => s.split(/\s+/).map((w) => w.replace(/^[<(`"'「]+|[>)`"'」,;、。]+$/g, '')).filter(Boolean);
  const urls = (re) => (String(body || '').match(re) || []).map((u) => u.replace(/[.,;:!?]+$/, ''));
  let m;
  // すべて消すコマンドは、ファイル名を書き添えた削除の書き間違いで実行されないよう、後ろに何も付かないときだけにする
  if (/^(clear|reset)\s+pdfs?$/i.test(t) || /^(delete|remove)\s+all\s+pdfs?$/i.test(t)) return { action: 'clear', targets: [] };
  if ((m = /^(?:delete|remove)\s+pdfs?\b(.*)$/i.exec(t))) {
    const targets = [...new Set(words(m[1]))];
    return targets.length ? { action: 'delete', targets } : { action: 'none', targets: [] };
  }
  if ((m = /^(?:save|store|add|fetch)\s+pdfs?\b(.*)$/i.exec(t))) {
    const fromTitle = words(m[1]).map(normalizePdfInput).filter((u) => /^https?:\/\//i.test(u));
    const fromBody = fromTitle.length ? urls(new RegExp(ATTACHMENT, 'g')) : urls(/https?:\/\/[^\s()<>"'`\]]+/g).map(normalizePdfInput);
    return { action: 'save', targets: [...new Set([...fromTitle, ...fromBody])] };
  }
  return { action: 'none', targets: [] };
}
