import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRfc } from '../src/rfc-parser.js';
import { renderDocument, renderInline } from '../src/render.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');

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
const allText = (doc) => {
  const parts = [];
  walk(doc.blocks, (b) => {
    if (b.text) parts.push(b.text);
    if (b.lines) parts.push(...b.lines);
    if (b.items) b.items.forEach((it) => parts.push(it.lead || '', it.term || '', it.text || ''));
  });
  return parts.join('\n');
};

test('v3 (unpaginated) text: metadata, headings, table, lists, dl, figure, refs', () => {
  const doc = parseRfc(read('fixtures/v3-sample.txt'));
  assert.equal(doc.meta.number, 99999);
  assert.equal(doc.meta.title, 'A Sample Protocol in RFCXML v3 Text');
  assert.equal(doc.meta.category, 'Standards Track');
  assert.equal(doc.meta.date, 'June 2026');
  assert.deepEqual(doc.meta.obsoletes, [1234]);
  assert.deepEqual(
    doc.meta.authors.map((a) => a.name),
    ['A. Example', 'B. Tester'],
  );

  const headings = collect(doc, 'heading');
  assert.deepEqual(
    headings.map((h) => h.id),
    ['name-abstract', 'name-status-of-this-memo', 'name-table-of-contents', 'section-1', 'section-1.1', 'section-2', 'section-3', 'section-4', 'section-5', 'section-5.1', 'appendix-A', 'name-authors-addresses'],
  );
  assert.equal(headings.find((h) => h.id === 'section-1.1').level, 2);
  assert.equal(doc.toc.length, 10, 'top-level TOC entries (Abstract, Status, ToC, 1-5, Appendix A, Authors)');
  assert.equal(doc.toc.find((t) => t.id === 'section-5').children.length, 1);

  // 元の目次ブロックは生成した目次に置き換えるので残らない
  assert.equal(collect(doc, 'tocraw').length, 0);

  const tables = collect(doc, 'table');
  assert.equal(tables.length, 1);
  assert.deepEqual(tables[0].header, [['Method', 'Description', 'Reference']]);
  assert.deepEqual(tables[0].rows[1], ['STORE', 'Replace a representation; wraps onto two lines', 'Section 3']);
  assert.equal(tables[0].caption.label, 'Table 1');
  assert.equal(tables[0].caption.text, 'SP Methods');

  const lists = collect(doc, 'list');
  const top = lists.find((l) => l.markerIndent === 3);
  assert.equal(top.items.length, 2);
  assert.equal(top.ordered, false);
  const nested = top.items[0].children.find((c) => c.type === 'list');
  assert.ok(nested, 'nested list is attached to the first item');
  assert.equal(nested.items.length, 2);
  assert.match(nested.items[1].lead, /URI reference/);

  const pres = collect(doc, 'pre');
  const art = pres.find((p) => p.kind === 'art');
  assert.ok(art && art.caption && art.caption.label === 'Figure 1', 'figure with caption');
  const code = pres.filter((p) => p.kind === 'code');
  assert.ok(code.some((p) => p.lines[0].includes('message       =')), 'ABNF kept as code');
  assert.ok(code.some((p) => p.lines[0].includes('FETCH /items/42')), 'HTTP example kept as code');
  assert.ok(code.some((p) => p.lines[0].trim() === '{'), 'JSON kept as code');

  const dls = collect(doc, 'dl');
  const fields = dls.find((d) => d.items.some((it) => it.term === 'method'));
  assert.ok(fields, 'definition list detected');
  assert.equal(fields.items.length, 3);
  assert.match(fields.items[0].lead, /MUST reject other tokens\.$/);

  const refs = collect(doc, 'refs');
  assert.equal(refs.length, 1);
  assert.deepEqual(
    refs[0].items.map((r) => r.tag),
    ['RFC2119', 'RFC3986', 'RFC8174', 'RFC9110'],
  );

  const addr = collect(doc, 'lines');
  assert.ok(addr.some((b) => b.lines.some((l) => /Alice Example/.test(l))), 'author address keeps line breaks');

  // 段落は 1 行に連結される
  const intro = collect(doc, 'para').find((p) => /Sample Protocol \(SP\)/.test(p.text));
  assert.match(intro.text, /stateless request\/response protocol that is described/);
});

test('v3 rendering: links for sections, citations, RFC numbers, BCP 14 keywords', () => {
  const doc = parseRfc(read('fixtures/v3-sample.txt'));
  const { html, tocHtml } = renderDocument(doc);
  assert.match(html, /<h3 id="section-1\.1" class="sec">/);
  assert.match(html, /<a class="xref" href="#section-2">2<\/a>/, 'internal section link');
  assert.match(html, /<a class="xref" href="#appendix-A">A<\/a>/, 'appendix link');
  assert.match(html, /<a class="xref" data-rfc="3986" href="\?rfc=3986#section-4\.1">4\.1<\/a>/, 'external section link');
  assert.match(html, /\[<a class="cite" href="#ref-RFC9110">RFC9110<\/a>\]/, 'citation links to reference entry');
  assert.match(html, /<dt id="ref-RFC9110">\[RFC9110\]<\/dt>/);
  assert.match(html, /<a class="rfc" data-rfc="2119" href="\?rfc=2119">RFC 2119<\/a>/);
  assert.match(html, /<span class="bcp14">MUST<\/span>/);
  assert.match(html, /<table><thead><tr><th>Method<\/th>/);
  assert.match(html, /<figcaption id="figure-1">/);
  assert.match(html, /<a class="xref" href="#table-1">Table 1<\/a>/);
  assert.match(html, /<details class="toc-inline">/);
  assert.match(tocHtml, /<ol class="toc"><li><a href="#name-abstract">/);
  assert.match(html, /<a class="url" href="\?rfc=2119" data-rfc="2119">https:\/\/www\.rfc-editor\.org\/info\/rfc2119<\/a>/, 'rfc-editor URL becomes an in-app link');
  assert.doesNotMatch(html, /<script/i);
});

