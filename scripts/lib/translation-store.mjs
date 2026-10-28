// GitHub に置く翻訳ファイル (rfcs/<lang>/rfcNNNN.json、pdfs/<lang>/<ID>.json) のひな形作りと検査。
// CLI (translation.mjs) とテストの両方から使う。
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseRfc } from '../../src/rfc-parser.js';
import { extractPdf } from '../../src/pdf-extract.js';
import { layoutPdf } from '../../src/pdf-layout.js';
import { completePdfMeta } from '../../src/pdf-reader.js';
import { makeTemplate, parseTranslation, stringifyTranslation, translationCoverage, rfcTranslationPath, pdfTranslationPath } from '../../src/translation.js';
import { repoRoot, fetchText } from './rfc-store.mjs';

const LANG_RE = /^[a-z]{2,3}(?:-[A-Za-z0-9]+)?$/;

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeTemplate(file, template) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, stringifyTranslation(template));
}

// 既存の翻訳ファイルを読む (なければ null)。壊れていれば Error を投げる
function readPrevious(file) {
  if (!existsSync(file)) return null;
  return parseTranslation(readJson(file));
}

function summarize(template, previous) {
  const used = template.segments.filter((s) => s.dst.trim()).length;
  return { segments: template.segments.length, translated: used, previous: !!previous };
}

// rfcs/rfcNNNN.txt (なければ rfc-editor.org から取得) を解析し、rfcs/<lang>/rfcNNNN.json のひな形を書き出す
export async function rfcTemplate(n, { root = repoRoot, lang = 'ja', out, log = () => {}, sources } = {}) {
  const txt = join(root, 'rfcs', `rfc${n}.txt`);
  let text;
  if (existsSync(txt)) text = readFileSync(txt, 'utf8');
  else {
    log(`rfcs/rfc${n}.txt がないので rfc-editor.org から取得します`);
    text = await fetchText(n, { log, ...(sources ? { sources } : {}) });
  }
  const doc = parseRfc(text, { number: n });
  const file = out || join(root, rfcTranslationPath(n, lang));
  const previous = readPrevious(file);
  const template = makeTemplate(doc, { source: { type: 'rfc', number: n, title: doc.meta.title || '' }, lang, previous });
  writeTemplate(file, template);
  return { file, ...summarize(template, previous) };
}

// PDF (ファイルのパスか URL) を解析し、pdfs/<lang>/<SHA-256 の先頭 16 文字>.json のひな形を書き出す。
// 解析はアプリ (ブラウザ) と同じ src/pdf-extract.js・src/pdf-layout.js で行うので、同じ文字列が並ぶ
export async function pdfTemplate(input, { root = repoRoot, lang = 'ja', out, log = () => {} } = {}) {
  let bytes;
  let url = '';
  let name;
  if (/^https?:\/\//i.test(input)) {
    url = input;
    log(`${url} を取得しています…`);
    const res = await fetch(url, { headers: { 'User-Agent': 'readRFCInMobile/1.0 (+https://github.com/maronnjapan/readRFCInMobile)' } });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    bytes = new Uint8Array(await res.arrayBuffer());
    // アプリと同じく、リダイレクトの前の URL の最後の部分をファイル名にする
    name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'PDF');
  } else {
    bytes = new Uint8Array(readFileSync(input));
    name = basename(input);
  }
  if (!Buffer.from(bytes.subarray(0, 1024)).toString('latin1').includes('%PDF-')) throw new Error(`${input}: PDF ファイルではないようです`);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const id = sha256.slice(0, 16);
  const pdfjs = await import(pathToFileURL(join(repoRoot, 'vendor/pdfjs/pdf.min.mjs')).href);
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(join(repoRoot, 'vendor/pdfjs/pdf.worker.min.mjs')).href;
  const task = pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 });
  let doc;
  try {
    const pdf = await task.promise;
    doc = layoutPdf(await extractPdf(pdf));
  } finally {
    await task.destroy();
  }
  completePdfMeta(doc, { name, url });
  const file = out || join(root, pdfTranslationPath(id, lang));
  const previous = readPrevious(file);
  const source = { type: 'pdf', id, sha256, name, ...(url ? { url } : {}), title: doc.meta.title || '', pages: doc.meta.pages };
  const template = makeTemplate(doc, { source, lang, previous });
  writeTemplate(file, template);
  return { file, id, ...summarize(template, previous) };
}

// rfcs/<lang>/、pdfs/<lang>/ にある翻訳ファイルの一覧
export function listTranslationFiles(root = repoRoot) {
  const out = [];
  for (const kind of ['rfc', 'pdf']) {
    const base = join(root, `${kind}s`);
    if (!existsSync(base)) continue;
    for (const lang of readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory() && LANG_RE.test(d.name)).map((d) => d.name).sort()) {
      for (const f of readdirSync(join(base, lang)).filter((x) => x.endsWith('.json')).sort()) {
        out.push({ kind, lang, file: join(base, lang, f), name: f });
      }
    }
  }
  return out;
}

// 翻訳ファイルを検査する。RFC は rfcs/rfcNNNN.txt があれば、今の解析結果と照合して訳文の数と、原文に見つからない訳文を数える
export function checkTranslations(root = repoRoot) {
  return listTranslationFiles(root).map((t) => {
    const r = { ...t, errors: [], warnings: [] };
    let tr;
    try {
      tr = parseTranslation(readJson(t.file));
    } catch (e) {
      r.errors.push(e.message);
      return r;
    }
    if (tr.lang !== t.lang) r.warnings.push(`"lang" が "${tr.lang}" ですが、${t.lang}/ に置かれています (${t.lang}/ の訳として表示します)`);
    r.segments = tr.segments.length;
    r.filled = tr.segments.filter((s) => s.dst.trim()).length;
    if (t.kind === 'rfc') {
      const m = /^rfc(\d+)\.json$/.exec(t.name);
      if (!m) {
        r.errors.push('ファイル名は rfcNNNN.json にしてください');
        return r;
      }
      const n = Number(m[1]);
      const txt = join(root, 'rfcs', `rfc${n}.txt`);
      if (!existsSync(txt)) {
        r.warnings.push(`rfcs/rfc${n}.txt がないので原文と照合していません`);
        return r;
      }
      const cov = translationCoverage(parseRfc(readFileSync(txt, 'utf8'), { number: n }), tr);
      Object.assign(r, cov);
    } else {
      const m = /^([0-9a-f]{16})\.json$/.exec(t.name);
      if (!m) r.errors.push('ファイル名は PDF の SHA-256 の先頭 16 文字 (小文字の 16 進) + .json にしてください');
      else if (tr.source?.id && tr.source.id !== m[1]) r.warnings.push(`source.id (${tr.source.id}) とファイル名が違います。アプリはファイル名で探します`);
    }
    return r;
  });
}
