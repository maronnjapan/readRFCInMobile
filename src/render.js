// パーサーの出力 (ブロック構造) を HTML 文字列に変換する。DOM 非依存。

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const refId = (tag) => `ref-${String(tag).replace(/[^A-Za-z0-9._-]/g, '_')}`;

const BCP14 = 'MUST NOT|MUST|REQUIRED|SHALL NOT|SHALL|SHOULD NOT|SHOULD|NOT RECOMMENDED|RECOMMENDED|MAY|OPTIONAL';
const SEC_NUM = String.raw`(?:[A-Z](?![a-z])|\d+)(?:\.\d+)*`;
const INLINE_RE = new RegExp(
  [
    String.raw`<(https?://[^\s<>]+)>`, // 1 <URL>
    String.raw`(https?://[^\s<>"']+)`, // 2 URL
    String.raw`\[([A-Za-z0-9][\w.+/-]{0,40})\]`, // 3 [引用タグ]
    String.raw`\b(RFC)[  ]?(\d{1,5})\b`, // 4,5 RFC 番号
    String.raw`\b(Sections?|Appendix|Appendices)\s+(${SEC_NUM}(?:\s*(?:,|and|or|through|to)\s*${SEC_NUM})*)`, // 6,7 セクション参照
    String.raw`\b(Figure|Fig\.|Table)\s+(\d{1,3})\b`, // 8,9 図表参照
    String.raw`\b(${BCP14})\b`, // 10 BCP 14 キーワード
    String.raw`\[(\d{1,3}(?:\s*[,–-]\s*\d{1,3})+)\]`, // 11 論文の番号付き引用 ([3, 12] / [5–7])
    // 日本語訳の中の参照
    String.raw`(セクション|付録)\s?(${SEC_NUM}(?:\s*(?:,|、|と|および|及び|または|又は|から|〜|～)\s*${SEC_NUM})*)`, // 12,13 セクション 4.1 / 付録 A
    String.raw`第?\s?(\d+(?:\.\d+)*)\s?節`, // 14 4.1 節
    String.raw`(図|表)\s?(\d{1,3})(?!\d|\.\d)`, // 15,16 図 1 / 表 2
  ].join('|'),
  'g',
);

function secTarget(num, isAppendix) {
  return isAppendix || /^[A-Z]/.test(num) ? `appendix-${num}` : `section-${num}`;
}

// 日本語の参照の直前に "[RFC6749] の" / "RFC 6749 の" があれば、その RFC の節を指す
const JA_EXT_RFC_RE = /(?:\[RFC\s?(\d{1,5})\]|RFC\s?(\d{1,5}))\s*の\s*$/;

// 節・付録の番号 (複数並んでいてもよい) を、文書内またはほかの RFC の該当箇所へのリンクにする
function linkSectionNums(nums, isAppendix, extRfc, ctx) {
  const numRe = new RegExp(SEC_NUM, 'g');
  let out = '';
  let pos = 0;
  let nm;
  while ((nm = numRe.exec(nums))) {
    out += esc(nums.slice(pos, nm.index));
    pos = nm.index + nm[0].length;
    const id = secTarget(nm[0], isAppendix);
    if (extRfc && ctx.rfcHref && extRfc !== ctx.number) {
      out += `<a class="xref" data-rfc="${extRfc}" href="${esc(ctx.rfcHref(extRfc, id))}">${esc(nm[0])}</a>`;
    } else if (!extRfc && ctx.ids && ctx.ids.has(id)) {
      out += `<a class="xref" href="#${id}">${esc(nm[0])}</a>`;
    } else out += esc(nm[0]);
  }
  return out + esc(nums.slice(pos));
}

