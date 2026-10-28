import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { layoutPdf, docToText, _internal } from '../src/pdf-layout.js';
import { renderDocument, renderInline } from '../src/render.js';
import { normalizePdfInput } from '../src/pdf-reader.js';

// fixtures/pdf/*.json は scripts/pdf-extract.mjs で PDF から取り出したデータ (作り方は fixtures/pdf/make-*.py)
const here = dirname(fileURLToPath(import.meta.url));
const load = (name) => JSON.parse(readFileSync(join(here, 'fixtures/pdf', name), 'utf8'));

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

test('two-column paper: title, headings, reading order across columns and pages, hyphenation', () => {
  const doc = layoutPdf(load('two-column.json'));
  assert.equal(doc.meta.kind, 'pdf');
  assert.equal(doc.meta.title, 'Reading Order Reconstruction for Mobile Document Readers');

  const headings = collect(doc, 'heading');
  assert.deepEqual(
    headings.map((h) => h.id),
    ['name-abstract', 'section-1', 'section-2', 'section-2.1', 'section-3', 'section-4', 'name-references'],
  );
  assert.equal(headings.find((h) => h.id === 'section-2.1').level, 2);
  assert.equal(headings.find((h) => h.id === 'name-abstract').level, 1);
  assert.equal(doc.toc.find((t) => t.id === 'section-2').children.length, 1);

  // 元の段落がそのまま (段・ページをまたいでも、行末のハイフンを直した上で) 復元されている
  const paras = collect(doc, 'para').map((p) => p.text);
  for (const [key, text] of Object.entries(load('two-column.paras.json'))) {
    assert.ok(paras.includes(text), `paragraph "${key}" was not reconstructed`);
  }

  // ランニングヘッダーとページ番号は消える
  const text = docToText(doc);
  assert.doesNotMatch(text, /Preprint/);
  assert.doesNotMatch(text, /^\s*[12]\s*$/m);

  // 著者 (前付け) は行のまま
  assert.deepEqual(collect(doc, 'lines')[0].lines, ['Alice Example¹ and Bob Sample', 'Example University']);

  const lists = collect(doc, 'list');
  assert.equal(lists.length, 1);
  assert.deepEqual(
    lists[0].items.map((it) => it.lead),
    ['a reading order algorithm that handles two-column pages and full-width titles;', 'a paragraph segmentation rule based on indentation and spacing.'],
  );

  // 図・表はページから切り出す領域になり、キャプションが付く。数式も領域になる
  const figures = collect(doc, 'figure');
  const fig1 = figures.find((f) => f.caption && f.caption.label === 'Figure 1');
  assert.ok(fig1, 'Figure 1');
  assert.equal(fig1.caption.id, 'figure-1');
  assert.equal(fig1.region.page, 0);
  assert.ok(fig1.region.x0 > 300, 'figure 1 is in the right column');
  assert.ok(figures.some((f) => f.caption && f.caption.label === 'Table 1'));
  assert.ok(figures.some((f) => !f.caption && /\(1\)/.test(f.alt)), 'displayed equation');
  assert.ok(doc.ids.includes('table-1'));

  const code = collect(doc, 'pre');
  assert.equal(code.length, 1);
  assert.equal(code[0].lines[0], 'function isHeader(line, pages) {');
  assert.equal(code[0].lines[1], '  const key = normalize(line.text);');
  assert.equal(code[0].caption.label, 'Listing 1');

  const notes = collect(doc, 'para').filter((p) => p.note);
  assert.equal(notes.length, 1);
  assert.match(notes[0].text, /^1 Work done while the author was visiting/);

  const refs = collect(doc, 'refs');
  assert.equal(refs.length, 1);
  assert.deepEqual(
    refs[0].items.map((r) => r.tag),
    ['1', '2', '3'],
  );
  assert.match(refs[0].items[1].text, / https:\/\/research\.example\.org\/papers\/hybrid-page-layout-analysis-tab-stops\.pdf$/);
  assert.deepEqual(doc.refTags, ['1', '2', '3']);
});

