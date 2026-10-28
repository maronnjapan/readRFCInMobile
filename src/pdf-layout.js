// PDF から取り出した文字の位置情報 (pdf-extract.js の出力) を、RFC パーサー (rfc-parser.js) と
// 同じブロック構造に組み立てる。render.js でそのまま HTML にできる。
// 段組の検出 → 行の組み立て → ヘッダー・フッターの除去 → 段落への分割 → 見出し・リスト・図表・参考文献の判定 の順に処理する。
// 論文 (2 段組の LaTeX) と NIST SP のような Word 由来の文書 (Tagged PDF) を主な対象にしている。
// DOM に依存しないので Node のテストからも、ブラウザからも同じコードを使う。

const SUP_MAP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '(': '⁽', ')': '⁾', a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ', k: 'ᵏ', l: 'ˡ', m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', r: 'ʳ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ' };
// 行頭の箇条書き記号 (Word の Symbol / Wingdings フォントの記号は私用領域 U+F0xx になる)
const BULLET_RE = /^([•◦▪▫‣⁃∙●○■□►▶➢➤✓✔❖◆◇–—\-*·\uf000-\uf0ff])\s*(?=\S)/;
const ENUM_RE = /^(\(?(?:\d{1,2}|[a-z]|[ivx]{1,4})[.)])\s+(?=\S)/;
const CAPTION_RE = /^(Figure|Fig\.|FIGURE|Table|TABLE|Listing|Algorithm|Exhibit)\s+((?:\d+|[IVXL]+|[A-Z])(?:[.-]\d+)?[a-z]?)(?:\s*[.:—–-]\s*|\s+(?=[A-Z])|$)/;
const REFS_HEAD_RE = /^(?:\d+(?:\.\d+)*\.?\s+|[IVX]+\.\s+)?(references|bibliography|works cited|literature cited|citations)$/i;
const KNOWN_HEAD_RE = /^(abstract|introduction|related work|background|conclusions?|discussion|acknowledg(?:e)?ments?|references|bibliography|appendix|appendices|executive summary|keywords|index terms|foreword|preface|glossary|summary|table of contents|contents|list of figures|list of tables|acronyms|abbreviations)$/i;
const NUM_HEAD_RE = /^((?:\d+\.)*\d+)\.?\s+(\S.*)$/;
const ROMAN_HEAD_RE = /^([IVX]{1,5})\.\s+(\S.*)$/;
const LETTER_HEAD_RE = /^([A-Z])(?:\.\s+|\s+(?=[A-Z]))(\S.*)$/;
const APPENDIX_HEAD_RE = /^(?:Appendix|APPENDIX|Annex|ANNEX)\s+([A-Z](?:\.\d+)*)(?:[.:—–-]\s*|\s+|$)(.*)$/;
const TOC_LINE_RE = /(?:\.\s?){4,}\s*(?:\d+|[ivxlc]+)\s*$|\s(?:\d{1,4}|[ivxlc]{1,5})$/i;
const PAGE_NUM_RE = /^(?:page\s+)?(?:[-–—]\s*)?(?:\d{1,4}|[ivxlc]{1,6})(?:\s*[-–—])?(?:\s*(?:of|\/)\s*\d{1,4})?$/i;
const CJK_RE = /[\u3000-\u30ff\u3400-\u9fff\uf900-\ufaff\uff00-\uffef]/;
const MATH_CHAR_RE = /[\u0391-\u03a9\u03b1-\u03c9\u2200-\u22ff\u2190-\u21ff\u27e8-\u27ef∑∏∫√∞≈≠≤≥±×÷′″\u{1d400}-\u{1d7ff}]/gu;
const SENT_END_RE = /[.!?:;]["'”’)\]]*$/;

const round = (v, step = 0.5) => Math.round(v / step) * step;
const sum = (arr, fn = (x) => x) => arr.reduce((a, x) => a + fn(x), 0);
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';

// 重み付きの最頻値
function mode(entries) {
  const m = new Map();
  for (const [k, w] of entries) m.set(k, (m.get(k) || 0) + w);
  let best = null;
  let bestW = -1;
  for (const [k, w] of m) {
    if (w > bestW) {
      best = k;
      bestW = w;
    }
  }
  return best;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const s = values.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)))];
}

// ---------- 入口 ----------

export function layoutPdf(data, options = {}) {
  const ctx = makeContext(data, options);
  // ページごとに行を組み立て、読み順に並べる
  const prepared = data.pages.map((p, i) => preparePage(p, i, ctx));
  decideGutters(prepared, ctx);
  const pages = prepared.map((pp) => buildPageLines(pp, ctx));
  removeRunningLines(pages, ctx);
  ctx.textBox = pages.map((pg) => ({
    top: pg.lines.length ? Math.min(...pg.lines.map((l) => l.top)) : 0,
    bottom: pg.lines.length ? Math.max(...pg.lines.map((l) => l.bottom)) : pg.h,
  }));
  computeGeometry(pages, ctx);
  matchOutline(pages, ctx);
  let blocks = [];
  pages.forEach((pg) => {
    blocks.push(...pageBlocks(pg, ctx));
  });
  const doc = assemble(blocks, ctx);
  return doc;
}

function makeContext(data, options) {
  const fonts = data.fonts || [];
  const elems = data.elems || [];
  const sizeVotes = [];
  const fontVotes = [];
  for (const p of data.pages) {
    for (const it of p.items) {
      if (it.a) continue;
      const n = it.s.trim().length;
      sizeVotes.push([round(it.h), n]);
    }
  }
  const bodySize = mode(sizeVotes) || 10;
  for (const p of data.pages) {
    for (const it of p.items) if (!it.a && Math.abs(it.h - bodySize) < 0.6) fontVotes.push([it.f, it.s.trim().length]);
  }
  return {
    data,
    options,
    fonts,
    elems,
    tagged: elems.length > 0,
    bodySize,
    bodyFont: mode(fontVotes),
    lineGap: bodySize * 1.2,
    ids: new Set(),
    refTags: new Set(),
    numPages: data.pages.length,
    outlineHits: new Map(),
  };
}

// ---------- タグ (Tagged PDF) ----------

function roleChain(ctx, e) {
  const chain = [];
  for (let k = e; k !== undefined && k >= 0 && chain.length < 12; k = ctx.elems[k]?.p) chain.push({ r: ctx.elems[k].r, e: k });
  return chain;
}

// 行やブロックの役割を、構造要素の祖先から決める
function tagRole(ctx, e) {
  if (!ctx.tagged || e === undefined) return null;
  for (const { r, e: id } of roleChain(ctx, e)) {
    if (/^H[1-6]?$/.test(r) || r === 'Title') return { kind: 'heading', level: r === 'Title' ? 0 : Number(r.slice(1)) || 0, e: id };
    if (r === 'TOC' || r === 'TOCI') return { kind: 'toc', e: id };
    if (r === 'Caption') return { kind: 'caption', e: id };
    if (r === 'TD' || r === 'TH') return { kind: 'cell', e: id };
    if (r === 'LI') return { kind: 'li', e: id };
    if (r === 'Code') return { kind: 'code', e: id };
    if (r === 'Note' || r === 'FENote') return { kind: 'note', e: id };
    if (r === 'BibEntry') return { kind: 'ref', e: id };
    if (r === 'Figure' || r === 'Formula') return { kind: 'figure', e: id };
    if (r === 'P' || r === 'BlockQuote' || r === 'Quote') return { kind: 'p', e: id };
  }
  return null;
}

// ---------- 行の組み立て ----------

function isMono(ctx, f) {
  return (ctx.fonts[f]?.family || '') === 'monospace';
}

