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
  const t = l.trim();
  // 見開きの体裁の古い RFC では、日付だけのヘッダーが右寄せになるページがある
  if (DATE_RE.test(t)) return true;
  if (indentOf(l) > 0 && !/\s{2,}/.test(t)) return false;
  if (/^(RFC\s?\d+|RFC-\d+|Internet-Draft|INTERNET-DRAFT|draft-[\w.-]+|Request for Comments)\b/i.test(t)) return true;
  if (/^[A-Z][\w .'/()-]{2,}\s{2,}.*\s{2,}[\w ,.()/-]+$/.test(t) && MONTH_RE.test(t) && /\d{4}\s*$/.test(t)) return true;
  return false;
}

// 定義リストの用語らしい 1 行 ("client_id" / "Field name:" など)
function isTermLine(l) {
  const t = l.trim();
  return t.length <= 50 && !/[.!?,;]$/.test(t) && !/\s{2,}/.test(t) && !LIST_RE.test(l) && !REF_RE.test(l) && !CODE_LINE_RE.test(t);
}

// a: 前ページ末尾の行、before: その直前の行、b: 次ページ先頭の行、next: その次の行
function shouldJoinAcrossPage(a, b, before, next) {
  if (a === undefined || b === undefined) return false;
  const lm = LIST_RE.exec(a);
  const ia = lm ? a.length - lm[9].length : indentOf(a);
  const ib = indentOf(b);
  if (ib > ia && ia > 0 && !lm && (before === undefined || before.trim() === '')) {
    const t = b.trim();
    // ページ末尾に用語だけが残り、説明文が次ページの一段深い位置から始まる
    if (isTermLine(a)) return /^[A-Za-z"'(]/.test(t) && t.split(/\s+/).length >= 4 && !CODE_LINE_RE.test(t) && !CAPTION_RE.test(b);
    // "用語:  説明" の 1 行目だけがページ末尾に残り、文の続きが一段深い位置から始まる
    if (/^\s*[A-Za-z0-9"'(\[][^:]{0,48}?:\s{2,}\S/.test(a) && !/[.!?]["')\]]*$/.test(a)) return !CAPTION_RE.test(b) && !LIST_RE.test(b);
  }
  if (ia !== ib || ib === 0) return false;
  if (LIST_RE.test(b) || REF_RE.test(b)) return false;
  // ABNF の規則や列揃えの行の後に、文章の段落が続いている
  if ((RULE_HEAD_RE.test(a) || /\S {3,}\S/.test(a.trim())) && /^\s*[A-Z]/.test(b) && proseLine(b.trim())) return false;
  if (/[.:!?]["')\]]*$/.test(a)) {
    // 次ページが「用語 + 一段深い説明」で始まるなら、前の段落の続きではない
    if (next !== undefined && next.trim() !== '' && indentOf(next) > ib) return false;
    return /^\s*[a-z(]/.test(b) && !RULE_HEAD_RE.test(b) && !/[{}]|::=/.test(b);
  }
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
      // 2〜3 行構成のヘッダー (古い RFC): 日付の反対側に寄せた短い行 (文書名・章名) が続く
      const opposite = indentOf(pg[start]) >= 24 ? (l) => indentOf(l) === 0 : (l) => indentOf(l) >= 24;
      start++;
      let k = start;
      while (k < end && k - start < 2 && pg[k].trim() !== '' && opposite(pg[k]) && pg[k].trim().length <= 40 && !/^(?:\d+(?:\.\d+)*\.?|Appendix)\s/.test(pg[k].trim())) k++;
      if (k > start && (k >= end || pg[k].trim() === '')) start = k;
      while (start < end && pg[start].trim() === '') start++;
    }
    if (start < end) cleaned.push(pg.slice(start, end));
  });
  if (!cleaned.length) return [];
  const out = [...cleaned[0]];
  for (let i = 1; i < cleaned.length; i++) {
    if (!shouldJoinAcrossPage(out[out.length - 1], cleaned[i][0], out[out.length - 2], cleaned[i][1])) out.push('');
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

// 折り返した行を 1 行につなぐ。"human-" + "readable" のようにハイフンで折り返した語や、
// "<http://example.com/" + "path>" のように途中で折り返した URL には空白を入れない
// ("400-" + "and 500-level" のような語の省略は除く)
function joinLines(texts) {
  let out = '';
  for (const t of texts) {
    if (!t) continue;
    if (!out) out = t;
    else if ((/[A-Za-z0-9]-$/.test(out) && /^[A-Za-z0-9]/.test(t) && !/^(?:and|or|nor|to)\b/.test(t)) || /<https?:\/\/[^>\s]*$/.test(out)) out += t;
    else out += ` ${t}`;
  }
  return out;
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
  // 長くても単語の区切りがほとんどない行 (フォーム形式のリクエスト本文や base64 など) は文章ではない
  if (texts.length > 1 && texts.filter((t) => t.split(/\s+/).length >= 4).length < texts.length / 2) return false;
  if (texts.length === 1) {
    const t = texts[0];
    return /^["'(A-Za-z\[]/.test(t) && /[.:;!?"')\]]$/.test(t) && /\s/.test(t) && !/^[A-Z][A-Z0-9_ -]+$/.test(t) && t.split(/\s+/).length >= 4;
  }
  const body = texts.slice(0, -1);
  const longEnough = body.filter((t) => t.length >= 48).length;
  return longEnough / body.length >= 0.7;
}

// 折り返された文章の行らしいか: 十分に長く、6 語以上で、ほとんどが英単語。
// コメント行・ヘッダー行・列揃えの行・波括弧を含む行は除く
function proseLine(t) {
  if (t.length < 50 || /^(?:[;#*]|\/\/|\/\*|--)|^[A-Za-z][\w-]*:\s|^\w{1,3}\s+-\s|[{}]|\s[;=]\s|\S {3,}\S|[^.:?!"')\]] {2,}\S/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length < 6) return false;
  return words.filter((w) => /^[("'[]*[A-Za-z0-9][A-Za-z0-9'’.-]*[)"'\].,;:!?]*$/.test(w)).length / words.length >= 0.75;
}

// "#" や "\u30AF" のような記号を引用していても、大半の行が文章なら段落として扱う
function wordy(lines) {
  if (lines.length < 2 || RULE_HEAD_RE.test(lines[0])) return false;
  const body = lines.slice(0, -1).map((l) => l.trim());
  return body.filter(proseLine).length / body.length >= 0.6;
}

function shortLines(lines) {
  return lines.length >= 2 && lines.every((l) => l.trim().length <= 45);
}

const CODE_LINE_RE = /[=;{}<>\\|*%$#^~`]|\/|^\s*[A-Za-z][\w-]*:\s|^\s*[-+]?\d+\s*$|\(\)|[,;{]\s*$|\w\([^()]*\)\s*[,;.]?\s*$|0x[0-9A-Fa-f]+|^\s*(?:if|for|while|return|def|function|class|import|struct|int|void|var|let|const|enum|opaque|select|case)\b/;
const RULE_HEAD_RE = /^\s*[A-Za-z][\w.-]*\s*(?:::=|:=|=\/|=)(?:\s|$)/;
const HTTP_START_RE = /^(?:(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\s+(?:\/|\*|https?:\/\/)\S*(?:\s+HTTP\/\d(?:\.\d)?)?|HTTP\/\d(?:\.\d)?\s+\d{3}(?:\s.*)?)$/;

// 短い行で構成されたブロックがコードらしいか (HTTP メッセージ例、ABNF、JSON など)
function looksCode(lines) {
  // 継続行を持つ ABNF / ASN.1 の規則 ("name := ..." の後に揃えた行が続く)
  if (lines.length > 1 && RULE_HEAD_RE.test(lines[0])) return true;
  const hits = lines.filter((l) => CODE_LINE_RE.test(l.trim())).length;
  return hits / lines.length >= 0.5;
}

// 形だけでコードと分かるブロック: JSON、HTTP メッセージ、改行で区切った JWT などの長いトークン
function codeShaped(lines) {
  const texts = lines.map((l) => l.trim());
  const first = texts[0];
  if (/^[{[]\s*(?:$|["{[\d-]|true|false|null)/.test(first) && /[}\]][,;]?$/.test(texts[texts.length - 1]) && (texts.length > 1 || /"\s*:|^\[\s*[\d"]/.test(first))) return true;
  if (HTTP_START_RE.test(first)) return true;
  if (texts.every((t) => !/\s/.test(t) && /[\d_./:=+~%&?-]/.test(t))) {
    const longest = Math.max(...texts.map((t) => t.length));
    return texts.length > 1 ? longest >= 20 : longest >= 40;
  }
  return false;
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
    return cells.map(joinLines);
  };
  // 行ごとの区切り線がない古い形式の表: 1 列目が埋まっている行から新しい行を始め、空なら前の行の続きとする
  const splitRows = (ls) => {
    const out = [];
    for (const l of ls) {
      if (!out.length || l.slice(bounds[0] + 1, bounds[1]).trim()) out.push([l]);
      else out[out.length - 1].push(l);
    }
    return out;
  };
  const filled = groups.filter((grp) => grp.lines.length);
  let headGroups = filled.filter((grp) => grp.sepAfter === '=');
  let bodyGroups = filled.filter((grp) => grp.sepAfter !== '=');
  // 見出しの下と表の末尾にしか区切り線がない場合は、先頭の塊を見出しとみなす
  if (!headGroups.length && bodyGroups.length === 2) {
    headGroups = [bodyGroups[0]];
    bodyGroups = [bodyGroups[1]];
  }
  const rowLines = bodyGroups.length === 1 ? splitRows(bodyGroups[0].lines) : bodyGroups.map((grp) => grp.lines);
  const table = { header: headGroups.map((grp) => toCells(grp.lines)), rows: rowLines.map(toCells) };
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
      // "2xx: Success - The action was ..." のように説明の位置に揃えた継続行
      else if (!cur.childLines.length && /^[a-z]/.test(line.trim()) && !/[.:]$/.test(cur.lead[cur.lead.length - 1]) && !CODE_LINE_RE.test(line.trim())) cur.lead.push(line.trim());
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
      const text = joinLines([m[3], ...lines.slice(1).map((l) => l.trim())]);
      return { type: 'ref', tag: m[2], text, indent };
    }
  }
  // タグが長くて 1 行を占め、書誌情報が次の行から字下げして続く参考文献 ("[IANA.Language]" など)
  if (ctx.inRefs && lines.length > 1 && (m = /^\s*\[([^\]\s]{1,40})\]$/.exec(first)) && lines.slice(1).every((l) => indentOf(l) > indent)) {
    ctx.refTags.add(m[1]);
    return { type: 'ref', tag: m[1], text: joinLines(lines.slice(1).map((l) => l.trim())), indent };
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
          lead: joinLines(it.lead),
          children: it.childLines.length ? classifyAll(splitBlocks(it.childLines), { ...ctx, inToc: false }) : [],
        })),
      };
      list.items.forEach((it) => {
        it.children = finalize(nestByIndent(it.children), ctx).map((c) => rebase(c, it.contentIndent));
      });
      if (parsed.rest) {
        const restBlock = classifyBlock({ start: block.start, lines: parsed.rest }, ctx);
        return [list, ...(Array.isArray(restBlock) ? restBlock : [restBlock])];
      }
      return list;
    }
  }

  if (!ctx.inAuthors && codeShaped(lines)) return { type: 'pre', kind: 'code', lines, indent };

  // 定義リスト風 ("用語:  説明" / 1 行目の後に深いインデントの説明が続く)
  const dl = matchDefinition(block, ctx, indent);
  if (dl) return dl;

  const deep = indent >= ctx.bodyIndent + 3;
  if (!proseLike(lines) && (ctx.inAuthors || !wordy(lines))) {
    if (!ctx.inAuthors && (looksCode(lines) || columnar(lines))) return { type: 'pre', kind: 'code', lines, indent };
    if (deep || shortLines(lines) || ctx.inAuthors) return { type: 'lines', lines, indent, center: indent >= Math.max(12, ctx.bodyIndent + 6) };
  }

  return {
    type: 'para',
    text: joinLines(lines.map((l) => l.trim())),
    indent,
    quote: indent >= ctx.bodyIndent + 3,
  };
}

// 用語の形をしたコードの断片 ("Validity ::= SEQUENCE {" / "Subject: This" など)
const TERM_CODE_RE = /[{};=]|::=|\(\)|^\/[*/]|^(?:struct|enum|select|case|union)\b|^[\w-]+:\s+\S/;

function matchDefinition(block, ctx, indent) {
  const lines = block.lines;
  const first = lines[0].trim();
  const rest = lines.slice(1);
  const restDeeper = rest.length > 0 && rest.every((l) => indentOf(l) > indent);
  if (rest.length && !restDeeper) return null;
  if (LIST_RE.test(lines[0]) || REF_RE.test(lines[0]) || CAPTION_RE.test(lines[0])) return null;
  // 中央寄せのタイトルや図の一部は定義リストではない
  if (rest.length && indent >= Math.max(12, ctx.bodyIndent + 6)) return null;
  let m;
  let term;
  let lead = '';
  let tagged = false;
  if ((m = /^([A-Za-z0-9"'(\[][^:]{0,48}?):\s{2,}(\S.*)$/.exec(first)) && !/[.;]/.test(m[1])) {
    term = m[1];
    lead = m[2];
  } else if (rest.length && (m = /^([A-Za-z0-9"'(\[][^:]{0,60}?):$/.exec(first))) {
    term = m[1];
  } else if (rest.length && first.length <= 50 && !/[.!?,;]$/.test(first) && !/\s{2,}/.test(first)) {
    term = first;
  } else if (
    // "TTL             a 32 bit signed integer ..." のように用語の右に説明を並べ、継続行を字下げする古い形式
    (m = /^(\S+(?: \S+){0,3})\s{2,}(["'(A-Za-z].*)$/.exec(first)) && m[1].length <= 30 && !/[.,;:]$/.test(m[1]) &&
    m[2].split(/\s+/).length >= 3 && (rest.length || /[.;]$/.test(m[2])) &&
    ![m[2], ...rest.map((l) => l.trim())].some((t) => /[{}\\]|\s=\s|=\s*$|^=|\S {3,}\S|\|.*\|/.test(t))
  ) {
    term = m[1];
    lead = m[2];
    tagged = true;
  } else {
    return null;
  }
  if (!rest.length && !lead) return null;
  if (TERM_CODE_RE.test(term) && !(rest.length && proseLike(rest))) return null;
  // 説明の位置。空行の後に続く段落やリストも、ここより深ければ同じ項目の説明として扱う (nestByIndent)
  const contentIndent = rest.length ? Math.min(...rest.map(indentOf)) : indent + 1;
  // 空行を挟まずに続く説明文は、そのまま lead に連結する (コードや入れ子リストなら構造解析に回す)
  const uniform = rest.every((l) => indentOf(l) === indentOf(rest[0]));
  if (rest.length && uniform && !hasArt(rest) && (tagged || !looksCode(rest)) && !rest.some((l) => LIST_RE.test(l))) {
    return { type: 'dl', items: [{ term, lead: joinLines([lead, ...rest.map((l) => l.trim())]), children: [], contentIndent }], indent };
  }
  // 1 行だけの "用語  説明" は表の 1 行かもしれないので、元の行を残す (前後がコードなら finalize でコードに戻す)
  if (tagged && !rest.length) return { type: 'dl', items: [{ term, lead, children: [], contentIndent, src: lines }], indent };
  const children = rest.length ? finalize(nestByIndent(classifyAll(splitBlocks(rest), { ...ctx, inToc: false })), ctx).map((c) => rebase(c, contentIndent)) : [];
  // 説明部分が 1 つの段落なら lead に連結する
  if (children.length === 1 && children[0].type === 'para' && !lead) {
    lead = children[0].text;
    children.length = 0;
  } else if (children.length >= 1 && children[0].type === 'para' && lead) {
    lead = joinLines([lead, children[0].text]);
    children.shift();
  }
  return { type: 'dl', items: [{ term, lead, children, contentIndent }], indent };
}

// 項目の中へ入れたブロックの引用・中央寄せを、項目の本文位置を基準に判定し直す
function rebase(b, contentIndent) {
  if (b.type === 'para' || b.type === 'lines') {
    b.center = !!b.center && b.indent >= Math.max(12, contentIndent + 6);
    if (b.type === 'para') b.quote = !b.center && b.indent >= contentIndent + 3;
  }
  return b;
}

// 空行で区切られたブロック同士を、インデントに基づいてリスト・定義リストの項目の中へ入れ子にする
function nestByIndent(blocks) {
  const out = [];
  const stack = []; // 開いているリスト・定義リスト
  const lastItem = (c) => c.items[c.items.length - 1];
  const addChild = (c, b) => {
    const item = lastItem(c);
    item.children.push(rebase(b, item.contentIndent));
  };
  for (const b of blocks) {
    if (b.type === 'heading') {
      stack.length = 0;
      out.push(b);
      continue;
    }
    if (b.type === 'list' || b.type === 'dl') {
      while (stack.length && stack[stack.length - 1].indent > b.indent) stack.pop();
      const top = stack[stack.length - 1];
      if (top && top.type === b.type && top.indent === b.indent && top.ordered === b.ordered) {
        top.items.push(...b.items);
        if (b.type === 'list') top.loose = true;
        continue;
      }
      if (top && b.indent >= lastItem(top).contentIndent) {
        addChild(top, b);
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
      addChild(stack[stack.length - 1], b);
      continue;
    }
    out.push(b);
  }
  return out;
}

const isCode = (b) => !!b && b.type === 'pre' && b.kind === 'code';
// 1 行の "用語  説明" だけでできた定義リスト (表の行かもしれない)
const rowLike = (b) => !!b && b.type === 'dl' && b.items.every((it) => it.src && !it.children.length);
const rowsToCode = (b) => ({ type: 'pre', kind: 'code', lines: b.items.flatMap((it, i) => (i ? ['', ...it.src] : it.src)), indent: b.indent });

// 隣接ブロックの結合 (参考文献・定義リスト) とキャプションの図への紐付け
function finalize(blocks, ctx) {
  const out = [];
  for (let b of blocks) {
    let prev = out[out.length - 1];
    // 列揃えのコードに挟まれた 1 行の "用語  説明" は、表の一部としてコードに戻す
    if (rowLike(b) && isCode(prev) && prev.indent === b.indent) b = rowsToCode(b);
    else if (isCode(b) && rowLike(prev) && prev.indent === b.indent) out[out.length - 1] = prev = rowsToCode(prev);
    if (b.type === 'ref') {
      if (prev && prev.type === 'refs') prev.items.push(b);
      else out.push({ type: 'refs', items: [b], indent: b.indent });
      continue;
    }
    if (b.type === 'dl' && prev && prev.type === 'dl' && prev.indent === b.indent) {
      prev.items.push(...b.items);
      continue;
    }
    // 空行で区切られた連続するコードブロック (ABNF の規則、HTTP のヘッダーと本文など) は 1 つにまとめる。
    // 本文の継続行だけが浅い位置にあることもあるので、先頭行の位置が揃っていれば同じ例とみなす
    if (
      isCode(b) && isCode(prev) && !prev.caption &&
      (prev.indent === b.indent || indentOf(prev.lines[0]) === indentOf(b.lines[0]))
    ) {
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
