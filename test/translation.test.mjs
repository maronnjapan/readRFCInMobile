import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRfc } from '../src/rfc-parser.js';
import { layoutPdf } from '../src/pdf-layout.js';
import { renderDocument, renderInline } from '../src/render.js';
import {
  FORMAT,
  collectSegments,
  applyTranslation,
  translationCoverage,
  parseTranslation,
  makeTemplate,
  stringifyTranslation,
  translatedTitle,
  rfcTranslationPath,
  pdfTranslationPath,
} from '../src/translation.js';
import { reindex } from '../scripts/lib/rfc-store.mjs';
import { reindexPdfs, loadPdfIndex } from '../scripts/lib/pdf-store.mjs';
import { rfcTemplate, pdfTemplate, checkTranslations } from '../scripts/lib/translation-store.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
const v3 = () => parseRfc(read('fixtures/v3-sample.txt'));
const rfc7591 = () => parseRfc(read('fixtures/rfc7591.txt'), { number: 7591 });

const walk = (blocks, fn) => {
  for (const b of blocks) {
    fn(b);
    if (b.type === 'list' || b.type === 'dl') b.items.forEach((it) => walk(it.children, fn));
  }
};
const collect = (doc, type) => {
  const out = [];
  walk(doc.blocks, (b) => b.type === type && out.push(b));
  return out;
};
// 文字だけを取り除いた HTML (タグ・クラス・ID・リンク先の並び) で、見た目の構造を比べる
const skeleton = (html) => html.replace(/>[^<]*</g, '><');
// すべての訳す文字列に訳文を付けた翻訳
const fullTranslation = (doc, f = (s) => `訳:${s}`) => ({ lang: 'ja', segments: collectSegments(doc).map((src) => ({ src, dst: f(src) })) });

test('collectSegments lists translatable text once, in order, and skips code, references, addresses and identifiers', () => {
  const doc = rfc7591();
  const segs = collectSegments(doc);
  assert.equal(segs[0], 'OAuth 2.0 Dynamic Client Registration Protocol', 'the title comes first');
  assert.ok(segs.includes('Abstract') && segs.includes('Introduction') && segs.includes('Security Considerations'));
  assert.equal(new Set(segs).size, segs.length, 'no duplicates');
  assert.ok(segs.some((s) => s.startsWith('This specification defines mechanisms for dynamically registering OAuth 2.0 clients')));

  const code = collect(doc, 'pre').flatMap((p) => p.lines.map((l) => l.trim())).filter((l) => l.length > 3);
  assert.ok(code.length > 20);
  for (const line of code) assert.ok(!segs.includes(line), `code line is not a segment: ${line}`);
  const refs = collect(doc, 'refs').flatMap((r) => r.items.map((it) => it.text));
  assert.ok(refs.length > 5);
  for (const r of refs) assert.ok(!segs.includes(r), 'reference entries are not translated');
  assert.ok(!segs.some((s) => /ietf@justin\.richer\.org/.test(s)), "authors' addresses are not translated");
  assert.ok(!segs.includes('client_id') && !segs.includes('urn:ietf:params:oauth:grant-type:jwt-bearer'), 'identifiers are not translated');
  assert.ok(segs.includes('Client Metadata'), 'headings with plain words are translated');
});

test('applyTranslation keeps the original structure, links, ids and table of contents', () => {
  const doc = v3();
  const before = JSON.stringify(doc);
  const { doc: ja, total, translated } = applyTranslation(doc, fullTranslation(doc));
  assert.equal(JSON.stringify(doc), before, 'the original document is not modified');
  assert.equal(translated, total);
  assert.ok(total > 20);

  const a = renderDocument(doc);
  const b = renderDocument(ja);
  assert.equal(skeleton(b.html), skeleton(a.html), 'same elements, classes, ids and links');
  assert.equal(skeleton(b.tocHtml), skeleton(a.tocHtml));
  assert.match(b.html, /<details class="toc-inline">/, 'the inline TOC stays under the translated "Table of Contents" heading');
  assert.match(b.html, /<h1 class="rfc-title">訳:A Sample Protocol in RFCXML v3 Text<\/h1>/);
  assert.match(b.html, /<figcaption id="figure-1"><span class="caplabel">図 1<\/span>: 訳:Message Flow<\/figcaption>/, 'caption label and text');
  assert.match(b.html, /<figcaption id="table-1"><span class="caplabel">表 1<\/span>/);
  assert.match(b.html, /<span class="secno">付録 A<\/span>/, 'appendix number');
  assert.match(b.tocHtml, /<span class="secno">付録 A<\/span><span class="toctext">訳:Example Exchange<\/span>/);
  assert.match(b.html, /<th>訳:Method<\/th>/, 'table cells');
  assert.match(b.html, /<dt id="ref-RFC9110">\[RFC9110\]<\/dt>/, 'references stay as they are');
  // コードと ASCII アートは原文のまま
  const codeA = a.html.match(/<pre class="(?:code|art)">[\s\S]*?<\/pre>/g);
  const codeB = b.html.match(/<pre class="(?:code|art)">[\s\S]*?<\/pre>/g);
  assert.deepEqual(codeB, codeA);
  // 著者の連絡先は訳さない
  assert.match(b.html, /Alice Example/);
});