export function renderInline(text, ctx, mode = 'text') {
  let out = '';
  let last = 0;
  INLINE_RE.lastIndex = 0;
  let m;
  while ((m = INLINE_RE.exec(text))) {
    out += esc(text.slice(last, m.index));
    last = m.index + m[0].length;
    const whole = m[0];
    if (m[1] || m[2]) {
      let url = m[1] || m[2];
      let trail = '';
      if (m[2]) {
        const t = /[.,;:)\]'"]+$/.exec(url);
        if (t) {
          trail = t[0];
          url = url.slice(0, -trail.length);
        }
      }
      const rfcm = /^https?:\/\/(?:www\.)?rfc-editor\.org\/(?:rfc|info)\/rfc(\d{1,5})(?:\.(?:txt|html|xml|pdf))?(?:#(.*))?$/.exec(url);
      let href = url;
      let attrs = ' target="_blank" rel="noopener"';
      if (rfcm && ctx.rfcHref) {
        href = ctx.rfcHref(Number(rfcm[1]), rfcm[2] || '');
        attrs = ` data-rfc="${rfcm[1]}"`;
      }
      out += `${m[1] ? '&lt;' : ''}<a class="url" href="${esc(href)}"${attrs}>${esc(url)}</a>${m[1] ? '&gt;' : ''}${esc(trail)}`;
      continue;
    }
    if (m[3]) {
      const tag = m[3];
      if (ctx.refTags && ctx.refTags.has(tag)) {
        out += `[<a class="cite" href="#${refId(tag)}">${esc(tag)}</a>]`;
      } else {
        const r = /^RFC\s?(\d{1,5})$/.exec(tag);
        if (r && ctx.rfcHref) out += `[<a class="cite" data-rfc="${r[1]}" href="${esc(ctx.rfcHref(Number(r[1]), ''))}">${esc(tag)}</a>]`;
        else out += esc(whole);
      }
      continue;
    }
    if (m[4]) {
      const n = Number(m[5]);
      if (ctx.rfcHref && n !== ctx.number && n > 0) {
        out += `<a class="rfc" data-rfc="${n}" href="${esc(ctx.rfcHref(n, ''))}">${esc(whole)}</a>`;
      } else out += esc(whole);
      continue;
    }
    if (m[6]) {
      if (mode === 'pre') {
        out += esc(whole);
        continue;
      }
      const isAppendix = /^Appendi/.test(m[6]);
      const after = text.slice(last);
      const ofm = /^\s+(?:of|in)\s+(?:\[RFC\s?(\d{1,5})\]|RFC\s?(\d{1,5}))/.exec(after);
      const extRfc = ofm ? Number(ofm[1] || ofm[2]) : null;
      out += esc(m[6]) + esc(m[0].slice(m[6].length, m[0].length - m[7].length)) + linkSectionNums(m[7], isAppendix, extRfc, ctx);
      continue;
    }
    if (m[12] || m[14]) {
      if (mode === 'pre') {
        out += esc(whole);
        continue;
      }
      const ofm = JA_EXT_RFC_RE.exec(text.slice(0, m.index));
      const extRfc = ofm ? Number(ofm[1] || ofm[2]) : null;
      if (m[12]) out += esc(m[12]) + esc(whole.slice(m[12].length, whole.length - m[13].length)) + linkSectionNums(m[13], m[12] === '付録', extRfc, ctx);
      else {
        const at = whole.indexOf(m[14]);
        out += esc(whole.slice(0, at)) + linkSectionNums(m[14], false, extRfc, ctx) + esc(whole.slice(at + m[14].length));
      }
      continue;
    }
    if (m[15]) {
      const ids = m[15] === '図' ? [`figure-${m[16]}`, `fig.-${m[16]}`] : [`table-${m[16]}`];
      const id = mode !== 'pre' && ctx.ids ? ids.find((x) => ctx.ids.has(x)) : null;
      out += id ? `<a class="xref" href="#${id}">${esc(whole)}</a>` : esc(whole);
      continue;
    }
    if (m[8]) {
      const id = `${m[8] === 'Fig.' ? 'figure' : m[8].toLowerCase()}-${m[9]}`;
      if (mode !== 'pre' && ctx.ids && ctx.ids.has(id)) out += `<a class="xref" href="#${id}">${esc(whole)}</a>`;
      else out += esc(whole);
      continue;
    }
    if (m[10]) {
      out += mode === 'pre' ? esc(whole) : `<span class="bcp14">${esc(whole)}</span>`;
      continue;
    }
    if (m[11]) {
      const linked = m[11].replace(/\d+/g, (num) => (ctx.refTags && ctx.refTags.has(num) ? `<a class="cite" href="#${refId(num)}">${num}</a>` : num));
      out += `[${linked}]`;
      continue;
    }
    out += esc(whole);
  }
  out += esc(text.slice(last));
  return out;
}

function stripIndent(lines) {
  const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => (l.match(/^ */) || [''])[0].length));
  return lines.map((l) => l.slice(ind));
}

function renderCaption(cap) {
  if (!cap) return '';
  return `<figcaption id="${esc(cap.id)}"><span class="caplabel">${esc(cap.label)}</span>${cap.text ? `: ${esc(cap.text)}` : ''}</figcaption>`;
}

function renderPre(b, ctx) {
  const body = stripIndent(b.lines).map((l) => renderInline(l, ctx, 'pre')).join('\n');
  const pre = `<pre class="${b.kind === 'art' ? 'art' : 'code'}">${body}</pre>`;
  if (b.caption) return `<figure class="fig">${pre}${renderCaption(b.caption)}</figure>`;
  return pre;
}