// ベースラインの近い文字をまとめて「行の候補」にする。上付き・下付き文字は隣の行に吸収する
function buildRows(items) {
  const sorted = items.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  for (const it of sorted) {
    let row = null;
    for (let k = rows.length - 1; k >= 0 && k >= rows.length - 3; k--) {
      const r = rows[k];
      if (Math.abs(r.y - it.y) <= 0.2 * Math.max(r.h, it.h)) {
        row = r;
        break;
      }
    }
    if (!row) {
      row = { y: it.y, h: it.h, items: [] };
      rows.push(row);
    }
    row.items.push(it);
    if (it.h > row.h) row.h = it.h;
  }
  // 上付き・下付き (脚注番号、著者の所属番号、数式の添字) を、隣接する本体の行に移す
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const keep = [];
    for (const it of r.items) {
      let target = null;
      for (const k of [i + 1, i - 1, i + 2, i - 2]) {
        const n = rows[k];
        if (!n || n === r || !n.items.length) continue;
        if (it.h > n.h * 0.85) continue;
        const dy = it.y - n.y;
        if (dy < -0.65 * n.h || dy > 0.45 * n.h) continue;
        const near = n.items.some((m) => (it.x >= m.x + m.w - 0.3 * n.h && it.x <= m.x + m.w + 0.8 * n.h) || (it.x + it.w >= m.x - 0.8 * n.h && it.x + it.w <= m.x + 0.3 * n.h));
        if (near) {
          target = n;
          break;
        }
      }
      if (target) {
        it.sup = it.y < target.y ? 1 : 0;
        it.sub = it.y > target.y ? 1 : 0;
        target.items.push(it);
      } else keep.push(it);
    }
    r.items = keep;
  }
  // 文中の分数の分子・分母 (行の上下に少しずれた短い断片) も、すぐ隣の行に入れる
  const live = rows.filter((r) => r.items.length);
  const extent = (r) => [Math.min(...r.items.map((it) => it.x)), Math.max(...r.items.map((it) => it.x + it.w))];
  for (let i = 0; i < live.length; i++) {
    const r = live[i];
    const [x0, x1] = extent(r);
    if (x1 - x0 > r.h * 6) continue;
    for (const k of [i - 1, i + 1]) {
      const n = live[k];
      if (!n || !n.items.length || r.h > n.h * 1.05 || Math.abs(r.y - n.y) > n.h * 0.8) continue;
      const near = n.items.some((m) => x0 < m.x + m.w + n.h && x1 > m.x - n.h);
      if (!near) continue;
      for (const it of r.items) {
        it.sup = r.y < n.y ? 1 : 0;
        it.sub = r.y > n.y ? 1 : 0;
        n.items.push(it);
      }
      r.items = [];
      break;
    }
  }
  return live.filter((r) => r.items.length);
}

// ページ中央付近の縦の空白 (段間) を探す。見つかれば [左端, 右端]
function findGutter(rows, page, ctx) {
  const W = page.w;
  const bin = 2;
  const n = Math.ceil(W / bin);
  const cover = new Array(n).fill(0);
  let counted = 0;
  for (const r of rows) {
    const body = r.items.filter((it) => !it.sup && !it.sub && it.h > ctx.bodySize * 0.75 && it.h < ctx.bodySize * 1.3);
    if (!body.length) continue;
    counted++;
    const seen = new Set();
    for (const it of body) {
      for (let b = Math.max(0, Math.floor(it.x / bin)); b <= Math.min(n - 1, Math.floor((it.x + it.w) / bin)); b++) seen.add(b);
    }
    seen.forEach((b) => cover[b]++);
  }
  if (counted < 8) return null;
  // 中央付近で被覆が両側の 3 割以下に落ち込む谷を探す (題名など段をまたぐ行があるので 0 にはならない)
  const lo = Math.floor((W * 0.3) / bin);
  const hi = Math.ceil((W * 0.7) / bin);
  const flank = (a, b) => Math.max(0, ...cover.slice(Math.max(0, a), Math.min(n, b)));
  let best = null;
  for (let b = lo; b <= hi; b++) {
    const leftMax = flank(Math.floor((W * 0.12) / bin), b);
    const rightMax = flank(b + 1, Math.ceil((W * 0.88) / bin));
    const limit = Math.max(1, Math.min(leftMax, rightMax) * 0.3);
    if (cover[b] > limit || Math.min(leftMax, rightMax) < counted * 0.3) continue;
    let s = b;
    let e = b;
    while (s - 1 >= 0 && cover[s - 1] <= limit) s--;
    while (e + 1 < n && cover[e + 1] <= limit) e++;
    const width = (e - s + 1) * bin;
    const depth = sum(cover.slice(s, e + 1)) / (e - s + 1);
    if (width >= 4 && width <= W * 0.2 && (!best || depth < best.depth || (depth === best.depth && width > best.width))) best = { s, e, width, depth };
    b = e;
  }
  if (!best) return null;
  return [best.s * bin, (best.e + 1) * bin];
}

function supText(s) {
  const t = s.trim();
  if (!t) return '';
  if ([...t].every((c) => SUP_MAP[c])) return [...t].map((c) => SUP_MAP[c]).join('');
  return t;
}

// 行内の文字列を、隙間に応じて空白を入れながらつなぐ
function makeLine(items, pageIndex, col, ctx) {
  items.sort((a, b) => a.x - b.x);
  const main = items.filter((it) => !it.sup && !it.sub);
  const base = main.length ? main : items;
  const size = mode(base.map((it) => [round(it.h), it.s.length])) || base[0].h;
  const font = mode(base.map((it) => [it.f, it.s.length]));
  const y = mode(base.map((it) => [round(it.y, 0.5), it.s.length]));
  let text = '';
  let prevEnd = null;
  let gaps = 0;
  const cells = [[]];
  for (const it of items) {
    let s = it.sup ? supText(it.s) : it.s;
    if (prevEnd !== null) {
      const gap = it.x - prevEnd;
      // 行頭の箇条書き記号・番号の後の空きは、表の列の区切りとは数えない
      const marker = cells.length === 1 && /^\s*(?:[•◦▪▫‣⁃∙●○■□►▶➢➤✓✔❖◆◇–—\-*·\uf000-\uf0ff]|\(?(?:\d{1,2}|[a-z]|[ivx]{1,4})[.)])\s*$/.test(text);
      if (gap > size * 1.2 && !marker) {
        gaps++;
        cells.push([]);
      }
      const needSpace = !/\s$/.test(text) && !/^\s/.test(s);
      if (needSpace && !it.sup) {
        const cjk = CJK_RE.test(text.slice(-1)) && CJK_RE.test(s[0]);
        if (gap > size * (cjk ? 0.5 : 0.12)) text += ' ';
      }
    }
    text += s;
    cells[cells.length - 1].push(it);
    prevEnd = Math.max(prevEnd ?? -Infinity, it.x + it.w);
  }
  const chars = sum(base, (it) => it.s.length) || 1;
  const monoChars = sum(base.filter((it) => isMono(ctx, it.f)), (it) => it.s.length);
  const elem = mode(base.filter((it) => it.e !== undefined).map((it) => [it.e, it.s.length]));
  return {
    page: pageIndex,
    col,
    y,
    top: Math.min(y - size * 0.8, ...items.map((it) => it.y - it.h * 0.85)),
    bottom: Math.max(y + size * 0.25, ...items.map((it) => it.y + it.h * 0.25)),
    x0: Math.min(...items.map((it) => it.x)),
    x1: Math.max(...items.map((it) => it.x + it.w)),
    size,
    font,
    mono: monoChars / chars > 0.6,
    text: text.replace(/\s+/g, ' ').trim(),
    gaps,
    cells: cells.length,
    elem: elem ?? undefined,
    art: base.every((it) => it.a),
  };
}

function preparePage(page, pageIndex, ctx) {
  const items = page.items.filter((it) => it.s && it.s.trim() !== '');
  const tables = ctx.tagged ? takeTaggedTables(items, pageIndex, ctx) : [];
  const rows = buildRows(items.filter((it) => !it.taken));
  return { page, pageIndex, tables, rows, gutter: findGutter(rows, page, ctx) };
}

// 段間が見つかったページが少ない (1 段組の文書で、表などが偶然谷を作った) 場合は使わない。
// 2 段組の文書なら、谷が見つからなかったページにも文書全体の段間を当てはめる (全幅の表がある頁など)
function decideGutters(prepared, ctx) {
  const withText = prepared.filter((pp) => pp.rows.length >= 8);
  const found = withText.filter((pp) => pp.gutter);
  if (!found.length || found.length < withText.length * 0.3) {
    prepared.forEach((pp) => {
      pp.gutter = null;
    });
    return;
  }
  const center = mode(found.map((pp) => [round((pp.gutter[0] + pp.gutter[1]) / 2, 4), 1]));
  const typical = found.find((pp) => Math.abs((pp.gutter[0] + pp.gutter[1]) / 2 - center) <= 4).gutter;
  for (const pp of prepared) {
    if (pp.gutter && Math.abs((pp.gutter[0] + pp.gutter[1]) / 2 - center) > 16) pp.gutter = null;
    if (!pp.gutter && pp.rows.length >= 8) {
      const crossing = pp.rows.filter((r) => r.items.some((it) => it.x < typical[0] - 1 && it.x + it.w > typical[1] + 1)).length;
      if (crossing < pp.rows.length * 0.5) pp.gutter = typical;
    }
  }
}

