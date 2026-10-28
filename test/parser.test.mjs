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
  const doc = parseRfc(read('fixtures/rfc8259.txt'));
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
  const doc = parseRfc(read('fixtures/rfc6749.txt'));
  assert.equal(doc.meta.title, 'The OAuth 2.0 Authorization Framework');
  const figs = collect(doc, 'pre').filter((p) => p.kind === 'art' && p.caption);
  assert.ok(figs.length >= 5, `expected several captioned figures, got ${figs.length}`);
  assert.ok(figs.some((f) => f.caption.text === 'Abstract Protocol Flow'));
  assert.doesNotMatch(allText(doc), /\[Page \d+\]/);
  assert.ok(collect(doc, 'list').length >= 10);
  assert.ok(collect(doc, 'dl').some((d) => d.items.some((it) => /^grant_type$/.test(it.term) || /^client_id$/.test(it.term))), 'parameter definitions as dl');
});

test('very old RFC (791): roman-numeral page footers and two-line headers removed', () => {
  const doc = parseRfc(read('fixtures/rfc791.txt'));
  assert.equal(doc.meta.number, 791);
  const text = allText(doc);
  assert.doesNotMatch(text, /\[Page [ivx\d]+\]/i);
  const headings = collect(doc, 'heading');
  assert.ok(headings.some((h) => h.id === 'section-3.1' && /Internet Header Format/.test(h.text)));
  const art = collect(doc, 'pre').filter((p) => p.kind === 'art');
  assert.ok(art.some((p) => p.lines.some((l) => /\|Version\|  IHL  \|Type of Service\|/.test(l))), 'header diagram kept as art');
  // 見開きの 3 行ヘッダー (日付 / 文書名 / 章名) も取り除く
  assert.doesNotMatch(text, /^\s*(?:Introduction|Overview|Specification)$/m, 'three-line running headers removed');
  assert.ok(!collect(doc, 'dl').some((d) => d.items.some((it) => it.term === 'Internet Protocol')));
  // ヘッダーの各フィールドの説明は、そのフィールドの定義の中に入る
  const version = collect(doc, 'dl').flatMap((d) => d.items).find((it) => it.term === 'Version');
  assert.ok(version && version.children.some((c) => c.type === 'para' && /indicates the format of the internet header/.test(c.text)));
});

// 見出し id の直後から次の見出しまでのトップレベルのブロック
const section = (doc, id) => {
  const i = doc.blocks.findIndex((b) => b.type === 'heading' && b.id === id);
  assert.ok(i >= 0, `heading ${id}`);
  const j = doc.blocks.findIndex((b, k) => k > i && b.type === 'heading');
  return doc.blocks.slice(i + 1, j < 0 ? undefined : j);
};
const codeIn = (doc, id) => section(doc, id).filter((b) => b.type === 'pre' && b.kind === 'code');

test('RFC 7591: each property description stays inside its definition list item', () => {
  const doc = parseRfc(read('fixtures/rfc7591.txt'));
  const dls = section(doc, 'section-2').filter((b) => b.type === 'dl');
  assert.equal(dls.length, 1, 'all client metadata fields are in one list');
  assert.deepEqual(
    dls[0].items.map((it) => it.term),
    ['redirect_uris', 'token_endpoint_auth_method', 'grant_types', 'response_types', 'client_name', 'client_uri', 'logo_uri', 'scope', 'contacts', 'tos_uri', 'policy_uri', 'jwks_uri', 'jwks', 'software_id', 'software_version'],
  );
  // 説明の途中の箇条書きと、その後の段落も同じ項目の説明に含まれる
  const auth = dls[0].items[1];
  assert.deepEqual(auth.children.map((c) => c.type), ['list', 'para']);
  assert.equal(auth.children[0].items.length, 3);
  assert.match(auth.children[1].text, /^Additional values can be defined/);
  assert.ok(!auth.children[1].quote, 'the continuation paragraph is not a block quote');

  // ページの先頭から始まる client_id の説明が、前のページの段落に連結されない
  const resp = section(doc, 'section-3.2.1');
  assert.equal(resp[0].type, 'para');
  assert.match(resp[0].text, /as specified by extensions to this specification\.$/);
  assert.equal(resp[1].type, 'dl');
  assert.deepEqual(resp[1].items.map((it) => it.term), ['client_id', 'client_secret', 'client_id_issued_at', 'client_secret_expires_at']);
  assert.match(resp[1].items[0].lead, /^REQUIRED\. {2}OAuth 2\.0 client identifier string\./);
});

