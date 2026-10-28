// RFC プレーンテキスト (rfcNNNN.txt) を構造化するパーサー。
// 旧来のページ区切り付きフォーマット (RFC 1 〜 8000 番台) と、
// xml2rfc v3 のページ区切りなしフォーマット (RFC 8650 以降) の両方を扱う。
// DOM に依存しないので Node のテストからも、ブラウザからも同じコードを使う。

const PB = Symbol('page-break');
const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
const MONTH_RE = new RegExp(`\\b(?:${MONTHS})\\b`);
const DATE_RE = new RegExp(`^(?:(?:\\d{1,2}\\s+)?(?:${MONTHS})\\s+\\d{4}|(?:${MONTHS})\\s+\\d{1,2},\\s+\\d{4})$`);

const FOOTER_RE = /\[Page\s+(?:\d+|[ivxlc]+)\]\s*$/i;
const LIST_RE = /^(\s*)(?:([-*o+.•·])|(\d{1,3})[.)]|\((\d{1,3})\)|([a-zA-Z])[.)]|\(([a-zA-Z])\)|((?:x{0,3})(?:ix|iv|v?i{1,3}|v))[.)])(\s+)(\S.*)$/;
const CAPTION_RE = /^\s{3,}((?:Figure|Fig\.|Table)\s+\d+)(?:\s*[:.]\s*(.*))?$/;
const REF_RE = /^(\s*)\[([^\]\s]{1,40})\]\s+(\S.*)$/;
const GRID_SEP_RE = /^\+[=+-]+\+$/;
const ART_RE = /\+-{1,}|-{1,}\+|\+=|=\+|^\s*[|]|[|]\s*$|\|\s{2,}|\s{2,}\||\/\\|\\\/|<-{2,}|-{2,}>|<={2,}|={2,}>|^\s*\^\s*$|\s\^\s|^\s*v\s*$|-{5,}|={4,}|_{4,}|~{4,}|\|{2,}|^\s*\d( \d){7,}|(\|.*){3,}|^\s*[\\/]\s|\s[\\/]\s*$/;

const indentOf = (l) => (l.match(/^ */) || [''])[0].length;

export function parseRfc(text, options = {}) {
  const lines = depaginate(toLines(text));
  const { meta, bodyStart, headerLines, titleLines } = parseFrontMatter(lines);
  const body = lines.slice(bodyStart);
  const bodyIndent = detectBodyIndent(body);
  const ctx = {
    bodyIndent,
    inToc: false,
    inRefs: false,
    inAuthors: false,
    refTags: new Set(),
    ids: new Set(),
    headings: 0,
  };
  let blocks = classifyAll(splitBlocks(body), ctx);
  blocks = finalize(nestByIndent(blocks), ctx);
  if (ctx.headings < 2) {
    // 見出しがほぼ検出できない (非常に古い RFC など) 場合は元の目次を残す
    blocks = blocks.map((b) => (b.type === 'tocraw' ? { type: 'lines', lines: b.lines, indent: b.indent } : b));
  } else {
    blocks = blocks.filter((b) => b.type !== 'tocraw');
  }
  const toc = buildToc(blocks);
  if (!meta.number && options.number) meta.number = Number(options.number);
  if (!meta.title) meta.title = meta.number ? `RFC ${meta.number}` : 'RFC';
  return {
    meta,
    blocks,
    toc,
    refTags: [...ctx.refTags],
    ids: [...ctx.ids],
    bodyIndent,
    headerLines,
    titleLines,
  };
}

// ---------- 行の正規化とページ区切りの除去 ----------

function expandTabs(s) {
  if (!s.includes('\t')) return s;
  let col = 0;
  let out = '';
  for (const ch of s) {
    if (ch === '\t') {
      const n = 8 - (col % 8);
      out += ' '.repeat(n);
      col += n;
    } else {
      out += ch;
      col++;
    }
  }
  return out;
}

function toLines(text) {
  const out = [];
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (!raw.includes('\f')) {
      out.push(expandTabs(raw).replace(/[ \t\v ]+$/, ''));
      continue;
    }
    const parts = raw.split('\f');
    parts.forEach((p, i) => {
      if (i > 0) out.push(PB);
      const t = expandTabs(p).replace(/[ \t\v ]+$/, '');
      if (t !== '' || i === 0 && parts.length === 1) out.push(t);
    });
  }
  return out;
}