function buildPageLines(pp, ctx) {
  const { page, pageIndex, tables, rows, gutter } = pp;
  const lines = [];
  for (const r of rows) {
    if (!gutter) {
      lines.push(makeLine(r.items, pageIndex, 'F', ctx));
      continue;
    }
    const [gL, gR] = gutter;
    const mid = (gL + gR) / 2;
    const crossing = r.items.filter((it) => !it.sup && it.x < gL - 1 && it.x + it.w > gR + 1);
    let left = r.items.filter((it) => it.x + it.w / 2 < mid);
    let right = r.items.filter((it) => it.x + it.w / 2 >= mid);
    let span = crossing.length > 0;
    const maxEnd = Math.max(...r.items.map((it) => it.x + it.w));
    // 右の段から新しく始まる文字 (左の文字の続きではないもの) があるか
    const rightStarts = r.items.some((it) => {
      if (it.x < gR - 1) return false;
      const before = r.items.filter((o) => o !== it && o.x < it.x);
      return !before.length || it.x - Math.max(...before.map((o) => o.x + o.w)) > r.h * 0.5;
    });
    // (はみ出す行は左の段の左端付近から始まる。段間をまたいで中央に置かれた短い行は全幅の行)
    const minX = Math.min(...r.items.map((it) => it.x));
    if (minX < gL * 0.5 && maxEnd < gR + Math.min(r.h, ctx.bodySize * 1.2) * 2 && !rightStarts) {
      // 左の段の行が段間に少しはみ出しただけ
      span = false;
      left = r.items;
      right = [];
    } else if (span) {
      // 左の段からはみ出した長い URL など: はみ出した要素より右に、右の段の文字が離れて続いていれば 2 つに分ける
      const end = Math.max(...crossing.map((it) => it.x + it.w));
      // (はみ出した URL は右の段の文字と重なって描かれることもある)
      // 右の段の文字は段の左端 (段間の右端) から始まる
      const rightOnes = r.items.filter((it) => !crossing.includes(it) && it.x >= gR - 3 && (it.x > end + r.h || it.x < end - r.h));
      const rStart = rightOnes.length ? Math.min(...rightOnes.map((it) => it.x)) : 0;
      const overlaps = rightOnes.some((it) => it.x < end - r.h);
      if (rightOnes.length && (overlaps || Math.abs(rStart - gR) < 4) && crossing.every((it) => it.x < mid)) {
        span = false;
        // 重なった左右の文字を、それぞれの続き (直前の要素の終わりに近い方) に振り分ける
        left = [];
        right = [];
        let lEnd = -Infinity;
        let rEnd = null;
        for (const it of r.items.slice().sort((a, b) => a.x - b.x)) {
          const toLeft = it.x < rStart - 0.5 || crossing.includes(it) || (rEnd !== null && Math.abs(it.x - lEnd) < Math.abs(it.x - rEnd));
          if (toLeft) {
            left.push(it);
            lEnd = Math.max(lEnd, it.x + it.w);
          } else {
            right.push(it);
            rEnd = Math.max(rEnd ?? -Infinity, it.x + it.w);
          }
        }
      }
    } else if (left.length && right.length) {
      // 段間をまたぐ 1 行 (題名・全幅の図のキャプション): 左右の部分の隙間が狭ければ 1 行とみなす
      const lEnd = Math.max(...left.map((it) => it.x + it.w));
      const rStart = Math.min(...right.map((it) => it.x));
      if (rStart - lEnd < r.h * 0.6) span = true;
    }
    if (span) lines.push(makeLine(r.items, pageIndex, 'F', ctx));
    else {
      if (left.length) lines.push(makeLine(left, pageIndex, 'L', ctx));
      if (right.length) lines.push(makeLine(right, pageIndex, 'R', ctx));
    }
  }
  for (const t of tables) lines.push(t);
  return { index: pageIndex, w: page.w, h: page.h, gutter, lines: orderLines(lines, gutter) };
}

// 読み順: 上から順に、全幅の行の帯と 2 段の帯を交互にたどり、2 段の帯は左の段 → 右の段の順に読む
function orderLines(lines, gutter) {
  const sorted = lines.slice().sort((a, b) => a.top - b.top || a.x0 - b.x0);
  if (!gutter) return sorted;
  const out = [];
  let band = [];
  const flush = () => {
    out.push(...band.filter((l) => l.col === 'L'), ...band.filter((l) => l.col === 'R'));
    band = [];
  };
  for (const l of sorted) {
    if (l.col === 'F') {
      flush();
      out.push(l);
    } else band.push(l);
  }
  flush();
  return out;
}

// Tagged PDF の表 (Table > TR > TD) を、セル単位で文字を集めて表にする
function takeTaggedTables(items, pageIndex, ctx) {
  const byTable = new Map();
  for (const it of items) {
    if (it.e === undefined) continue;
    const chain = roleChain(ctx, it.e);
    const cell = chain.find((c) => c.r === 'TD' || c.r === 'TH');
    if (!cell) continue;
    const row = chain.find((c) => c.r === 'TR');
    const table = chain.find((c) => c.r === 'Table');
    if (!row || !table) continue;
    it.taken = true;
    if (!byTable.has(table.e)) byTable.set(table.e, { rows: new Map(), items: [] });
    const t = byTable.get(table.e);
    t.items.push(it);
    if (!t.rows.has(row.e)) t.rows.set(row.e, new Map());
    const r = t.rows.get(row.e);
    if (!r.has(cell.e)) r.set(cell.e, { th: cell.r === 'TH', items: [] });
    r.get(cell.e).items.push(it);
  }
  const out = [];
  for (const t of byTable.values()) {
    const rows = [...t.rows.values()].map((cells) =>
      [...cells.values()]
        .map((c) => ({ th: c.th, x: Math.min(...c.items.map((it) => it.x)), text: cellText(c.items, ctx) }))
        .sort((a, b) => a.x - b.x),
    );
    const sortedRows = [...t.rows.values()].map((cells, i) => ({ i, y: Math.min(...[...cells.values()].flatMap((c) => c.items.map((it) => it.y))) }));
    sortedRows.sort((a, b) => a.y - b.y);
    const ordered = sortedRows.map((r) => rows[r.i]);
    const headerCount = ordered.length > 1 && ordered[0].every((c) => c.th) ? 1 : 0;
    const x0 = Math.min(...t.items.map((it) => it.x));
    const x1 = Math.max(...t.items.map((it) => it.x + it.w));
    const top = Math.min(...t.items.map((it) => it.y - it.h));
    const bottom = Math.max(...t.items.map((it) => it.y));
    out.push({
      kind: 'table',
      page: pageIndex,
      col: 'F',
      y: top,
      top,
      bottom,
      x0,
      x1,
      size: ctx.bodySize,
      text: '',
      header: ordered.slice(0, headerCount).map((r) => r.map((c) => c.text)),
      rows: ordered.slice(headerCount).map((r) => r.map((c) => c.text)),
    });
  }
  return out;
}

function cellText(items, ctx) {
  const rows = buildRows(items);
  return rows.map((r) => makeLine(r.items, 0, 'F', ctx).text).join(' ').replace(/\s+/g, ' ').trim();
}

// ---------- ヘッダー・フッターの除去 ----------

function removeRunningLines(pages, ctx) {
  const key = (t) => t.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().toLowerCase();
  const counts = new Map();
  const candidates = (pg) => pg.lines.filter((l) => l.kind !== 'table' && (l.top < pg.h * 0.1 || l.bottom > pg.h * 0.9));
  for (const pg of pages) {
    const seen = new Set();
    for (const l of candidates(pg)) seen.add(key(l.text));
    seen.forEach((k) => counts.set(k, (counts.get(k) || 0) + 1));
  }
  const need = Math.max(2, Math.ceil(pages.length * 0.25));
  for (const pg of pages) {
    const drop = new Set();
    for (const l of candidates(pg)) {
      if (l.art || PAGE_NUM_RE.test(l.text) || (pages.length >= 2 && counts.get(key(l.text)) >= need)) drop.add(l);
    }
    pg.lines = pg.lines.filter((l) => !drop.has(l) && !l.art);
  }
}