test('missing translations fall back to the original text; matching ignores spacing, case and punctuation', () => {
  const doc = v3();
  const tr = parseTranslation({
    lang: 'ja',
    segments: [
      { src: 'abstract', dst: '概要' },
      { src: 'Introduction.', dst: 'はじめに' },
      { src: 'This sentence is not in the document.', dst: '使われない訳文' },
      { src: 'Security   Considerations', dst: '' },
    ],
  });
  const { doc: ja, total, translated } = applyTranslation(doc, tr);
  assert.equal(translated, 2);
  assert.ok(total > translated);
  const headings = collect(ja, 'heading');
  assert.equal(headings.find((h) => h.id === 'name-abstract').text, '概要');
  assert.equal(headings.find((h) => h.id === 'section-1').text, 'はじめに');
  assert.equal(headings.find((h) => h.id === 'section-1').orig, 'Introduction');
  assert.equal(headings.find((h) => h.id === 'section-4').text, doc.blocks.find((b) => b.id === 'section-4').text, 'empty dst keeps the original');
  const cov = translationCoverage(doc, tr);
  assert.deepEqual(cov.unused, ['This sentence is not in the document.']);
  assert.equal(translatedTitle(doc, tr), '');
});

test('PDF documents keep their figures (page regions) and only the text changes', () => {
  const doc = layoutPdf(JSON.parse(read('fixtures/pdf/two-column.json')));
  const { doc: ja, translated, total } = applyTranslation(doc, fullTranslation(doc));
  assert.equal(translated, total);
  const a = renderDocument(doc);
  const b = renderDocument(ja);
  assert.equal(skeleton(b.html), skeleton(a.html));
  const regions = (html) => html.match(/<div class="pdf-region"[^>]*>/g);
  assert.ok(regions(a.html).length >= 1);
  assert.deepEqual(regions(b.html), regions(a.html), 'the same areas of the same pages are cut out');
  assert.match(b.html, /<span class="caplabel">図 1<\/span>: 訳:The three stages of the reconstruction pipeline\./);
  assert.match(b.html, /<span class="caplabel">表 1<\/span>/);
  assert.equal(ja.meta.title, '訳:Reading Order Reconstruction for Mobile Document Readers');
});

