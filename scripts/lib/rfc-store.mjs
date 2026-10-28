// rfcs/ ディレクトリ (GitHub に格納する RFC テキスト) の操作。
// CLI (fetch-rfc.mjs / issue-command.mjs) とテストの両方から使う。
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRfc } from '../../src/rfc-parser.js';
import { parseTranslation, translatedTitle } from '../../src/translation.js';

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const defaultDir = join(repoRoot, 'rfcs');

const USER_AGENT = 'readRFCInMobile/1.0 (+https://github.com/maronnjapan/readRFCInMobile)';

export function sourcesFor(n) {
  const list = [];
  const custom = process.env.RFC_SOURCE_URL;
  if (custom && custom.includes('{n}')) list.push(custom.replace(/\{n\}/g, String(n)));
  list.push(`https://www.rfc-editor.org/rfc/rfc${n}.txt`, `https://www.ietf.org/rfc/rfc${n}.txt`);
  return list;
}

export function looksLikeRfc(text) {
  return /Request for Comments|RFC\s*:?\s*\d|Network Working Group|Internet Engineering Task Force/i.test(text.slice(0, 4000));
}

export async function fetchText(n, { log = () => {}, sources = sourcesFor } = {}) {
  let lastErr;
  for (const url of sources(n)) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!looksLikeRfc(text)) throw new Error('RFC のテキストではありません');
      return text;
    } catch (e) {
      lastErr = new Error(`${url}: ${e.message}`);
      log(`  ! ${lastErr.message}`);
    }
  }
  throw lastErr || new Error('取得元がありません');
}

export function listStored(dir = defaultDir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^rfc\d+\.txt$/.test(f))
    .map((f) => Number(f.match(/\d+/)[0]))
    .sort((a, b) => a - b);
}

// rfcs/<lang>/rfcNNNN.json (日本語訳など) があれば、その言語の題名を返す ({ ja: "訳した題名" }。題名が未訳なら空文字)
function translationTitles(dir, number, doc) {
  const out = {};
  const langs = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^[a-z]{2,3}(?:-[A-Za-z0-9]+)?$/.test(d.name))
    .map((d) => d.name)
    .sort();
  for (const lang of langs) {
    const file = join(dir, lang, `rfc${number}.json`);
    if (!existsSync(file)) continue;
    try {
      out[lang] = translatedTitle(doc, parseTranslation(JSON.parse(readFileSync(file, 'utf8')))).trim();
    } catch {
      /* 壊れた翻訳ファイルは一覧に載せない (node scripts/translation.mjs check で分かる) */
    }
  }
  return out;
}

export function reindex(dir = defaultDir) {
  mkdirSync(dir, { recursive: true });
  const list = listStored(dir).map((number) => {
    const doc = parseRfc(readFileSync(join(dir, `rfc${number}.txt`), 'utf8'), { number });
    const entry = { number, title: doc.meta.title, date: doc.meta.date || '', category: doc.meta.category || '' };
    const translations = translationTitles(dir, number, doc);
    if (Object.keys(translations).length) entry.translations = translations;
    return entry;
  });
  writeFileSync(join(dir, 'index.json'), `${JSON.stringify(list, null, 2)}\n`);
  return list;
}

export async function storeRfcs(numbers, { dir = defaultDir, force = false, log = () => {}, sources = sourcesFor } = {}) {
  mkdirSync(dir, { recursive: true });
  const result = { saved: [], skipped: [], failed: [] };
  for (const n of numbers) {
    const file = join(dir, `rfc${n}.txt`);
    if (existsSync(file) && !force) {
      log(`rfc${n}.txt は既にあります`);
      result.skipped.push(n);
      continue;
    }
    log(`RFC ${n} を取得中…`);
    try {
      writeFileSync(file, await fetchText(n, { log, sources }));
      log(`  -> ${file}`);
      result.saved.push(n);
    } catch (e) {
      log(`  x RFC ${n} の取得に失敗: ${e.message}`);
      result.failed.push({ n, error: e.message });
    }
  }
  reindex(dir);
  return result;
}

export function deleteRfcs(numbers, { dir = defaultDir, log = () => {} } = {}) {
  const result = { deleted: [], missing: [] };
  for (const n of numbers) {
    const file = join(dir, `rfc${n}.txt`);
    if (existsSync(file)) {
      unlinkSync(file);
      log(`rfc${n}.txt を削除しました`);
      result.deleted.push(n);
    } else {
      result.missing.push(n);
    }
  }
  reindex(dir);
  return result;
}

export function clearRfcs({ dir = defaultDir, log = () => {} } = {}) {
  const numbers = listStored(dir);
  const result = deleteRfcs(numbers, { dir, log });
  return { deleted: result.deleted };
}

// Issue のタイトルをコマンドとして解釈する。
//   "save rfc 9110"        -> { action: 'save',   numbers: [9110] }
//   "save rfc 9110, 6749"  -> { action: 'save',   numbers: [9110, 6749] }
//   "delete rfc 9110"      -> { action: 'delete', numbers: [9110] }
//   "clear rfcs"           -> { action: 'clear',  numbers: [] }
//   それ以外               -> { action: 'none',   numbers: [] }
export function parseIssueTitle(title) {
  const t = String(title || '').trim().toLowerCase();
  const nums = (s) => [...new Set((s.match(/\d{1,5}/g) || []).map(Number).filter((n) => n > 0))];
  let m;
  if (/^(clear|reset)\s+rfcs?\b/.test(t) || /^(delete|remove)\s+all\s+rfcs?\b/.test(t)) return { action: 'clear', numbers: [] };
  if ((m = /^(delete|remove)\s+rfcs?\b(.*)$/.exec(t))) {
    const numbers = nums(m[2]);
    return numbers.length ? { action: 'delete', numbers } : { action: 'none', numbers: [] };
  }
  if ((m = /^(save|store|add|fetch)\s+rfcs?\b(.*)$/.exec(t))) {
    const numbers = nums(m[2]);
    return numbers.length ? { action: 'save', numbers } : { action: 'none', numbers: [] };
  }
  return { action: 'none', numbers: [] };
}