// ---------- 段組の幾何 (左端・右端・行間) ----------

function computeGeometry(pages, ctx) {
  const gaps = [];
  const justified = [0, 0];
  for (const pg of pages) {
    pg.cols = {};
    for (const col of ['F', 'L', 'R']) {
      const ls = pg.lines.filter((l) => l.col === col && l.kind !== 'table');
      const body = ls.filter((l) => Math.abs(l.size - ctx.bodySize) < 0.6 && l.text.length > 20);
      if (!ls.length) continue;
      const left = body.length ? mode(body.map((l) => [round(l.x0, 1), 1])) : Math.min(...ls.map((l) => l.x0));
      const right = body.length ? percentile(body.map((l) => l.x1), 0.9) : Math.max(...ls.map((l) => l.x1));
      pg.cols[col] = { left, right, width: Math.max(1, right - left) };
      for (let i = 1; i < ls.length; i++) {
        const a = ls[i - 1];
        const b = ls[i];
        if (Math.abs(a.size - ctx.bodySize) < 0.6 && Math.abs(b.size - ctx.bodySize) < 0.6) {
          const d = b.y - a.y;
          if (d > 0 && d < ctx.bodySize * 2.5) gaps.push([round(d, 0.5), 1]);
          if (a.x1 > left + (right - left) * 0.5) justified[a.x1 >= right - ctx.bodySize * 0.6 ? 0 : 1]++;
        }
      }
    }
  }
  ctx.lineGap = mode(gaps) || ctx.bodySize * 1.2;
  ctx.justified = justified[0] > (justified[0] + justified[1]) * 0.6;
}

// ---------- しおり (アウトライン) と見出しの対応付け ----------

const norm = (s) =>
  s
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^a-z0-9\u3040-\u9fff]+/g, '');
// 見出し番号 ("3.2" "IV." "A." "Appendix B") を除いて比べる
const normTitle = (s) => norm(s.replace(/^\s*(?:(?:\d+\.)*\d+\.?|[IVXLC]+\.|[A-Z]\.?|(?:Appendix|Annex)\s+[A-Z](?:\.\d+)*[.:]?)\s+(?=\S)/i, ''));

function matchOutline(pages, ctx) {
  const outline = (ctx.data.outline || []).filter((o) => o.p >= 0 && o.p < pages.length);
  for (const o of outline) {
    const want = normTitle(o.t);
    if (!want) continue;
    const ok = (cand) => cand === want || (want.length >= 6 && cand.startsWith(want) && cand.length <= want.length * 1.15 + 2);
    const partial = (cand) => cand.length >= 3 && want.startsWith(cand) && cand.length >= want.length * 0.4;
    let hit = null;
    for (const pi of [o.p, o.p + 1]) {
      const pg = pages[pi];
      if (!pg) continue;
      for (let i = 0; i < pg.lines.length && !hit; i++) {
        const l = pg.lines[i];
        if (l.kind === 'table' || l.heading) continue;
        if (pi === o.p && o.y !== null && (l.y < o.y - 12 || l.y > o.y + 80)) continue;
        if (pi !== o.p && l.y > pg.h * 0.4) continue;
        const one = normTitle(l.text);
        if (ok(one)) hit = { l, cont: null };
        else {
          // 見出しが 2 行に折り返されている場合は次の行までつなげて比べる
          const next = pg.lines[i + 1];
          if (next && next.col === l.col && partial(one) && ok(normTitle(`${l.text.replace(/-$/, '')}${/-$/.test(l.text) ? '' : ' '}${next.text}`))) hit = { l, cont: next };
        }
      }
      if (hit) break;
    }
    if (!hit) continue;
    if (hit.l.text.length > 160) continue;
    hit.l.heading = { level: o.d + 1, from: 'outline' };
    if (hit.cont) hit.cont.headingCont = true;
    ctx.outlineHits.set(o, hit.l);
  }
  ctx.useOutline = outline.length >= 2 && ctx.outlineHits.size >= outline.length * 0.5;
}

// ---------- 段落への分割 ----------

function startsItem(text) {
  return BULLET_RE.test(text) || ENUM_RE.test(text);
}

function pageBlocks(pg, ctx) {
  const out = [];
  let cur = null;
  const lines = pg.lines;
  const close = () => {
    if (cur) out.push(cur);
    cur = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.kind === 'table') {
      close();
      out.push({ type: 'table', page: pg.index, col: l.col, top: l.top, bottom: l.bottom, x0: l.x0, x1: l.x1, header: l.header, rows: l.rows, lines: [] });
      continue;
    }
    const geo = pg.cols[l.col] || { left: l.x0, right: l.x1, width: l.x1 - l.x0 };
    if (cur && !breakBetween(cur, l, lines[i + 1], geo, ctx)) {
      cur.lines.push(l);
      cur.bottom = l.bottom;
      cur.x0 = Math.min(cur.x0, l.x0);
      cur.x1 = Math.max(cur.x1, l.x1);
      continue;
    }
    close();
    cur = { type: 'raw', page: pg.index, col: l.col, top: l.top, bottom: l.bottom, x0: l.x0, x1: l.x1, lines: [l], geo };
  }
  close();
  return out;
}

function breakBetween(block, b, next, geo, ctx) {
  const a = block.lines[block.lines.length - 1];
  if (b.col !== a.col) return true;
  if (b.heading || a.heading) return !(a.heading && b.headingCont);
  if (b.headingCont) return false;
  const L = ctx.lineGap;
  const dy = b.y - a.y;
  if (dy <= 0 || dy > Math.max(L, a.size * 1.1) * 1.45) return true;
  if (Math.abs(b.size - a.size) > 0.75) return true;
  // 表の行 (大きな隙間で区切られた行) と文章の行は別のブロック
  if ((a.cells >= 2) !== (b.cells >= 2)) return true;
  if (a.mono !== b.mono) {
    // 段落の途中で行全体が等幅になっただけ (折り返した URL や、文中のコード) なら段落を続ける
    const inline = (m, p) => m.text.length < 70 && !/\s{2,}/.test(m.text) && p.x1 >= geo.right - ctx.bodySize * 1.5 && !SENT_END_RE.test(p.text);
    if (b.mono && !a.mono && inline(b, a)) b.mono = false;
    else if (a.mono && !b.mono && block.lines.length > 1 && !block.lines[0].mono && inline(a, block.lines[block.lines.length - 2])) a.mono = false;
    else return true;
  }
  if (ctx.tagged && a.elem !== undefined && b.elem !== undefined) {
    const ra = tagRole(ctx, a.elem);
    const rb = tagRole(ctx, b.elem);
    if (ra && rb) return ra.e !== rb.e;
  }
  if (b.mono) return false;
  if (startsItem(b.text) && !startsItem(a.text.slice(-3))) return true;
  const ind = ctx.bodySize;
  // 箇条書きの項目の 2 行目以降 (記号より右から始まる行) は同じ項目
  const head = block.lines[0];
  if (startsItem(head.text)) return !(b.x0 > head.x0 + ind * 0.3 && dy <= Math.max(L, a.size * 1.1) * 1.3);
  // 本文と同じ大きさの太字などで書かれた見出しの行 (次の行から本文の書体に戻る)
  if (block.lines.length === 1 && a.font !== b.font && a.font !== ctx.bodyFont && b.font === ctx.bodyFont) {
    const info = headingInfo(a.text, ctx, a);
    if (info.number || KNOWN_HEAD_RE.test(info.text) || a.x1 < geo.right - geo.width * 0.25) return true;
  }
  const aLeft = a.x0 - geo.left < ind * 0.6;
  const bInd = b.x0 - geo.left;
  // 字下げ段落 (LaTeX): 次の行が 1〜4 字分字下げされ、その次の行は左端に戻る
  if (aLeft && bInd > ind * 0.6 && bInd < ind * 4) {
    const nextBack = next && next.col === b.col && next.y > b.y && next.x0 - geo.left < ind * 0.6;
    if (nextBack || !next || SENT_END_RE.test(a.text)) return true;
  }
  // 右端まで届かずに文が終わった行の次で、左端から始まる行
  // (両端揃えの文書では段落の途中の行は右端まで届くので、少しでも短ければ段落の終わり)
  const short = ctx.justified ? ind * 0.5 : Math.max(geo.width * 0.2, ind * 6);
  if (a.x1 < geo.right - short && SENT_END_RE.test(a.text) && bInd < ind * 0.6 && block.lines.length > 1) return true;
  // 中央寄せの行と本文の行は別のブロック
  const centered = (l) => l.x0 - geo.left > geo.width * 0.12 && geo.right - l.x1 > geo.width * 0.12 && Math.abs(l.x0 - geo.left - (geo.right - l.x1)) < ind * 2;
  // (幅いっぱいの行の次に中央寄せの短い行が続くのは、中央寄せの段落や題名の折り返し)
  const wide = (l) => l.x1 - l.x0 > geo.width * 0.7;
  if (centered(a) !== centered(b) && !(wide(a) && centered(b) && Math.abs(a.size - b.size) < 0.5)) return true;
  return false;
}