test('Japanese references in translated text become links', () => {
  const ctx = { ids: new Set(['section-4.1', 'section-4.2', 'section-3', 'appendix-A', 'figure-1', 'table-2']), refTags: new Set(['RFC6749']), rfcHref: (n, f) => `?rfc=${n}${f ? `#${f}` : ''}`, number: 7591 };
  assert.equal(renderInline('セクション 4.1 および 4.2 を参照。', ctx), 'セクション <a class="xref" href="#section-4.1">4.1</a> および <a class="xref" href="#section-4.2">4.2</a> を参照。');
  assert.equal(
    renderInline('[RFC6749] のセクション 4.1', ctx),
    '[<a class="cite" href="#ref-RFC6749">RFC6749</a>] のセクション <a class="xref" data-rfc="6749" href="?rfc=6749#section-4.1">4.1</a>',
  );
  assert.equal(renderInline('RFC 6749 の 3 節', ctx), '<a class="rfc" data-rfc="6749" href="?rfc=6749">RFC 6749</a> の <a class="xref" data-rfc="6749" href="?rfc=6749#section-3">3</a> 節');
  assert.equal(renderInline('第 3 節と付録 A', ctx), '第 <a class="xref" href="#section-3">3</a> 節と付録 <a class="xref" href="#appendix-A">A</a>');
  assert.equal(renderInline('図 1 と表 2、図 9', ctx), '<a class="xref" href="#figure-1">図 1</a> と<a class="xref" href="#table-2">表 2</a>、図 9');
  assert.equal(renderInline('登録しなければならない (MUST)。', ctx), '登録しなければならない (<span class="bcp14">MUST</span>)。');
  assert.equal(renderInline('セクション 4.1 と図 1', ctx, 'pre'), 'セクション 4.1 と図 1', 'no links inside code');
});

test('parseTranslation explains what is wrong with a file', () => {
  assert.throws(() => parseTranslation([]), /オブジェクト/);
  assert.throws(() => parseTranslation({ format: 'other', segments: [] }), /format/);
  assert.throws(() => parseTranslation({ version: 2, segments: [] }), /version/);
  assert.throws(() => parseTranslation({ lang: 'ja' }), /segments/);
  assert.throws(() => parseTranslation({ segments: [{ dst: 'x' }] }), /segments\[0\].*src/);
  assert.throws(() => parseTranslation({ segments: [{ src: 'a', dst: 1 }] }), /segments\[0\].*dst/);
  const ok = parseTranslation({ segments: [{ src: 'a' }, { src: 'b', dst: null }, { src: 'c', dst: 'シー' }] });
  assert.equal(ok.lang, 'ja');
  assert.deepEqual(ok.segments.map((s) => s.dst), ['', '', 'シー']);
});

test('templates carry over existing translations and are written one segment per line', () => {
  const doc = v3();
  const first = makeTemplate(doc, { source: { type: 'rfc', number: 99999 } });
  assert.equal(first.format, FORMAT);
  assert.ok(first.segments.every((s) => s.dst === ''));
  const previous = parseTranslation({
    lang: 'ja',
    note: '途中まで訳しています',
    segments: [
      { src: 'Abstract', dst: '概要' },
      { src: 'A paragraph that was removed from the document.', dst: '消えた段落の訳' },
      { src: 'An untranslated paragraph that was removed.', dst: '' },
    ],
  });
  const next = makeTemplate(doc, { source: { type: 'rfc', number: 99999 }, previous });
  assert.equal(next.note, '途中まで訳しています');
  assert.equal(next.segments.find((s) => s.src === 'Abstract').dst, '概要');
  assert.deepEqual(next.segments.at(-1), { src: 'A paragraph that was removed from the document.', dst: '消えた段落の訳' }, 'translated entries that no longer match are kept at the end');
  assert.ok(!next.segments.some((s) => s.src === 'An untranslated paragraph that was removed.'));

  const text = stringifyTranslation(next);
  assert.deepEqual(JSON.parse(text), next);
  const lines = text.split('\n');
  const start = lines.indexOf('  "segments": [');
  const end = lines.indexOf('  ]');
  assert.equal(end - start - 1, next.segments.length, 'one line per segment');
  for (const l of lines.slice(start + 1, end)) assert.match(l, /^ {4}\{"src": ".*", "dst": ".*"\},?$/);
  assert.match(text, /"dst": "概要"/, 'Japanese is written as is, not escaped');
  assert.equal(stringifyTranslation({ lang: 'ja', segments: [] }), '{\n  "lang": "ja",\n  "segments": []\n}\n');
});

test('translation file paths', () => {
  assert.equal(rfcTranslationPath(7591), 'rfcs/ja/rfc7591.json');
  assert.equal(pdfTranslationPath('0123456789abcdef'), 'pdfs/ja/0123456789abcdef.json');
});

// rfcs/・pdfs/ を一時ディレクトリに作って、ひな形の作成・検査・index.json を確かめる
const root = mkdtempSync(join(tmpdir(), 'rfc-translation-'));
after(() => rmSync(root, { recursive: true, force: true }));

test('rfcTemplate, checkTranslations and reindex work on the rfcs/ directory', async () => {
  mkdirSync(join(root, 'rfcs'), { recursive: true });
  copyFileSync(join(here, 'fixtures/v3-sample.txt'), join(root, 'rfcs/rfc99999.txt'));
  const r1 = await rfcTemplate(99999, { root });
  assert.equal(r1.file, join(root, 'rfcs/ja/rfc99999.json'));
  assert.equal(r1.translated, 0);
  assert.ok(r1.segments > 20);

  // 訳文を書き込んでから作り直すと、訳文は引き継がれる
  const tr = JSON.parse(readFileSync(r1.file, 'utf8'));
  tr.segments.find((s) => s.src === 'A Sample Protocol in RFCXML v3 Text').dst = 'v3 形式のサンプルプロトコル';
  tr.segments.find((s) => s.src === 'Abstract').dst = '概要';
  writeFileSync(r1.file, stringifyTranslation(tr));
  const r2 = await rfcTemplate(99999, { root });
  assert.equal(r2.translated, 2);
  assert.ok(r2.previous);

  const index = reindex(join(root, 'rfcs'));
  assert.deepEqual(index[0].translations, { ja: 'v3 形式のサンプルプロトコル' });

  // 壊れたファイルと、原文に合わない訳文
  writeFileSync(join(root, 'rfcs/ja/rfc12345.json'), '{"segments": [');
  mkdirSync(join(root, 'pdfs/ja'), { recursive: true });
  writeFileSync(join(root, 'pdfs/ja/0123456789abcdef.json'), JSON.stringify({ lang: 'ja', source: { id: 'ffffffffffffffff' }, segments: [{ src: 'x', dst: 'エックス' }] }));
  writeFileSync(join(root, 'pdfs/ja/paper.json'), JSON.stringify({ segments: [] }));
  const checks = checkTranslations(root);
  const byName = Object.fromEntries(checks.map((c) => [c.name, c]));
  assert.equal(byName['rfc99999.json'].errors.length, 0);
  assert.equal(byName['rfc99999.json'].translated, 2);
  assert.ok(byName['rfc99999.json'].total > 20);
  assert.deepEqual(byName['rfc99999.json'].unused, []);
  assert.match(byName['rfc12345.json'].errors[0], /JSON|Unexpected|position/);
  assert.match(byName['0123456789abcdef.json'].warnings[0], /source\.id/);
  assert.match(byName['paper.json'].errors[0], /ファイル名/);

  // 壊れた翻訳ファイルがあっても index.json は作れる
  writeFileSync(join(root, 'rfcs/ja/rfc99999.json'), 'not json');
  assert.equal(reindex(join(root, 'rfcs'))[0].translations, undefined);
});

test('pdfTemplate names the file after the SHA-256 of the PDF, like the app does', async () => {
  // pdf.js が Node で出す警告 (canvas がない等) を抑える
  const log = console.log;
  console.log = () => {};
  let r;
  try {
    r = await pdfTemplate(join(here, 'fixtures/pdf/two-column.pdf'), { root });
  } finally {
    console.log = log;
  }
  assert.match(r.id, /^[0-9a-f]{16}$/);
  assert.equal(r.file, join(root, 'pdfs/ja', `${r.id}.json`));
  assert.ok(existsSync(r.file));
  const tr = parseTranslation(JSON.parse(readFileSync(r.file, 'utf8')));
  assert.equal(tr.source.type, 'pdf');
  assert.equal(tr.source.name, 'two-column.pdf');
  assert.equal(tr.source.sha256.slice(0, 16), r.id);
  // アプリと同じ解析結果 (テスト用データ two-column.json) の文字列が並ぶ
  const doc = layoutPdf(JSON.parse(read('fixtures/pdf/two-column.json')));
  assert.deepEqual(
    tr.segments.map((s) => s.src),
    collectSegments(doc),
  );
});

test('pdfs/index.json marks stored PDFs that have a translation in pdfs/ja/', async () => {
  const dir = join(root, 'pdfs');
  copyFileSync(join(here, 'fixtures/pdf/two-column.pdf'), join(dir, 'two-column.pdf'));
  const log = console.log;
  console.log = () => {};
  try {
    // pdfTemplate (前のテスト) が作ったひな形がある。題名はまだ訳していない
    let [entry] = await reindexPdfs({ dir });
    assert.deepEqual(entry.translations, { ja: '' });
    // 題名の訳を書き込む
    const file = join(dir, 'ja', `${entry.sha256.slice(0, 16)}.json`);
    const tr = JSON.parse(readFileSync(file, 'utf8'));
    tr.segments.find((s) => s.src === entry.title).dst = 'モバイル文書リーダーのための読み順の再構成';
    writeFileSync(file, stringifyTranslation(tr));
    [entry] = await reindexPdfs({ dir });
    assert.deepEqual(entry.translations, { ja: 'モバイル文書リーダーのための読み順の再構成' });
    assert.deepEqual(loadPdfIndex(dir), [entry]);
    // 翻訳ファイルを消すと、印も消える
    rmSync(file);
    [entry] = await reindexPdfs({ dir });
    assert.equal(entry.translations, undefined);
  } finally {
    console.log = log;
  }
});