test('RFC 7591: request and response examples are kept whole as code blocks', () => {
  const doc = parseRfc(read('fixtures/rfc7591.txt'));
  // HTTP ヘッダーと JSON 本文は、本文の継続行が浅い位置にあっても 1 つのコードブロック
  const reg = codeIn(doc, 'section-3.1');
  assert.equal(reg.length, 2);
  for (const c of reg) {
    assert.match(c.lines[0], /POST \/register HTTP\/1\.1/);
    assert.equal(c.lines[c.lines.length - 1].trim(), '}');
  }
  assert.ok(reg[1].lines.some((l) => /^ {3}qXC_jpLUt22OC6GUG63p-REw/.test(l)));
  // 改行された software_statement を含む JSON 本文が段落にならない
  const withStatement = codeIn(doc, 'section-3.1.1');
  assert.equal(withStatement.length, 1);
  assert.match(withStatement[0].lines[0], /POST \/register HTTP\/1\.1/);
  assert.ok(withStatement[0].lines.some((l) => /"software_statement": "eyJhbGciOiJSUzI1NiJ9\.$/.test(l)));
  assert.equal(withStatement[0].lines[withStatement[0].lines.length - 1].trim(), '}');
  // 改行された JWT もコード
  assert.ok(codeIn(doc, 'section-2.3').some((c) => c.lines[0].trim() === 'eyJhbGciOiJSUzI1NiJ9.' && c.lines.length === 10));
  assert.deepEqual(codeIn(doc, 'section-3.2.2').map((c) => c.lines[0].trim()), ['HTTP/1.1 400 Bad Request', 'HTTP/1.1 400 Bad Request']);
  // JSON のメンバー名や "\u30AF" を引用しているだけの説明文は段落のまま
  const human = section(doc, 'section-2.2');
  assert.ok(human.every((b) => b.type === 'para'));
  assert.ok(human.some((b) => /^Implementer's Note: Many JSON libraries/.test(b.text)));
  assert.match(allText(doc), /any human-readable fields sent without language tags/, 'words wrapped at a hyphen are joined');
});

test('RFC 7591: table rows without separators and references whose tag fills a line', () => {
  const doc = parseRfc(read('fixtures/rfc7591.txt'));
  const [table] = collect(doc, 'table');
  assert.deepEqual(table.header, [['grant_types value includes:', 'response_types value includes:']]);
  assert.equal(table.rows.length, 7);
  assert.deepEqual(table.rows[0], ['authorization_code', 'code']);
  assert.deepEqual(table.rows[6], ['urn:ietf:params:oauth:grant-type:saml2-bearer', '(none)']);

  assert.deepEqual(section(doc, 'section-7.1').map((b) => b.type), ['refs']);
  assert.deepEqual(section(doc, 'section-7.2').map((b) => b.type), ['refs']);
  const refs = collect(doc, 'refs').flatMap((r) => r.items);
  for (const tag of ['IANA.Language', 'OpenID.Discovery', 'OpenID.Registration', 'UMA-Core']) assert.ok(refs.some((r) => r.tag === tag), tag);
  assert.match(refs.find((r) => r.tag === 'IANA.Language').text, /<http:\/\/www\.iana\.org\/assignments\/language-subtag-registry>\.$/);

  const { html } = renderDocument(doc);
  assert.match(html, /\[<a class="cite" href="#ref-IANA\.Language">IANA\.Language<\/a>\]/);
  assert.match(html, /<dt>token_endpoint_auth_method<\/dt><dd><p>[^<]*<\/p><ul class="loose">/);
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

const paged = (...pages) =>
  [
    'Network Working Group                                          A. Author',
    'Request for Comments: 1234                                     June 2000',
    '',
    '                              Test Title',
    '',
    '1.  Section',
    '',
    ...pages.flatMap((lines, i) => [
      ...(i ? ['\f', 'RFC 1234                       Test Title                      June 2000', '', ''] : []),
      ...lines,
      '',
      '',
      `Author                      Standards Track                     [Page ${i + 1}]`,
    ]),
  ].join('\n');

test('depaginate keeps definition terms apart from the paragraph on the other page', () => {
  // 次のページが用語から始まる
  let doc = parseRfc(paged(
    ['   The response contains the client identifier and, if applicable, the', '   client secret.'],
    ['   client_id', '      REQUIRED.  The client identifier.', '', '   client_secret', '      OPTIONAL.  The client secret.'],
  ));
  assert.deepEqual(collect(doc, 'para').map((p) => p.text), ['The response contains the client identifier and, if applicable, the client secret.']);
  assert.deepEqual(collect(doc, 'dl')[0].items.map((it) => [it.term, it.lead]), [['client_id', 'REQUIRED.  The client identifier.'], ['client_secret', 'OPTIONAL.  The client secret.']]);

  // 用語だけがページ末尾に残る
  doc = parseRfc(paged(
    ['   The following parameters are defined:', '', '   client_id'],
    ['      REQUIRED.  OAuth 2.0 client identifier string.  It SHOULD NOT be', '      currently valid for any other registered client.'],
  ));
  const [dl] = collect(doc, 'dl');
  assert.equal(dl.items[0].term, 'client_id');
  assert.match(dl.items[0].lead, /^REQUIRED\. .* any other registered client\.$/);
});

test('grid tables without row separators get one row per line', () => {
  const doc = parseRfc([
    '1.  Section',
    '',
    '   +-----------------------------+-------------------+',
    '   | grant_types value includes: | response_types    |',
    '   |                             | value includes:   |',
    '   +-----------------------------+-------------------+',
    '   | authorization_code          | code              |',
    '   | implicit                    | token             |',
    '   | urn:ietf:params:oauth:      | (none)            |',
    '   |                             |                   |',
    '   +-----------------------------+-------------------+',
  ].join('\n'));
  const [table] = collect(doc, 'table');
  assert.deepEqual(table.header, [['grant_types value includes:', 'response_types value includes:']]);
  assert.deepEqual(table.rows, [['authorization_code', 'code'], ['implicit', 'token'], ['urn:ietf:params:oauth:', '(none)']]);
});