test('NIST-like tagged PDF: headings from tags and bookmarks, tables, lists, code, references', () => {
  const doc = layoutPdf(load('nist-like.json'));
  assert.equal(doc.meta.title, 'NIST Special Publication 800-999');

  const headings = collect(doc, 'heading');
  assert.deepEqual(
    headings.map((h) => h.id),
    ['name-abstract', 'name-keywords', 'name-table-of-contents', 'section-1', 'section-2', 'section-2.1', 'section-3', 'section-3.1', 'name-references'],
  );
  assert.equal(headings.find((h) => h.id === 'section-2.1').level, 2);
  assert.equal(headings.find((h) => h.id === 'section-3').level, 1);

  const text = docToText(doc);
  // 元の目次 (点線とページ番号) は捨て、見出しから目次を作る
  assert.doesNotMatch(text, /\.{5,}/);
  // ヘッダー・フッター (Artifact) は消える。表紙の本文にある同じ文は残る
  assert.doesNotMatch(text, /EXAMPLE DIGITAL GUIDELINES/);
  assert.equal(text.match(/available free of charge/g).length, 1);

  const lists = collect(doc, 'list');
  assert.equal(lists.length, 2);
  assert.equal(lists[0].ordered, false);
  assert.equal(lists[0].items.length, 3);
  assert.equal(lists[0].items[1].lead, 'The verifier SHALL use approved encryption and an authenticated protected channel when requesting memorized secrets in order to provide resistance to eavesdropping and machine-in-the-middle attacks.');
  assert.equal(lists[1].ordered, true);
  assert.deepEqual(
    lists[1].items.map((it) => it.lead),
    ['Specific terms in CAPITALS represent normative requirements.', 'Terms in italics represent defined terms in the glossary.'],
  );

  const tables = collect(doc, 'table');
  assert.equal(tables.length, 1);
  const rows = [...tables[0].header, ...tables[0].rows];
  assert.deepEqual(rows[0], ['Requirement', 'AAL1', 'AAL2', 'AAL3']);
  assert.deepEqual(rows[2], ['Reauthentication', '30 days', '12 hours, or 30 minutes of inactivity', '12 hours, or 15 minutes of inactivity']);
  assert.equal(tables[0].caption.label, 'Table 1');

  const code = collect(doc, 'pre');
  assert.equal(code.length, 1);
  assert.deepEqual(code[0].lines, ['POST /authenticate HTTP/1.1', 'Host: verifier.example.gov', 'Content-Type: application/json', '', '{"otp": "123456"}']);

  const refs = collect(doc, 'refs');
  assert.deepEqual(
    refs[0].items.map((r) => r.tag),
    ['FIPS140', 'SP800-63'],
  );

  const { html, tocHtml } = renderDocument(doc);
  assert.match(html, /\[<a class="cite" href="#ref-SP800-63">SP800-63<\/a>\]/);
  assert.match(html, /<a class="xref" href="#section-3">3<\/a>/, 'Section 3 links to the heading');
  assert.match(html, /<a class="xref" href="#table-1">Table 1<\/a>/);
  assert.match(html, /<span class="bcp14">SHALL<\/span>/);
  assert.match(tocHtml, /href="#section-2\.1"/);
});