// PDF のページの一部 (図・表・数式) を切り出して表示する枠。画像は app.js が表示時に描く
function renderRegion(b) {
  const r = b.region;
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  const box = [r.x0, r.y0, r.x1, r.y1].map((v) => v.toFixed(1)).join(',');
  const label = b.alt ? ` aria-label="${esc(b.alt.slice(0, 300))}"` : '';
  const region = `<div class="pdf-region" role="img"${label} data-page="${r.page}" data-region="${box}" style="aspect-ratio: ${w.toFixed(1)} / ${h.toFixed(1)}; max-width: ${Math.round(w * 1.6)}px"></div>`;
  return `<figure class="fig pdf-fig">${region}${renderCaption(b.caption)}</figure>`;
}

function renderTable(b, ctx) {
  const cell = (c, tag) => `<${tag}>${renderInline(c, ctx)}</${tag}>`;
  const head = b.header.length ? `<thead>${b.header.map((r) => `<tr>${r.map((c) => cell(c, 'th')).join('')}</tr>`).join('')}</thead>` : '';
  const body = b.rows.length ? `<tbody>${b.rows.map((r) => `<tr>${r.map((c) => cell(c, 'td')).join('')}</tr>`).join('')}</tbody>` : '';
  const table = `<div class="tablewrap"><table>${head}${body}</table></div>`;
  return `<figure class="fig">${table}${renderCaption(b.caption)}</figure>`;
}