test('classic paginated text (RFC 8259): headers/footers removed, paragraphs joined across pages', () => {
  const doc = parseRfc(read('../rfcs/rfc8259.txt'));
  assert.equal(doc.meta.number, 8259);
  assert.equal(doc.meta.title, 'The JavaScript Object Notation (JSON) Data Interchange Format');
  assert.equal(doc.meta.date, 'December 2017');
  assert.deepEqual(doc.meta.obsoletes, [7159]);
  const text = allText(doc);
  assert.doesNotMatch(text, /\[Page \d+\]/, 'page footers removed');
  assert.doesNotMatch(text, /^RFC 8259\s{3,}JSON/m, 'running headers removed');
  const headings = collect(doc, 'heading');
  assert.ok(headings.some((h) => h.id === 'section-1' && /Introduction/.test(h.text)));
  assert.ok(headings.some((h) => h.id === 'appendix-A'));
  assert.ok(headings.some((h) => h.id === 'name-authors-address' || /author/i.test(h.text)));
  assert.ok(collect(doc, 'refs').length >= 1);
  const abnf = collect(doc, 'pre').filter((p) => p.kind === 'code');
  assert.ok(abnf.some((p) => p.lines.some((l) => /begin-array\s+= ws %x5B ws/.test(l))), 'ABNF kept verbatim');
});

test('classic text (RFC 6749): figures get captions, lists and definitions', () => {
  const doc = parseRfc(read('../rfcs/rfc6749.txt'));
  assert.equal(doc.meta.title, 'The OAuth 2.0 Authorization Framework');
  const figs = collect(doc, 'pre').filter((p) => p.kind === 'art' && p.caption);
  assert.ok(figs.length >= 5, `expected several captioned figures, got ${figs.length}`);
  assert.ok(figs.some((f) => f.caption.text === 'Abstract Protocol Flow'));
  assert.doesNotMatch(allText(doc), /\[Page \d+\]/);
  assert.ok(collect(doc, 'list').length >= 10);
  assert.ok(collect(doc, 'dl').some((d) => d.items.some((it) => /^grant_type$/.test(it.term) || /^client_id$/.test(it.term))), 'parameter definitions as dl');
});

test('very old RFC (791): roman-numeral page footers and two-line headers removed', () => {
  const doc = parseRfc(read('../rfcs/rfc791.txt'));
  assert.equal(doc.meta.number, 791);
  const text = allText(doc);
  assert.doesNotMatch(text, /\[Page [ivx\d]+\]/i);
  const headings = collect(doc, 'heading');
  assert.ok(headings.some((h) => h.id === 'section-3.1' && /Internet Header Format/.test(h.text)));
  const art = collect(doc, 'pre').filter((p) => p.kind === 'art');
  assert.ok(art.some((p) => p.lines.some((l) => /\|Version\|  IHL  \|Type of Service\|/.test(l))), 'header diagram kept as art');
});

test('renderInline escapes HTML and does not link the document itself', () => {
  const ctx = { ids: new Set(['section-2']), refTags: new Set(), rfcHref: (n, f) => `?rfc=${n}${f ? `#${f}` : ''}`, number: 2616 };
  assert.equal(renderInline('a <b> & "c"', ctx), 'a &lt;b&gt; &amp; &quot;c&quot;');
  assert.equal(renderInline('see RFC 2616', ctx), 'see RFC 2616');
  assert.equal(renderInline('see Section 2 and Section 9', ctx), 'see Section <a class="xref" href="#section-2">2</a> and Section 9');
  assert.equal(renderInline('Sections 2 and 9', ctx), 'Sections <a class="xref" href="#section-2">2</a> and 9');
  assert.match(renderInline('<https://example.com/a>.', ctx), /^&lt;<a class="url" href="https:\/\/example\.com\/a" target="_blank" rel="noopener">https:\/\/example\.com\/a<\/a>&gt;\.$/);
});

test('depaginate joins a paragraph split across a page boundary', () => {
  const text = [
    'Network Working Group                                          A. Author',
    'Request for Comments: 1234                                     June 2000',
    '',
    '                              Test Title',
    '',
    '1.  Section',
    '',
    '   This paragraph is long enough to be considered prose and it continues',
    '   right at the bottom of the page without any terminating punctuation',
    '',
    '',
    'Author                      Standards Track                     [Page 1]',
    '\f',
    'RFC 1234                       Test Title                      June 2000',
    '',
    '',
    '   on the next page where it finally ends with a period.',
    '',
    '   A second paragraph.',
    '',
    'Author                      Standards Track                     [Page 2]',
  ].join('\n');
  const doc = parseRfc(text);
  const paras = collect(doc, 'para');
  assert.equal(paras.length, 2);
  assert.match(paras[0].text, /punctuation on the next page where it finally ends/);
  assert.equal(doc.meta.number, 1234);
  assert.equal(doc.meta.title, 'Test Title');
});