test('rendering PDF documents: header, figure placeholders, notes and numeric citations', () => {
  const doc = layoutPdf(load('two-column.json'));
  const { html } = renderDocument(doc);
  assert.match(html, /<span class="chip chip-num">PDF<\/span>/);
  assert.match(html, /<span class="chip">2 ページ<\/span>/);
  assert.match(html, /<div class="pdf-region" role="img"[^>]* data-page="0" data-region="[\d.,]+" style="aspect-ratio: [\d.]+ \/ [\d.]+;/);
  assert.match(html, /<figcaption id="figure-1"><span class="caplabel">Figure 1<\/span>: The three stages/);
  assert.match(html, /<p class="note">1 Work done/);

  const ctx = { refTags: new Set(['1', '2', '3', '5']) };
  assert.equal(
    renderInline('see [1, 3] and [2–5]', ctx),
    'see [<a class="cite" href="#ref-1">1</a>, <a class="cite" href="#ref-3">3</a>] and [<a class="cite" href="#ref-2">2</a>–<a class="cite" href="#ref-5">5</a>]',
  );
  assert.equal(renderInline('as shown in Fig. 2', { ids: new Set(['figure-2']) }), 'as shown in <a class="xref" href="#figure-2">Fig. 2</a>');
});

// ---------- 個々の処理 ----------

const item = (s, x, y, w, h = 10, f = 0) => ({ s, x, y, w, h, f });

test('column detection orders the left column before the right one, keeping full-width lines in place', () => {
  const items = [item('A Title That Spans Both Columns', 150, 60, 312, 18)];
  for (let i = 0; i < 12; i++) {
    items.push(item(`left line ${i} with enough words to fill the column`, 54, 100 + i * 12, 240));
    items.push(item(`right line ${i} with enough words to fill the column`, 318, 100 + i * 12, 240));
  }
  const data = { pages: [{ w: 612, h: 792, items }], fonts: [{ id: 'f', family: 'serif' }], elems: [], outline: [] };
  const pages = _internal.debugPages(data);
  assert.deepEqual(pages[0].gutter.length, 2);
  const order = pages[0].lines.map((l) => l.text);
  assert.equal(order[0], 'A Title That Spans Both Columns');
  assert.equal(order[1], 'left line 0 with enough words to fill the column');
  assert.equal(order[12], 'left line 11 with enough words to fill the column');
  assert.equal(order[13], 'right line 0 with enough words to fill the column');
});

test('superscripts are attached to their line and converted', () => {
  const rows = _internal.buildRows([item('Alice Example', 100, 100, 60, 12), item('1', 160.2, 96, 4, 8), item(', Bob', 165, 100, 25, 12)]);
  assert.equal(rows.length, 1);
  const line = _internal.makeLine(rows[0].items, 0, 'F', { fonts: [] });
  assert.equal(line.text, 'Alice Example¹, Bob');
});

test('line joining repairs hyphenation but keeps compound words', () => {
  const ctx = { vocab: new Set(['state-of-the-art', 'attacker', 'controlled', 'reconstruction']), justified: true };
  const join = (...texts) => _internal.joinText(texts.map((text) => ({ text })), ctx);
  assert.equal(join('the recon-', 'struction of text'), 'the reconstruction of text');
  assert.equal(join('an attacker-', 'controlled value'), 'an attacker-controlled value');
  assert.equal(join('a state-of-the-', 'art method'), 'a state-of-the-art method');
  assert.equal(join('see https://example.org/a/', 'b/c.pdf'), 'see https://example.org/a/b/c.pdf');
  assert.equal(join('日本語の文章は', '空白を入れずにつなぐ'), '日本語の文章は空白を入れずにつなぐ');
  assert.equal(join('first line', 'second line'), 'first line second line');
});

test('normalizePdfInput turns arXiv ids and pages into PDF URLs', () => {
  assert.equal(normalizePdfInput('1706.03762'), 'https://arxiv.org/pdf/1706.03762');
  assert.equal(normalizePdfInput('arXiv:2101.00001v2'), 'https://arxiv.org/pdf/2101.00001v2');
  assert.equal(normalizePdfInput('https://arxiv.org/abs/1706.03762'), 'https://arxiv.org/pdf/1706.03762');
  assert.equal(normalizePdfInput('https://arxiv.org/pdf/1706.03762v7.pdf'), 'https://arxiv.org/pdf/1706.03762v7');
  assert.equal(normalizePdfInput('hep-th/9901001'), 'https://arxiv.org/pdf/hep-th/9901001');
  assert.equal(normalizePdfInput(' https://example.com/paper.pdf '), 'https://example.com/paper.pdf');
});