function isRunningHeader(l) {
  if (indentOf(l) > 0 && !/\s{2,}/.test(l.trim())) return false;
  const t = l.trim();
  if (/^(RFC\s?\d+|RFC-\d+|Internet-Draft|INTERNET-DRAFT|draft-[\w.-]+|Request for Comments)\b/i.test(t)) return true;
  if (DATE_RE.test(t)) return true;
  if (/^[A-Z][\w .'/()-]{2,}\s{2,}.*\s{2,}[\w ,.()/-]+$/.test(t) && MONTH_RE.test(t) && /\d{4}\s*$/.test(t)) return true;
  return false;
}

function shouldJoinAcrossPage(a, b) {
  if (a === undefined || b === undefined) return false;
  const lm = LIST_RE.exec(a);
  const ia = lm ? a.length - lm[9].length : indentOf(a);
  const ib = indentOf(b);
  if (ia !== ib || ib === 0) return false;
  if (LIST_RE.test(b) || REF_RE.test(b)) return false;
  if (/[.:!?]["')\]]*$/.test(a)) return /^\s*[a-z(]/.test(b);
  return true;
}

export function depaginate(lines) {
  const hasPB = lines.includes(PB);
  const hasFooter = lines.some((l) => l !== PB && FOOTER_RE.test(l));
  if (!hasPB && !hasFooter) return lines;
  const pages = [[]];
  for (const l of lines) {
    if (l === PB) {
      pages.push([]);
      continue;
    }
    pages[pages.length - 1].push(l);
    if (!hasPB && FOOTER_RE.test(l)) pages.push([]);
  }
  const cleaned = [];
  pages.forEach((pg, i) => {
    let end = pg.length;
    while (end > 0 && pg[end - 1].trim() === '') end--;
    if (end > 0 && FOOTER_RE.test(pg[end - 1])) {
      end--;
      while (end > 0 && pg[end - 1].trim() === '') end--;
    }
    let start = 0;
    while (start < end && pg[start].trim() === '') start++;
    if (i > 0 && start < end && isRunningHeader(pg[start])) {
      start++;
      // 2 行構成のヘッダー (古い RFC): 右寄せの短い 1 行が続く
      if (start < end && pg[start].trim() !== '' && indentOf(pg[start]) >= 24 && (start + 1 >= end || pg[start + 1].trim() === '')) start++;
      while (start < end && pg[start].trim() === '') start++;
    }
    if (start < end) cleaned.push(pg.slice(start, end));
  });
  if (!cleaned.length) return [];
  const out = [...cleaned[0]];
  for (let i = 1; i < cleaned.length; i++) {
    if (!shouldJoinAcrossPage(out[out.length - 1], cleaned[i][0])) out.push('');
    out.push(...cleaned[i]);
  }
  return out;
}

// ---------- 先頭のヘッダー (メタデータ) とタイトル ----------

const HEAD_HINT_RE = /^(Network Working Group|Internet Engineering Task Force|Request for Comments|RFC:?\s*\d|Internet-Draft|Independent Submission|Internet Research Task Force|Internet Architecture Board|Category:|Obsoletes:|Updates:|Stream:|ISSN:|STD:|BCP:|FYI:|.*(Working|Research) Group)/i;

function parseFrontMatter(lines) {
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  let j = i;
  while (j < lines.length && lines[j].trim() !== '') j++;
  const head = lines.slice(i, j);
  if (!head.some((l) => HEAD_HINT_RE.test(l.trim()))) {
    return { meta: { authors: [] }, bodyStart: 0, headerLines: [], titleLines: [] };
  }
  const meta = parseHeaderBlock(head);
  let k = j;
  while (k < lines.length && lines[k].trim() === '') k++;
  const titleLines = [];
  while (k < lines.length && lines[k].trim() !== '' && indentOf(lines[k]) >= 4 && titleLines.length < 6) {
    titleLines.push(lines[k].trim());
    k++;
  }
  if (titleLines.length) {
    const titled = titleLines.find((l) => /^Title:\s*\S/.test(l));
    if (titled) {
      meta.title = titled.replace(/^Title:\s*/, '');
      return { meta, bodyStart: k, headerLines: head, titleLines };
    }
    const draft = titleLines.find((l) => /^draft-/.test(l));
    if (draft) meta.draftName = draft;
    meta.title = titleLines.filter((l) => l !== draft).join(' ');
    return { meta, bodyStart: k, headerLines: head, titleLines };
  }
  return { meta, bodyStart: j, headerLines: head, titleLines };
}

const ORG_WORD_RE = /\b(Inc|Ltd|LLC|Corp|Corporation|University|Univ|Labs?|Laboratory|Research|Institute|Systems|Software|Networks?|Technologies|Technology|Communications|Center|Centre|Group|Company|College|Consortium|Foundation|Project|Department|Dept|Associates|Enterprises|Ventures|Solutions|Industries|Services)\b/i;
const INITIALS_NAME_RE = /^(?:[A-Z]\.(?:[- ]?[A-Z]\.)*\s*)+[A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?(?:,\s*(?:Ed\.|Jr\.|Sr\.|III|Ph\.D\.))*(?:\s*\(editor\))?$/;
const FULL_NAME_RE = /^(?:[A-Z][a-z]+\.?\s+){1,3}[A-Z][\w'-]+(?:,\s*Ed\.)?$/;

function parseHeaderBlock(head) {
  const meta = { authors: [], fields: [] };
  const right = [];
  let lastField = null;
  for (const line of head) {
    const indent = indentOf(line);
    const parts = line.trim().split(/\s{2,}/);
    let left = null;
    let rightPart = null;
    if (indent >= 20 && parts.length === 1) rightPart = parts[0];
    else {
      left = parts[0];
      if (parts.length > 1) rightPart = parts.slice(1).join(' ');
    }
    if (left) {
      const m = /^([A-Za-z][A-Za-z .-]*?):\s*(.*)$/.exec(left);
      // "RFC:  791" のように値が右側の列に落ちているケース
      if (m && !m[2] && rightPart && /^\d+$/.test(rightPart) && /^(RFC|Request for Comments)$/i.test(m[1])) {
        m[2] = rightPart;
        rightPart = null;
      }
      if (m && indent === 0) {
        lastField = { key: m[1].trim(), value: m[2].trim() };
        meta.fields.push(lastField);
      } else if (indent === 0 && !meta.fields.length) {
        lastField = { key: 'group', value: left };
        meta.fields.push(lastField);
      } else if (indent === 0 && /^Internet-Draft$/i.test(left)) {
        lastField = { key: 'Internet-Draft', value: '' };
        meta.fields.push(lastField);
      } else if (lastField) {
        lastField.value = `${lastField.value} ${left}`.trim();
      } else {
        lastField = { key: 'group', value: left };
        meta.fields.push(lastField);
      }
    }
    if (rightPart) right.push(rightPart);
  }
  const nums = (v) => (v.match(/\d{1,5}/g) || []).map(Number);
  for (const { key, value } of meta.fields) {
    const k = key.toLowerCase();
    if (k === 'request for comments' || k === 'rfc') meta.number = parseInt(value, 10) || undefined;
    else if (k === 'category' || k === 'intended status') meta.category = value;
    else if (k === 'obsoletes') meta.obsoletes = nums(value);
    else if (k === 'updates') meta.updates = nums(value);
    else if (k === 'issn') meta.issn = value;
    else if (k === 'std' || k === 'bcp' || k === 'fyi') meta.series = `${key.toUpperCase()} ${value}`;
    else if (k === 'group') meta.group = value;
    else if (k === 'internet-draft') meta.isDraft = true;
    else if (k === 'expires') meta.expires = value;
    else if (k === 'stream') meta.stream = value;
  }
  const useInitials = right.some((r) => INITIALS_NAME_RE.test(r));
  for (const r of right) {
    let rm;
    if (!meta.number && (rm = /^RFC:?\s*(\d+)$/.exec(r))) {
      meta.number = Number(rm[1]);
      continue;
    }
    if (DATE_RE.test(r)) {
      meta.date = r;
      continue;
    }
    const isName = useInitials ? INITIALS_NAME_RE.test(r) : FULL_NAME_RE.test(r) && !ORG_WORD_RE.test(r);
    if (isName) meta.authors.push({ name: r.replace(/\s*\(editor\)$/, ', Ed.'), org: '' });
    else if (meta.authors.length) {
      const a = meta.authors[meta.authors.length - 1];
      a.org = a.org ? `${a.org}, ${r}` : r;
    }
  }
  return meta;
}

// ---------- ブロック分割と分類 ----------

function detectBodyIndent(lines) {
  const counts = new Map();
  for (const l of lines) {
    if (l.trim().length >= 55) {
      const i = indentOf(l);
      counts.set(i, (counts.get(i) || 0) + 1);
    }
  }
  let best = 3;
  let bestN = 0;
  for (const [i, n] of counts) {
    if (n > bestN) {
      best = i;
      bestN = n;
    }
  }
  return bestN ? best : 3;
}

function splitBlocks(lines) {
  const blocks = [];
  let cur = null;
  lines.forEach((l, idx) => {
    if (l.trim() === '') {
      if (cur) blocks.push(cur);
      cur = null;
      return;
    }
    if (!cur) cur = { start: idx, lines: [] };
    cur.lines.push(l);
  });
  if (cur) blocks.push(cur);
  return blocks;
}

function classifyAll(rawBlocks, ctx) {
  const out = [];
  for (const rb of rawBlocks) {
    const b = classifyBlock(rb, ctx);
    if (Array.isArray(b)) out.push(...b);
    else if (b) out.push(b);
  }
  return out;
}

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';

function matchHeading(block, ctx) {
  const first = block.lines[0];
  if (indentOf(first) !== 0) return null;
  if (block.lines.length > 2) return null;
  if (block.lines.length === 2 && indentOf(block.lines[1]) === 0) return null;
  const t = first.trim();
  if (t.length > 110) return null;
  if (/(\.\s?){3,}\s*\d+\s*$/.test(t) || /\s\d{1,3}\s*$/.test(t) && /\.\s?\.\s?\./.test(t)) return null; // 目次行
  if (/^(RFC|Request for Comments|Network Working Group|Internet-Draft|Category|Obsoletes|Updates)\b/.test(t) && /:|\s{2,}/.test(t)) return null;
  const cont = block.lines.length === 2 ? ` ${block.lines[1].trim()}` : '';
  let m;
  if ((m = /^(\d+(?:\.\d+)*)\.?\s+(\S.*)$/.exec(t))) {
    const title = m[2];
    if (/[.;,]$/.test(title) && title.length > 50) return null;
    if (/^\d/.test(title)) return null;
    return { level: Math.min(m[1].split('.').length, 4), number: m[1], text: title + cont, id: `section-${m[1]}` };
  }
  if ((m = /^(?:Appendix|APPENDIX|Annex)\s+([A-Z](?:\.\d+)*)[.:]?\s+(\S.*)$/.exec(t))) {
    return { level: m[1].split('.').length, number: `Appendix ${m[1]}`, text: m[2] + cont, id: `appendix-${m[1]}`, appendix: true };
  }
  if ((m = /^([A-Z](?:\.\d+)*)\.\s+(\S.*)$/.exec(t)) && (ctx.bodyIndent >= 2 || block.lines.length === 1)) {
    if (/[.;,]$/.test(m[2]) && m[2].length > 50) return null;
    return { level: m[1].split('.').length, number: `Appendix ${m[1]}`, text: m[2] + cont, id: `appendix-${m[1]}`, appendix: true };
  }
  if (ctx.bodyIndent >= 2 && block.lines.length === 1 && !/[.;,]$/.test(t)) {
    return { level: 1, text: t, id: `name-${slug(t)}` };
  }
  if (ctx.bodyIndent < 2 && block.lines.length === 1 && /^[A-Z][A-Z0-9 ,'&:-]{2,60}$/.test(t)) {
    return { level: 1, text: t, id: `name-${slug(t)}` };
  }
  return null;
}

function uniqueId(ctx, id) {
  let u = id;
  let n = 2;
  while (ctx.ids.has(u)) u = `${id}-${n++}`;
  ctx.ids.add(u);
  return u;
}

function hasArt(lines) {
  return lines.some((l) => ART_RE.test(l));
}

function stripListMarker(l) {
  const m = LIST_RE.exec(l);
  return m ? m[9] : l.trim();
}

// 2 連以上の空白が、文末記号の直後以外にあるか (= 列揃えのテーブル / コード)
function columnar(lines) {
  let runs2 = 0;
  for (const raw of lines) {
    const t = stripListMarker(raw).replace(/[.:?!"')\]]\s{2,}/g, '$& ').replace(/[.:?!"')\]] {2,}/g, '. ');
    if (/\S {3,}\S/.test(t)) return true;
    if (/\S {2}\S/.test(t)) runs2++;
  }
  return lines.length > 1 && runs2 >= Math.max(2, Math.ceil(lines.length / 2));
}

function proseLike(lines) {
  const texts = lines.map((l) => l.trim());
  if (texts.some((t) => /[{}\\]|\s=\s|=\s*$|^\s*=|^[#%&]|^<[a-zA-Z/!?][^>]*>\s*$|^\.\.|\S {3,}\S|\|.*\|/.test(t))) return false;
  if (texts.some((t) => /[.:?!"')\]]/.test(t) ? /[^.:?!"')\]] {2}\S/.test(t) : /\S {2}\S/.test(t))) return false;
  if (texts.length === 1) {
    const t = texts[0];
    return /^["'(A-Za-z\[]/.test(t) && /[.:;!?"')\]]$/.test(t) && /\s/.test(t) && !/^[A-Z][A-Z0-9_ -]+$/.test(t) && t.split(/\s+/).length >= 4;
  }
  const body = texts.slice(0, -1);
  const longEnough = body.filter((t) => t.length >= 48).length;
  return longEnough / body.length >= 0.7;
}

function shortLines(lines) {
  return lines.length >= 2 && lines.every((l) => l.trim().length <= 45);
}

const CODE_LINE_RE = /[=;{}<>\\|*%$#^~`]|\/|^\s*[A-Za-z][\w-]*:\s|^\s*[-+]?\d+\s*$|\(\)|[,;{]\s*$|\w\([^()]*\)\s*[,;.]?\s*$|0x[0-9A-Fa-f]+|^\s*(?:if|for|while|return|def|function|class|import|struct|int|void|var|let|const|enum|opaque|select|case)\b/;

// 短い行で構成されたブロックがコードらしいか (HTTP メッセージ例、ABNF、JSON など)
function looksCode(lines) {
  const hits = lines.filter((l) => CODE_LINE_RE.test(l.trim())).length;
  return hits / lines.length >= 0.5;
}

function parseGridTable(lines) {
  const ind = Math.min(...lines.map(indentOf));
  const rows = lines.map((l) => l.slice(ind));
  if (!GRID_SEP_RE.test(rows[0]) || !GRID_SEP_RE.test(rows[rows.length - 1])) return null;
  const width = rows[0].length;
  const bounds = [];
  for (let i = 0; i < width; i++) if (rows[0][i] === '+') bounds.push(i);
  if (bounds.length < 2) return null;
  const groups = [];
  let g = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (GRID_SEP_RE.test(row)) {
      if (row.length !== width) return null;
      for (const b of bounds) if (row[b] !== '+') return null;
      groups.push({ lines: g, sepAfter: row.includes('=') ? '=' : '-' });
      g = [];
    } else {
      if (row.length !== width || row[0] !== '|' || row[width - 1] !== '|') return null;
      for (const b of bounds) if (row[b] !== '|') return null;
      g.push(row);
    }
  }
  if (g.length || !groups.length) return null;
  const toCells = (ls) => {
    const cells = bounds.slice(0, -1).map(() => []);
    for (const l of ls) {
      bounds.slice(0, -1).forEach((b, ci) => {
        const c = l.slice(b + 1, bounds[ci + 1]).trim();
        if (c) cells[ci].push(c);
      });
    }
    return cells.map((c) => c.join(' '));
  };
  const table = { header: [], rows: [] };
  groups.forEach((grp) => {
    if (!grp.lines.length) return;
    (grp.sepAfter === '=' ? table.header : table.rows).push(toCells(grp.lines));
  });
  if (!table.header.length && !table.rows.length) return null;
  return table;
}

function parseListBlock(block) {
  const items = [];
  let cur = null;
  let ordered = null;
  let rest = null;
  for (let idx = 0; idx < block.lines.length; idx++) {
    const line = block.lines[idx];
    const m = LIST_RE.exec(line);
    const ind = indentOf(line);
    const thisOrdered = m ? !m[2] : null;
    if (m && (!cur || ind === cur.markerIndent) && (ordered === null || thisOrdered === ordered) && (!cur || ind < cur.contentIndent)) {
      ordered = thisOrdered;
      cur = {
        marker: line.trim().slice(0, line.trim().length - m[9].length).trim(),
        markerIndent: ind,
        contentIndent: line.length - m[9].length,
        lead: [m[9]],
        childLines: [],
        children: [],
      };
      items.push(cur);
      continue;
    }
    if (cur && ind >= cur.contentIndent) {
      if (ind === cur.contentIndent && !cur.childLines.length && !LIST_RE.test(line)) cur.lead.push(line.trim());
      else cur.childLines.push(line);
      continue;
    }
    if (cur && ind >= cur.markerIndent && !m && !cur.childLines.length) {
      // 旧来の RFC では継続行がマーカー位置まで戻ることがある
      cur.lead.push(line.trim());
      continue;
    }
    rest = block.lines.slice(idx);
    break;
  }
  if (!items.length) return null;
  return { items, ordered, rest, markerIndent: items[0].markerIndent };
}

function classifyBlock(block, ctx) {
  const lines = block.lines;
  const indent = Math.min(...lines.map(indentOf));
  const first = lines[0];

  const h = matchHeading(block, ctx);
  if (h) {
    const text = h.text.replace(/\s+/g, ' ').trim();
    ctx.inToc = /^(table of )?contents$/i.test(text);
    ctx.inRefs = /references/i.test(text);
    ctx.inAuthors = /(author|editor)s?'?s?\s+address|contributors|acknowledg|index$/i.test(text);
    ctx.headings++;
    return { type: 'heading', level: h.level, number: h.number, text, id: uniqueId(ctx, h.id), indent: 0 };
  }

  if (lines.length === 1 && indent >= Math.max(12, ctx.bodyIndent + 6)) {
    const t = first.trim();
    if (t.length <= 60 && !/[=<>{}|\\;:]|\.\.\./.test(t) && !CAPTION_RE.test(first)) {
      let cm;
      if ((cm = /^(?:(\d+(?:\.\d+)*)\.?\s+)?([A-Z][A-Z0-9 ,'&()-]{2,})$/.exec(t)) && /[A-Z]{3}/.test(t)) {
        const title = cm[2];
        ctx.inToc = /^(table of )?contents$/i.test(title);
        ctx.inRefs = /references/i.test(title);
        ctx.inAuthors = /address|contributors|acknowledg/i.test(title);
        ctx.headings++;
        if (cm[1]) return { type: 'heading', level: Math.min(cm[1].split('.').length, 4), number: cm[1], text: title, id: uniqueId(ctx, `section-${cm[1]}`), indent: 0 };
        return { type: 'heading', level: 1, text: title, id: uniqueId(ctx, `name-${slug(title)}`), indent: 0 };
      }
      if (!ctx.inToc && !/\d$/.test(t)) return { type: 'para', text: t, indent, center: true };
    }
  }

  if (ctx.inToc) return { type: 'tocraw', lines, indent };

  let m;
  if (lines.length <= 2 && (m = CAPTION_RE.exec(first))) {
    const extra = lines.length === 2 ? ` ${lines[1].trim()}` : '';
    const label = m[1].replace(/\s+/g, ' ');
    const id = uniqueId(ctx, label.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    return { type: 'caption', label, text: ((m[2] || '') + extra).trim(), id, indent };
  }

  if (GRID_SEP_RE.test(first.trim()) && lines.some((l) => l.trim().startsWith('|'))) {
    const table = parseGridTable(lines);
    if (table) return { type: 'table', ...table, indent };
  }

  if (hasArt(lines)) return { type: 'pre', kind: 'art', lines, indent };

  if ((m = REF_RE.exec(first)) && (ctx.inRefs || lines.length === 1 || lines.slice(1).every((l) => indentOf(l) > indent))) {
    if (ctx.inRefs || /^(RFC\s?\d+|BCP\d+|STD\d+|\d{1,3}|[A-Z][\w.+/-]*)$/.test(m[2])) {
      ctx.refTags.add(m[2]);
      const text = [m[3], ...lines.slice(1).map((l) => l.trim())].join(' ');
      return { type: 'ref', tag: m[2], text, indent };
    }
  }

  if (LIST_RE.test(first)) {
    const parsed = parseListBlock(block);
    if (parsed) {
      const list = {
        type: 'list',
        ordered: parsed.ordered,
        markerIndent: parsed.markerIndent,
        indent: parsed.markerIndent,
        items: parsed.items.map((it) => ({
          marker: it.marker,
          contentIndent: it.contentIndent,
          lead: it.lead.join(' '),
          children: it.childLines.length ? classifyAll(splitBlocks(it.childLines), { ...ctx, inToc: false }) : [],
        })),
      };
      list.items.forEach((it) => {
        it.children = finalize(nestByIndent(it.children), ctx);
      });
      if (parsed.rest) {
        const restBlock = classifyBlock({ start: block.start, lines: parsed.rest }, ctx);
        return [list, ...(Array.isArray(restBlock) ? restBlock : [restBlock])];
      }
      return list;
    }
  }

  // 定義リスト風 ("用語:  説明" / 1 行目の後に深いインデントの説明が続く)
  const dl = matchDefinition(block, ctx, indent);
  if (dl) return dl;

  const deep = indent >= ctx.bodyIndent + 3;
  if (!proseLike(lines)) {
    if (!ctx.inAuthors && (looksCode(lines) || columnar(lines))) return { type: 'pre', kind: 'code', lines, indent };
    if (deep || shortLines(lines) || ctx.inAuthors) return { type: 'lines', lines, indent, center: indent >= Math.max(12, ctx.bodyIndent + 6) };
  }

  return {
    type: 'para',
    text: lines.map((l) => l.trim()).join(' '),
    indent,
    quote: indent >= ctx.bodyIndent + 3,
  };
}

function matchDefinition(block, ctx, indent) {
  const lines = block.lines;
  const first = lines[0].trim();
  const rest = lines.slice(1);
  const restDeeper = rest.length > 0 && rest.every((l) => indentOf(l) > indent);
  if (rest.length && !restDeeper) return null;
  if (LIST_RE.test(lines[0]) || REF_RE.test(lines[0]) || CAPTION_RE.test(lines[0])) return null;
  let m;
  let term;
  let lead = '';
  if ((m = /^([A-Za-z0-9"'(\[][^:]{0,48}?):\s{2,}(\S.*)$/.exec(first)) && !/[.;]/.test(m[1])) {
    term = m[1];
    lead = m[2];
  } else if (rest.length && (m = /^([A-Za-z0-9"'(\[][^:]{0,60}?):$/.exec(first))) {
    term = m[1];
  } else if (rest.length && first.length <= 50 && !/[.!?,;]$/.test(first) && !/\s{2,}/.test(first)) {
    term = first;
  } else {
    return null;
  }
  if (!rest.length && !lead) return null;
  // 空行を挟まずに続く説明文は、そのまま lead に連結する (コードや入れ子リストなら構造解析に回す)
  const uniform = rest.every((l) => indentOf(l) === indentOf(rest[0]));
  if (rest.length && uniform && !hasArt(rest) && !looksCode(rest) && !rest.some((l) => LIST_RE.test(l))) {
    return { type: 'dl', items: [{ term, lead: [lead, ...rest.map((l) => l.trim())].filter(Boolean).join(' '), children: [] }], indent };
  }
  const children = rest.length ? finalize(nestByIndent(classifyAll(splitBlocks(rest), { ...ctx, inToc: false })), ctx) : [];
  // 説明部分が 1 つの段落なら lead に連結する
  if (children.length === 1 && children[0].type === 'para' && !lead) {
    lead = children[0].text;
    children.length = 0;
  } else if (children.length >= 1 && children[0].type === 'para' && lead) {
    lead = `${lead} ${children[0].text}`;
    children.shift();
  }
  return { type: 'dl', items: [{ term, lead, children }], indent };
}

// 空行で区切られたブロック同士を、インデントに基づいてリスト項目の中へ入れ子にする
function nestByIndent(blocks) {
  const out = [];
  const stack = []; // 開いているリスト
  const lastItem = (list) => list.items[list.items.length - 1];
  for (const b of blocks) {
    if (b.type === 'heading') {
      stack.length = 0;
      out.push(b);
      continue;
    }
    if (b.type === 'list') {
      while (stack.length && stack[stack.length - 1].markerIndent > b.markerIndent) stack.pop();
      const top = stack[stack.length - 1];
      if (top && top.markerIndent === b.markerIndent && top.ordered === b.ordered) {
        top.items.push(...b.items);
        top.loose = true;
        continue;
      }
      if (top && b.markerIndent >= lastItem(top).contentIndent) {
        lastItem(top).children.push(b);
        stack.push(b);
        continue;
      }
      stack.length = 0;
      out.push(b);
      stack.push(b);
      continue;
    }
    while (stack.length && (b.indent ?? 0) < lastItem(stack[stack.length - 1]).contentIndent) stack.pop();
    if (stack.length && b.type !== 'tocraw') {
      lastItem(stack[stack.length - 1]).children.push(b);
      continue;
    }
    out.push(b);
  }
  return out;
}

// 隣接ブロックの結合 (参考文献・定義リスト) とキャプションの図への紐付け
function finalize(blocks, ctx) {
  const out = [];
  for (const b of blocks) {
    const prev = out[out.length - 1];
    if (b.type === 'ref') {
      if (prev && prev.type === 'refs') prev.items.push(b);
      else out.push({ type: 'refs', items: [b], indent: b.indent });
      continue;
    }
    if (b.type === 'dl' && prev && prev.type === 'dl' && prev.indent === b.indent) {
      prev.items.push(...b.items);
      continue;
    }
    // 空行で区切られた連続するコードブロック (ABNF の規則など) は 1 つにまとめる
    if (b.type === 'pre' && b.kind === 'code' && prev && prev.type === 'pre' && prev.kind === 'code' && prev.indent === b.indent && !prev.caption) {
      prev.lines.push('', ...b.lines);
      continue;
    }
    if (b.type === 'caption') {
      // 直前の図・表・コードに付ける。間に段落があってもその直前の図を探す (最大 2 ブロック)
      for (let k = out.length - 1; k >= Math.max(0, out.length - 2); k--) {
        const cand = out[k];
        if ((cand.type === 'pre' || cand.type === 'table' || cand.type === 'lines') && !cand.caption) {
          cand.caption = b;
          b.attached = true;
          break;
        }
      }
      if (!b.attached) out.push({ type: 'para', text: `${b.label}${b.text ? `: ${b.text}` : ''}`, indent: b.indent, center: true, id: b.id });
      continue;
    }
    if (b.type === 'list') {
      b.items.forEach((it) => {
        it.children = finalize(it.children, ctx);
      });
    }
    if (b.type === 'dl') {
      b.items.forEach((it) => {
        it.children = finalize(it.children, ctx);
      });
    }
    out.push(b);
  }
  // 連続する pre (art) で、間にキャプションのみ…などの細かい結合はしない
  return out;
}

function buildToc(blocks) {
  const root = { children: [] };
  const stack = [{ level: 0, node: root }];
  for (const b of blocks) {
    if (b.type !== 'heading') continue;
    const node = { id: b.id, number: b.number, text: b.text, level: b.level, children: [] };
    while (stack.length > 1 && stack[stack.length - 1].level >= b.level) stack.pop();
    stack[stack.length - 1].node.children.push(node);
    stack.push({ level: b.level, node });
  }
  return root.children;
}

export const _internal = { toLines, parseFrontMatter, parseGridTable, matchHeading, proseLike, columnar, LIST_RE, ART_RE };