// ---------- 段・ページをまたぐ段落の連結 ----------

function mergeAcrossBreaks(blocks, ctx) {
  const out = [];
  for (const b of blocks) {
    // 直前の本文 (間にある図・脚注は飛ばす) が文の途中で終わっていれば、続きとしてつなぐ
    let k = out.length - 1;
    let skipped = false;
    while (k >= 0 && out[k].floatLike) {
      k--;
      skipped = true;
    }
    const prev = out[k];
    const broken = prev && (prev.page !== b.page || prev.col !== b.col || skipped);
    if (broken && b.lines && prev.lines && !b.floatLike && !prev.center && !b.center && continues(prev, b, ctx)) {
      if ((prev.type === 'para' || prev.type === 'item') && b.type === 'para') {
        prev.lines.push(...b.lines);
        prev.text = joinText(prev.lines, ctx);
        continue;
      }
      if (prev.type === 'code' && b.type === 'code') {
        prev.lines.push(...b.lines);
        prev.codeLines.push(...b.codeLines);
        continue;
      }
    }
    out.push(b);
  }
  return out;
}

function continues(a, b, ctx) {
  const la = a.lines[a.lines.length - 1];
  const fb = b.lines[0];
  if (!la || !fb) return false;
  if (la.heading || fb.heading) return false;
  // 段の終わりで切れたコード
  if (la.mono && fb.mono) return a.lines.every((l) => l.mono) && b.lines.every((l) => l.mono) && !/^\s*$/.test(fb.text);
  if (la.mono || fb.mono) return false;
  if (Math.abs(la.size - ctx.bodySize) > 0.6 || Math.abs(fb.size - ctx.bodySize) > 0.6) return false;
  if (SENT_END_RE.test(la.text) || startsItem(fb.text) || CAPTION_RE.test(fb.text)) return false;
  if (la.x1 < a.geo.right - ctx.bodySize * 2) return false;
  // 箇条書きの項目の続きは、項目の本文の位置 (ぶら下げインデント) から始まる
  const indent = startsItem(a.lines[0].text) ? ctx.bodySize * 4 : ctx.bodySize * 0.6;
  if (b.geo && fb.x0 - b.geo.left > indent) return false;
  return /^[a-z(\[0-9"“,;]/.test(fb.text) || /[a-z,]-?$/.test(la.text);
}

// ---------- ブロックの判定 ----------

function joinText(lines, ctx) {
  let out = '';
  for (const l of lines) {
    const t = l.text;
    if (!t) continue;
    if (!out) {
      out = t;
      continue;
    }
    const m = /([A-Za-z]+)-$/.exec(out);
    // 小文字で続く語、または大文字だけの見出しの語 ("MO-" + "MENTS")
    if (m && (/^[a-z]/.test(t) || (/^[A-Z]{2,}$/.test(m[1]) && /^[A-Z]{2,}\b/.test(t)))) {
      const w2 = /^[A-Za-z]+/.exec(t)[0].toLowerCase();
      const joined = (m[1] + w2).toLowerCase();
      const hyph = `${m[1]}-${w2}`.toLowerCase();
      const token = /(\S+)-$/.exec(out)[1].toLowerCase();
      let keep;
      if (ctx.vocab.has(joined)) keep = false;
      else if (ctx.vocab.has(hyph) || ctx.vocab.has(`${token}-${w2}`)) keep = true;
      // "state-of-the-" のように途中にもハイフンがある語は複合語の途中
      else if (/[a-z]-[a-z]/.test(token)) keep = true;
      // 前後がどちらも単独の語として文書中に現れる ("attacker-controlled") なら複合語のハイフン
      else if (m[1].length >= 3 && w2.length >= 3 && ctx.vocab.has(m[1].toLowerCase()) && ctx.vocab.has(w2)) keep = true;
      else keep = !ctx.justified;
      out = keep ? out + t : out.slice(0, -1) + t;
    } else if (/-$/.test(out) && /^[A-Za-z0-9]/.test(t) && /[A-Za-z0-9]-$/.test(out)) {
      out += t;
    } else if (CJK_RE.test(out.slice(-1)) && CJK_RE.test(t[0])) {
      out += t;
    } else if (/https?:\/\/\S*[/._-]$/.test(out) || (/https?:\/\/\S+$/.test(out) && /^[a-z0-9][^\s]*[/.-]/.test(t))) {
      out += t;
    } else out += ` ${t}`;
  }
  return out;
}

function buildVocab(blocks) {
  const vocab = new Set();
  for (const b of blocks) {
    for (const l of b.lines || []) {
      const words = l.text.split(/[^A-Za-z-]+/);
      // 行末の語はハイフンで折り返した途中の語かもしれないので数えない
      words.slice(0, -1).forEach((w) => {
        if (w.length > 2) vocab.add(w.toLowerCase().replace(/^-+|-+$/g, ''));
      });
    }
  }
  return vocab;
}

function headingInfo(text, ctx, l) {
  let m;
  const t = text.trim();
  if ((m = APPENDIX_HEAD_RE.exec(t))) return { number: m[1], text: m[2] || t, appendix: true, depth: m[1].split('.').length };
  if ((m = NUM_HEAD_RE.exec(t)) && !/^\d/.test(m[2])) return { number: m[1], text: m[2], depth: m[1].split('.').length };
  if ((m = ROMAN_HEAD_RE.exec(t))) return { number: m[1], text: m[2], depth: 1, roman: true };
  if ((m = LETTER_HEAD_RE.exec(t)) && l && m[2].length > 2) return { number: m[1], text: m[2], depth: ctx.romanSections ? 2 : 1, letter: true };
  return { number: '', text: t, depth: 0 };
}

// 見出しらしさ (しおりもタグもない文書用)
function looksHeading(blk, ctx) {
  const ls = blk.lines;
  if (ls.length > 3) return false;
  const text = joinText(ls, ctx);
  if (text.length > 120 || text.length < 2) return false;
  if (TOC_LINE_RE.test(text) && /\.{4,}|\s\d+$/.test(text)) return false;
  if (CAPTION_RE.test(text)) return false;
  const first = ls[0];
  const size = first.size;
  const bigger = size >= ctx.bodySize * 1.12;
  const otherFont = first.font !== ctx.bodyFont;
  const info = headingInfo(text, ctx, first);
  const known = KNOWN_HEAD_RE.test(info.text.replace(/[.:]$/, ''));
  if (/[.,;]$/.test(text) && !known && !/^\d+(\.\d+)*\.$/.test(text)) return false;
  if (size < ctx.bodySize * 0.95 && !known) return false;
  if (bigger && (info.number || known || /^[A-Z]/.test(info.text))) return true;
  if (otherFont && (info.number || known) && /^[A-Z]/.test(info.text)) return true;
  if (otherFont && info.text === info.text.toUpperCase() && /[A-Z]{3}/.test(info.text) && info.number) return true;
  return false;
}

function codeLines(blk) {
  const minX = Math.min(...blk.lines.map((l) => l.x0));
  const cw = blk.lines[0].size * 0.6;
  return blk.lines.map((l) => ' '.repeat(Math.max(0, Math.round((l.x0 - minX) / cw))) + l.text);
}

// 図表の中の文字・数式など、段落として読めない行か
// 小さい字でも、単語が並んだ長い行 (著作権表示や脚注) は文章として読む
function wordyLine(l, geo) {
  const words = l.text.split(/\s+/).filter((w) => /^[A-Za-z][A-Za-z,.;:'’()-]*$/.test(w)).length;
  return words >= 6 && l.x1 - l.x0 > geo.width * 0.6 && l.cells === 1;
}

function nonProse(l, geo, ctx) {
  if (l.mono || l.heading) return false;
  if (l.size < ctx.bodySize * 0.85) return !wordyLine(l, geo);
  // 大きく空いた隙間のある行 (表の行、図のラベル、式番号の付いた数式)
  if (l.cells >= 2) return true;
  const indented = l.x0 - geo.left > geo.width * 0.1;
  const centered = indented && geo.right - l.x1 > geo.width * 0.1;
  // 中央寄せの数式、分数の分子・分母のような短い断片
  if (centered && /[=≤≥<>∑∏∫∈→]/.test(l.text) && !SENT_END_RE.test(l.text)) return true;
  if (indented && l.text.length < 30 && l.x1 - l.x0 < geo.width * 0.25 && !SENT_END_RE.test(l.text) && !/[a-z]{4,}\s+[a-z]{3,}/.test(l.text)) return true;
  // 記号の多い数式の行。文中に式を含むだけの文章の行 (単語が並ぶ) は文章として読む
  const math = (l.text.match(MATH_CHAR_RE) || []).length;
  const letters = (l.text.match(/[A-Za-z]/g) || []).length;
  const words = (l.text.match(/\b[A-Za-z]{3,}\b/g) || []).length;
  if (math >= 2 && math > letters * 0.15 && words < 4) return true;
  if (/\(\d{1,3}\)$/.test(l.text) && l.cells >= 2) return true; // 式番号付きの数式
  return false;
}

function classify(blocks, ctx) {
  ctx.vocab = buildVocab(blocks);
  ctx.romanSections = blocks.some((b) => b.type === 'raw' && b.lines.length === 1 && /^I\.\s+[A-Z]/.test(b.lines[0].text) && b.lines[0].font !== ctx.bodyFont);
  const out = [];
  let inRefs = false;
  let seenHeading = false;
  let refBuf = [];
  const flushRefs = () => {
    if (refBuf.length) out.push(...splitRefs(refBuf, ctx));
    refBuf = [];
  };
  for (const b of blocks) {
    if (b.type !== 'raw') {
      out.push(b);
      continue;
    }
    const first = b.lines[0];
    const text = joinText(b.lines, ctx);
    const tag = ctx.tagged ? tagRole(ctx, first.elem) : null;
    if (tag && tag.kind === 'toc') continue;
    // 見出し
    let heading = null;
    if (first.heading) heading = first.heading;
    else if (tag && tag.kind === 'heading') heading = { level: tag.level || 0, from: 'tag' };
    else if (!ctx.useOutline && !(ctx.tagged && ctx.taggedHeadings) && looksHeading(b, ctx)) heading = { level: 0, from: 'guess' };
    else if ((ctx.useOutline || ctx.tagged) && looksHeading(b, ctx) && KNOWN_HEAD_RE.test(text.replace(/^(?:\d+\.?|[IVX]+\.)\s+/, ''))) heading = { level: 0, from: 'guess' };
    if (heading && text.length <= 160) {
      flushRefs();
      const info = headingInfo(text, ctx, first);
      // 1 ページ目の大きな番号なしの「見出し」は題名かもしれないので、前付け (著者など) の扱いを続ける
      if (info.number || KNOWN_HEAD_RE.test(info.text) || b.page > 0 || first.size < ctx.bodySize * 1.25) seenHeading = true;
      inRefs = REFS_HEAD_RE.test(text);
      out.push({ type: 'heading', level: heading.level, info, text, size: first.size, page: b.page, col: b.col, top: b.top, bottom: b.bottom, from: heading.from });
      continue;
    }
    if (TOC_LINE_RE.test(first.text) && b.lines.every((l) => TOC_LINE_RE.test(l.text)) && /\.{4,}/.test(text)) {
      continue; // 元の目次 (点線と頁番号)。見出しから目次を作るので捨てる
    }
    let m;
    if ((m = CAPTION_RE.exec(text)) && (!tag || tag.kind === 'caption' || tag.kind === 'p')) {
      const label = `${m[1] === 'Fig.' || m[1] === 'FIGURE' ? 'Figure' : m[1] === 'TABLE' ? 'Table' : m[1]} ${m[2]}`;
      out.push({ ...b, type: 'caption', label, text: text.slice(m[0].length).trim(), raw: text, floatLike: true });
      continue;
    }
    if (inRefs) {
      // 参考文献は段・ページをまたいで続くので、次の見出しまでまとめてから 1 件ずつに分ける
      refBuf.push(b);
      continue;
    }
    if (b.lines.every((l) => l.mono) && seenHeading) {
      const prev = out[out.length - 1];
      const mergeable = !!prev && prev.type === 'code' && prev.page === b.page && prev.col === b.col && b.top - prev.bottom < ctx.lineGap * 3;
      out.push({ ...b, type: 'code', codeLines: codeLines(b), mergeable });
      continue;
    }
    // 脚注: 本文より小さい字で、ページ下部にあり、番号や記号で始まる
    const pgH = ctx.data.pages[b.page].h;
    if (first.size < ctx.bodySize * 0.92 && b.top > pgH * 0.6 && /^([¹²³⁴⁵⁶⁷⁸⁹⁰*∗†‡§¶]|\d{1,2}\s)/.test(first.text)) {
      out.push({ ...b, type: 'note', text, floatLike: true });
      continue;
    }
    if (first.size < ctx.bodySize * 0.92 && b.lines.filter((l) => wordyLine(l, b.geo)).length >= b.lines.length * 0.5) {
      out.push({ ...b, type: 'note', text, floatLike: true });
      continue;
    }
    if (startsItem(first.text) || (tag && tag.kind === 'li')) {
      out.push({ ...b, type: 'item', text });
      continue;
    }
    const np = b.lines.filter((l) => nonProse(l, b.geo, ctx)).length;
    if (seenHeading && np >= Math.max(1, b.lines.length * 0.5)) {
      out.push({ ...b, type: 'zone', floatLike: true });
      continue;
    }
    const geo = b.geo;
    const centered = b.lines.every((l) => l.x0 - geo.left > geo.width * 0.12 && geo.right - l.x1 > geo.width * 0.12);
    if (!seenHeading || (centered && b.lines.length <= 4 && b.lines.every((l) => l.text.length < 90))) {
      const shortLines = b.lines.every((l) => l.x1 - l.x0 < geo.width * 0.75);
      // 題名の下の著者・所属・メールアドレスは行のまま並べる
      const grid = b.lines.some((l) => l.cells >= 2 || l.mono);
      if (!seenHeading && (centered || shortLines || grid) && (b.lines.length > 1 || grid)) {
        out.push({ ...b, type: 'lines', textLines: b.lines.map((l) => l.text), center: centered });
        continue;
      }
    }
    out.push({ ...b, type: 'para', text, center: centered && b.lines.length <= 3 });
  }
  flushRefs();
  return out;
}

// 参考文献の段落を 1 件ずつに分ける。[1] / [ABC12] / 1. で始まる形式ならその行から、
// そうでなければぶら下げインデントの 1 行目か、段落の切れ目から新しい項目にする
function splitRefs(blocks, ctx) {
  const tagRe = /^\[([A-Za-z0-9][\w.+:/-]{0,39}(?: \d{2,4}[a-z]?)?)\]\s*/;
  const numRe = /^(\d{1,3})\.\s+/;
  const lines = blocks.flatMap((b) => b.lines.map((l, i) => ({ l, b, first: i === 0, left: b.geo.left })));
  const tagged = !!lines.length && tagRe.test(lines[0].l.text) && lines.filter((x) => tagRe.test(x.l.text)).length >= 2;
  const numbered = !tagged && !!lines.length && numRe.test(lines[0].l.text) && lines.filter((x) => numRe.test(x.l.text)).length >= 2;
  const entries = [];
  let cur = null;
  const ind = ctx.bodySize;
  lines.forEach((x, i) => {
    const prev = lines[i - 1];
    let start = !cur;
    if (tagged) start = start || tagRe.test(x.l.text);
    else if (numbered) start = start || numRe.test(x.l.text);
    else {
      const atLeft = x.l.x0 - x.left < ind * 0.5;
      const prevIndented = prev && prev.l.x0 - prev.left > ind * 0.8;
      start = start || (atLeft && prevIndented) || (x.first && atLeft && prev && SENT_END_RE.test(prev.l.text));
    }
    if (start) {
      cur = { lines: [], b: x.b };
      entries.push(cur);
    }
    cur.lines.push(x.l);
  });
  return entries.map((e) => {
    const text = joinText(e.lines, ctx);
    const base = { type: 'ref', page: e.b.page, col: e.b.col, top: e.b.top, bottom: e.b.bottom, lines: e.lines, geo: e.b.geo };
    let m;
    if (tagged && (m = tagRe.exec(text))) return { ...base, tag: m[1], text: text.slice(m[0].length) };
    if (numbered && (m = numRe.exec(text))) return { ...base, tag: m[1], text: text.slice(m[0].length) };
    return { ...base, tag: '', text };
  });
}

// ---------- 図表の領域 ----------

// 隣り合う「段落として読めない行」の塊 (表の行、数式) を 1 つにまとめる。
// 塊に挟まれた短い断片 (表の "(A)" のような行見出し) も表の一部とみなす
function mergeZones(blocks, ctx) {
  const L = ctx.lineGap;
  const close = (a, b) => a && b && a.page === b.page && a.col === b.col && b.top - a.bottom < L * 1.6;
  const fragment = (b) => (b.type === 'para' || b.type === 'lines') && b.lines && b.lines.length <= 2 && b.lines.every((l) => l.text.length < 40) && !SENT_END_RE.test(b.lines[b.lines.length - 1].text);
  const list = blocks.slice();
  for (let i = 1; i < list.length - 1; i++) {
    const before = list[i - 1].type === 'zone' || list[i - 1].type === 'caption';
    if (fragment(list[i]) && before && list[i + 1].type === 'zone' && close(list[i - 1], list[i]) && close(list[i], list[i + 1])) {
      list[i] = { ...list[i], type: 'zone', floatLike: true };
    }
  }
  const out = [];
  for (const b of list) {
    const prev = out[out.length - 1];
    if (b.type === 'zone' && prev && prev.type === 'zone' && close(prev, b)) {
      out[out.length - 1] = { ...prev, lines: [...prev.lines, ...b.lines], bottom: Math.max(prev.bottom, b.bottom), top: Math.min(prev.top, b.top), x0: Math.min(prev.x0, b.x0), x1: Math.max(prev.x1, b.x1) };
      continue;
    }
    out.push(b);
  }
  return out;
}

// キャプションと、その上下にある「段落として読めない行」や空白をまとめて、ページの一部を切り出す図にする
function attachFloats(blocks, ctx) {
  const out = blocks.slice();
  const pageOf = (b) => ctx.data.pages[b.page];
  const regionFor = (zoneTop, zoneBottom, b) => {
    const pg = pageOf(b);
    const geo = b.geo || { left: 0, right: pg.w };
    const full = b.col === 'F';
    const x0 = full ? Math.min(geo.left, b.x0) : geo.left;
    const x1 = full ? Math.max(geo.right, b.x1) : geo.right;
    return { page: b.page, x0: Math.max(0, x0 - 4), x1: Math.min(pg.w, x1 + 4), y0: Math.max(0, zoneTop), y1: Math.min(pg.h, zoneBottom) };
  };
  const sameCol = (a, b) => a && b && a.page === b.page && a.col === b.col;
  const L = ctx.lineGap;
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    if (!c || c.type !== 'caption') continue;
    const prefersBelow = /^(Table|Algorithm|Listing)/.test(c.label);
    const tryAbove = () => {
      // 直前の zone をまとめて取り込む
      let k = i - 1;
      let top = null;
      const taken = [];
      while (k >= 0 && sameCol(out[k], c) && out[k].type === 'zone') {
        top = out[k].top;
        taken.push(k);
        k--;
      }
      const prev = k >= 0 && sameCol(out[k], c) ? out[k] : null;
      const limit = prev ? prev.bottom : ctx.textBox[c.page].top - 2;
      if (top === null && c.top - limit > L * 2.5) top = limit + 2;
      if (top === null) return null;
      // 図の線は文字より外に広がっていることが多いので、前の段落との間の余白まで広げる
      return { region: regionFor(Math.min(Math.max(limit + 1, top - L * 0.8), top - 1), c.top - 2, c), taken };
    };
    const tryBelow = () => {
      let k = i + 1;
      let bottom = null;
      const taken = [];
      while (k < out.length && sameCol(out[k], c) && out[k].type === 'zone') {
        bottom = out[k].bottom;
        taken.push(k);
        k++;
      }
      const next = k < out.length && sameCol(out[k], c) ? out[k] : null;
      const limit = next ? next.top : ctx.textBox[c.page].bottom + 2;
      if (bottom === null && limit - c.bottom > L * 2.5) bottom = limit - 2;
      if (bottom === null) return null;
      return { region: regionFor(c.bottom + 2, Math.max(Math.min(limit - 1, bottom + L * 0.5), bottom + 1), c), taken };
    };
    // 直前・直後のコードや表 (Tagged PDF) に付くキャプション
    const firstInCol = !sameCol(out[i - 1], c);
    const near = [i - 1, i + 1]
      .map((k) => out[k])
      .filter((n) => n && (n.type === 'code' || n.type === 'table') && !n.captionBlock && ((n.page === c.page && n.top - c.bottom < L * 3 && c.top - n.bottom < L * 3) || (n === out[i - 1] && firstInCol)));
    const target = near.find((n) => n.type === (/^Table/.test(c.label) ? 'table' : 'code')) || (/^(Listing|Algorithm|Table)/.test(c.label) ? near[0] : null);
    if (target) {
      target.captionBlock = c;
      c.attached = true;
      continue;
    }
    const hit = prefersBelow ? tryBelow() || tryAbove() : tryAbove() || tryBelow();
    if (hit && hit.region.y1 - hit.region.y0 > 8) {
      c.region = hit.region;
      c.zoneText = hit.taken.map((k) => out[k]).flatMap((z) => z.lines.map((l) => l.text));
      hit.taken.forEach((k) => {
        out[k] = null;
      });
    }
  }
  const kept = out.filter((b) => b && !b.attached);
  return kept.map((b, i) => {
    if (b.type !== 'zone') return b;
    const prev = sameCol(kept[i - 1], b) ? kept[i - 1].bottom : ctx.textBox[b.page].top - 2;
    const next = sameCol(kept[i + 1], b) ? kept[i + 1].top : ctx.textBox[b.page].bottom + 2;
    const y0 = Math.min(Math.max(prev + 1, b.top - L * 0.4), b.top - 1);
    const y1 = Math.max(Math.min(next - 1, b.bottom + L * 0.4), b.bottom + 1);
    return { ...b, type: 'figure', region: regionFor(y0, y1, b), zoneText: b.lines.map((l) => l.text) };
  });
}

// ---------- 組み立て ----------

function uniqueId(ctx, id) {
  let u = id;
  let n = 2;
  while (ctx.ids.has(u)) u = `${id}-${n++}`;
  ctx.ids.add(u);
  return u;
}

function assemble(rawBlocks, ctx) {
  ctx.taggedHeadings = ctx.tagged && rawBlocks.some((b) => b.lines && b.lines.some((l) => tagRole(ctx, l.elem)?.kind === 'heading'));
  let blocks = classify(rawBlocks, ctx);
  blocks = mergeAcrossBreaks(blocks, ctx);
  blocks = mergeZones(blocks, ctx);
  blocks = attachFloats(blocks, ctx);

  // 題名: 1 ページ目の上半分で、いちばん大きい文字のブロック (見出しと判定されていても、番号のないものは候補にする)
  const meta = { kind: 'pdf', title: '', pages: ctx.numPages };
  const sizeOf = (b) => (b.type === 'heading' ? b.size : b.lines && b.lines.length ? b.lines[0].size : 0);
  const page0 = ctx.data.pages[0];
  const cands = blocks.filter(
    (b) =>
      b.page === 0 &&
      page0 && b.top < page0.h * 0.5 &&
      (b.type === 'heading' ? !b.info.number && !KNOWN_HEAD_RE.test(b.info.text) : b.lines && b.lines.length && b.lines.length <= 4 && b.type !== 'zone'),
  );
  const maxSize = Math.max(0, ...cands.map(sizeOf));
  const titleBlock = maxSize >= ctx.bodySize * 1.25 ? cands.find((b) => sizeOf(b) === maxSize) : null;
  if (titleBlock) {
    meta.title = (titleBlock.type === 'heading' ? titleBlock.text : joinText(titleBlock.lines, ctx)).replace(/[*∗†‡]+$/, '').trim();
    blocks = blocks.filter((b) => b !== titleBlock);
  }
  const infoTitle = ctx.data.info?.title || '';
  if (!meta.title && infoTitle && !/^(untitled|microsoft word|document\d*)\b|\.(docx?|pdf|tex|dvi)$/i.test(infoTitle)) meta.title = infoTitle;

  // 見出しの階層: 番号の深さ → しおり・タグの階層 → 文字の大きさの順位
  const captionOf = (c) => ({ label: c.label, text: c.text, id: uniqueId(ctx, `${c.label.split(' ')[0].toLowerCase()}-${c.label.split(' ')[1]}`) });
  // 番号付きの見出しの文字の大きさ → 階層。番号のない見出しは同じ大きさの番号付き見出しに合わせる
  const sizeLevel = new Map();
  blocks.filter((b) => b.type === 'heading' && b.info.depth && !b.info.letter).forEach((b) => {
    const k = round(b.size);
    if (!sizeLevel.has(k) || sizeLevel.get(k) > b.info.depth) sizeLevel.set(k, b.info.depth);
  });
  const guessSizes = [...new Set(blocks.filter((b) => b.type === 'heading' && !b.level && !b.info.depth && !sizeLevel.has(round(b.size))).map((b) => round(b.size)))].sort((a, b) => b - a);
  const result = [];
  let seenNumbered = false;
  for (const b of blocks) {
    switch (b.type) {
      case 'heading': {
        const { info } = b;
        let level = b.level || info.depth || (KNOWN_HEAD_RE.test(info.text) ? 1 : sizeLevel.get(round(b.size))) || guessSizes.indexOf(round(b.size)) + 1 || 1;
        if (info.depth && !b.level) level = info.depth;
        if (info.number && /^\d/.test(info.number)) seenNumbered = true;
        level = Math.max(1, Math.min(level, 5));
        let id;
        let number = info.number;
        if (info.appendix || (info.letter && seenNumbered && !ctx.romanSections)) {
          id = `appendix-${info.number}`;
          number = number ? `Appendix ${number}` : '';
          if (info.letter && !info.appendix) number = info.number;
        } else if (number && /^\d/.test(number)) id = `section-${number}`;
        else if (number && info.roman) id = `section-${romanToInt(number)}`;
        else id = `name-${slug(info.text)}`;
        result.push({ type: 'heading', level, number, text: info.text, id: uniqueId(ctx, id), indent: 0 });
        break;
      }
      case 'caption': {
        const caption = captionOf(b);
        if (b.region) result.push({ type: 'figure', region: b.region, caption, alt: (b.zoneText || []).join('\n') });
        else result.push({ type: 'para', text: b.raw, center: true, id: caption.id });
        break;
      }
      case 'figure':
        result.push({ type: 'figure', region: b.region, caption: null, alt: (b.zoneText || []).join('\n') });
        break;
      case 'table':
        result.push({ type: 'table', header: b.header, rows: b.rows, indent: 0, caption: b.captionBlock ? captionOf(b.captionBlock) : null });
        break;
      case 'code': {
        const prev = result[result.length - 1];
        if (prev && prev.type === 'pre' && !prev.caption && b.mergeable) prev.lines.push('', ...b.codeLines);
        else result.push({ type: 'pre', kind: 'code', lines: b.codeLines, indent: 0, caption: b.captionBlock ? captionOf(b.captionBlock) : null });
        break;
      }
      case 'note':
        result.push({ type: 'para', text: b.text, note: true, indent: 0 });
        break;
      case 'lines':
        result.push({ type: 'lines', lines: b.textLines, center: b.center, indent: 0 });
        break;
      case 'ref': {
        const prev = result[result.length - 1];
        const entry = { tag: b.tag, text: b.text };
        if (b.tag) ctx.refTags.add(b.tag);
        if (prev && prev.type === 'refs' && !!prev.items[0].tag === !!b.tag) prev.items.push(entry);
        else result.push({ type: 'refs', items: [entry], indent: 0 });
        break;
      }
      case 'item': {
        const prev = result[result.length - 1];
        const m = BULLET_RE.exec(b.text) || ENUM_RE.exec(b.text);
        const marker = m ? m[1] : '';
        const ordered = !!(m && ENUM_RE.test(b.text) && !BULLET_RE.test(b.text));
        const lead = m ? b.text.slice(m[0].length) : b.text;
        const it = { marker, lead, children: [], contentIndent: 0 };
        if (prev && prev.type === 'list' && prev.ordered === ordered) prev.items.push(it);
        else result.push({ type: 'list', ordered, items: [it], indent: 0 });
        break;
      }
      default:
        if (b.type === 'para' && b.text) result.push({ type: 'para', text: b.text, center: !!b.center, indent: 0 });
    }
  }
  // 参考文献のタグがない場合 (著者名・年の形式) は箇条書きにする
  const finalBlocks = result.map((b) => (b.type === 'refs' && !b.items[0].tag ? { type: 'list', ordered: false, items: b.items.map((it) => ({ marker: '', lead: it.text, children: [] })), indent: 0, refs: true } : b));
  const toc = buildToc(finalBlocks);
  return {
    meta,
    blocks: finalBlocks,
    toc,
    refTags: [...ctx.refTags],
    ids: [...ctx.ids],
    headerLines: [],
    titleLines: [],
  };
}

function romanToInt(s) {
  const v = { I: 1, V: 5, X: 10, L: 50 };
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = v[s[i]];
    const d = v[s[i + 1]] || 0;
    n += c < d ? -c : c;
  }
  return n;
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

// 解析結果を確認用のテキストにする (scripts/pdf-extract.mjs --text とテストで使う)
export function docToText(doc) {
  const out = [`# ${doc.meta.title}`, ''];
  const walk = (blocks, indent = '') => {
    for (const b of blocks) {
      switch (b.type) {
        case 'heading':
          out.push(`${indent}${'#'.repeat(b.level + 1)} ${b.number ? `${b.number} ` : ''}${b.text}  {#${b.id}}`);
          break;
        case 'para':
          out.push(`${indent}${b.note ? '[note] ' : ''}${b.center ? '[center] ' : ''}${b.text}`);
          break;
        case 'lines':
          out.push(...b.lines.map((l) => `${indent}| ${l}`));
          break;
        case 'pre':
          out.push(`${indent}\`\`\``, ...b.lines.map((l) => indent + l), `${indent}\`\`\``);
          break;
        case 'list':
          b.items.forEach((it) => out.push(`${indent}${b.ordered ? `${it.marker} ` : '- '}${it.lead}`));
          break;
        case 'refs':
          b.items.forEach((it) => out.push(`${indent}[${it.tag}] ${it.text}`));
          break;
        case 'table':
          [...b.header, ...b.rows].forEach((r) => out.push(`${indent}|| ${r.join(' | ')}`));
          break;
        case 'figure':
          out.push(`${indent}[figure p${b.region.page + 1} ${[b.region.x0, b.region.y0, b.region.x1, b.region.y1].map((v) => Math.round(v)).join(',')}]${b.caption ? ` ${b.caption.label}: ${b.caption.text}` : ''}`);
          break;
        default:
          break;
      }
      out.push('');
    }
  };
  walk(doc.blocks);
  return out.join('\n');
}

// 行の組み立てまでの途中結果 (調査用)
function debugPages(data) {
  const ctx = makeContext(data, {});
  const prepared = data.pages.map((p, i) => preparePage(p, i, ctx));
  decideGutters(prepared, ctx);
  const pages = prepared.map((pp) => buildPageLines(pp, ctx));
  removeRunningLines(pages, ctx);
  computeGeometry(pages, ctx);
  matchOutline(pages, ctx);
  return pages;
}

export const _internal = { buildRows, findGutter, makeLine, orderLines, headingInfo, joinText, splitRefs, debugPages };