function listAttrs(b) {
  if (!b.ordered) return { tag: 'ul', attrs: '' };
  const first = (b.items[0] && b.items[0].marker) || '';
  let attrs = '';
  const n = /^\(?(\d+)/.exec(first);
  const letter = /^\(?([a-zA-Z])[.)]/.exec(first);
  const roman = /^\(?([ivx]+)[.)]/.exec(first);
  if (roman && !/^[ivx]$/.test(roman[1]) || roman && first.length > 2 && /^(ii|iii|iv|vi|vii|viii|ix)/.test(roman[1])) attrs = ' type="i"';
  else if (letter) attrs = ` type="${letter[1] === letter[1].toLowerCase() ? 'a' : 'A'}"${letter[1].toLowerCase() !== 'a' ? ` start="${letter[1].toLowerCase().charCodeAt(0) - 96}"` : ''}`;
  else if (n && Number(n[1]) !== 1) attrs = ` start="${Number(n[1])}"`;
  if (/^\(/.test(first)) attrs += ' class="paren"';
  return { tag: 'ol', attrs };
}

function renderList(b, ctx) {
  const { tag, attrs } = listAttrs(b);
  const items = b.items
    .map((it) => {
      const lead = it.lead ? `<p>${renderInline(it.lead, ctx)}</p>` : '';
      return `<li>${lead}${renderBlocks(it.children, ctx)}</li>`;
    })
    .join('');
  return `<${tag}${attrs}${b.loose ? ' class="loose"' : ''}>${items}</${tag}>`;
}

function renderDl(b, ctx) {
  const items = b.items
    .map((it) => {
      const lead = it.lead ? `<p>${renderInline(it.lead, ctx)}</p>` : '';
      return `<dt>${renderInline(it.term, ctx)}</dt><dd>${lead}${renderBlocks(it.children, ctx)}</dd>`;
    })
    .join('');
  return `<dl>${items}</dl>`;
}

function renderRefs(b, ctx) {
  const items = b.items
    .map((r) => `<dt id="${refId(r.tag)}">[${esc(r.tag)}]</dt><dd>${renderInline(r.text, ctx)}</dd>`)
    .join('');
  return `<dl class="refs">${items}</dl>`;
}

function renderTocTree(nodes, depth = 0) {
  if (!nodes.length) return '';
  const lis = nodes
    .map(
      (n) =>
        `<li><a href="#${esc(n.id)}">${n.number ? `<span class="secno">${esc(n.number)}</span>` : ''}<span class="toctext">${esc(n.text)}</span></a>${renderTocTree(n.children, depth + 1)}</li>`,
    )
    .join('');
  return `<ol class="toc${depth ? ' sub' : ''}">${lis}</ol>`;
}

export function renderToc(toc) {
  return renderTocTree(toc);
}

export function renderBlocks(blocks, ctx) {
  let out = '';
  for (const b of blocks) {
    switch (b.type) {
      case 'heading': {
        const lvl = Math.min(b.level + 1, 6);
        // 訳文の見出しでも、原文 (orig) で目次の見出しかを判定する
        const isToc = /^(table of )?contents$/i.test(b.orig ?? b.text);
        out += `<h${lvl} id="${esc(b.id)}" class="sec"><a href="#${esc(b.id)}">${b.number ? `<span class="secno">${esc(b.number)}</span>` : ''}${renderInline(b.text, ctx)}</a></h${lvl}>`;
        if (isToc && ctx.tocHtml) out += `<details class="toc-inline"><summary>目次を開く</summary>${ctx.tocHtml}</details>`;
        break;
      }
      case 'para': {
        const cls = [b.quote ? 'quote' : '', b.center ? 'center' : '', b.note ? 'note' : ''].filter(Boolean).join(' ');
        out += `<p${cls ? ` class="${cls}"` : ''}${b.id ? ` id="${esc(b.id)}"` : ''}>${renderInline(b.text, ctx)}</p>`;
        break;
      }
      case 'lines': {
        const body = stripIndent(b.lines).map((l) => renderInline(l, ctx)).join('<br>');
        const inner = `<p class="lines${b.center ? ' center' : ''}">${body}</p>`;
        out += b.caption ? `<figure class="fig">${inner}${renderCaption(b.caption)}</figure>` : inner;
        break;
      }
      case 'pre':
        out += renderPre(b, ctx);
        break;
      case 'figure':
        out += renderRegion(b);
        break;
      case 'table':
        out += renderTable(b, ctx);
        break;
      case 'list':
        out += renderList(b, ctx);
        break;
      case 'dl':
        out += renderDl(b, ctx);
        break;
      case 'refs':
        out += renderRefs(b, ctx);
        break;
      case 'tocraw':
        out += `<pre class="code">${stripIndent(b.lines).map(esc).join('\n')}</pre>`;
        break;
      default:
        break;
    }
  }
  return out;
}

function renderPdfHead(meta, ctx) {
  const chips = ['<span class="chip chip-num">PDF</span>'];
  if (meta.pages) chips.push(`<span class="chip">${meta.pages} ページ</span>`);
  if (meta.source) chips.push(`<span class="chip">${esc(meta.source)}</span>`);
  return `<header class="rfc-head">
  <p class="chips">${chips.join('')}</p>
  <h1 class="rfc-title">${renderInline(meta.title || '', ctx)}</h1>
  <div class="status-slot" data-status-slot></div>
</header>`;
}

export function renderHead(meta, headerLines, ctx) {
  if (meta.kind === 'pdf') return renderPdfHead(meta, ctx);
  const chips = [];
  if (meta.number) chips.push(`<span class="chip chip-num">RFC ${esc(meta.number)}</span>`);
  if (meta.isDraft && meta.draftName) chips.push(`<span class="chip">${esc(meta.draftName)}</span>`);
  if (meta.series) chips.push(`<span class="chip">${esc(meta.series)}</span>`);
  if (meta.category) chips.push(`<span class="chip">${esc(meta.category)}</span>`);
  if (meta.date) chips.push(`<span class="chip">${esc(meta.date)}</span>`);
  const rfcLinks = (nums) => nums.map((n) => `<a data-rfc="${n}" href="${esc(ctx.rfcHref(n, ''))}">RFC ${n}</a>`).join(', ');
  const rel = [];
  if (meta.obsoletes && meta.obsoletes.length) rel.push(`<span class="rel"><span class="rel-label">Obsoletes</span> ${rfcLinks(meta.obsoletes)}</span>`);
  if (meta.updates && meta.updates.length) rel.push(`<span class="rel"><span class="rel-label">Updates</span> ${rfcLinks(meta.updates)}</span>`);
  const authors = (meta.authors || [])
    .map((a) => `<span class="author">${esc(a.name)}${a.org ? ` <span class="org">(${esc(a.org)})</span>` : ''}</span>`)
    .join('<span class="sep">, </span>');
  const raw = headerLines && headerLines.length ? `<details class="rawhead"><summary>原文ヘッダー</summary><pre class="art">${esc(headerLines.join('\n'))}</pre></details>` : '';
  return `<header class="rfc-head">
  ${chips.length ? `<p class="chips">${chips.join('')}</p>` : ''}
  <h1 class="rfc-title">${renderInline(meta.title || '', ctx)}</h1>
  ${authors ? `<p class="authors">${authors}</p>` : ''}
  ${meta.group ? `<p class="group">${esc(meta.group)}</p>` : ''}
  ${rel.length ? `<p class="rels">${rel.join('')}</p>` : ''}
  <div class="status-slot" data-status-slot></div>
  ${raw}
</header>`;
}

export function renderDocument(doc, opts = {}) {
  const ctx = {
    ids: new Set(doc.ids),
    refTags: new Set(doc.refTags),
    rfcHref: opts.rfcHref || ((n, frag) => `?rfc=${n}${frag ? `#${frag}` : ''}`),
    number: doc.meta.number,
  };
  const tocHtml = renderToc(doc.toc);
  ctx.tocHtml = tocHtml;
  const head = renderHead(doc.meta, doc.headerLines, ctx);
  const body = renderBlocks(doc.blocks, ctx);
  return { html: `${head}<div class="rfc-body">${body}</div>`, tocHtml, title: doc.meta.title };
}
