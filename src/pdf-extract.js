// PDF.js で読み込んだ PDF から、ページごとの文字列・位置・フォント・タグ構造・しおりを取り出し、
// レイアウト解析 (pdf-layout.js) に渡す素朴なデータ (JSON 化できる形) にする。
// pdf.js の PDFDocumentProxy を受け取るだけなので、ブラウザでも Node (テスト用データの生成) でも動く。

const r1 = (v) => Math.round(v * 10) / 10;
const mul = (a, b) => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];

// 返り値:
// {
//   numPages, info: { title, author },
//   fonts: [{ id, family }],                 family は pdf.js の推定 (serif / sans-serif / monospace)
//   elems: [{ r: 役割, p: 親の番号 }],        Tagged PDF の構造要素 (H1, P, LI, TD など。無ければ空)
//   pages: [{ w, h, items: [{ s, x, y, w, h, f, e?, a? }] }],
//            x: 左端, y: ベースライン (ページ上端からの距離), w: 幅, h: 文字サイズ, f: フォント番号,
//            e: 構造要素の番号, a: 1 ならヘッダー・フッターなどの装飾 (Artifact)
//   outline: [{ t: 題名, d: 深さ, p: ページ番号 (0 始まり), y: 位置 (上端からの距離) | null }],
// }
export async function extractPdf(pdf, { onPage } = {}) {
  const fonts = [];
  const fontIndex = new Map();
  const elems = [];
  const pages = [];
  const viewports = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    onPage?.(i, pdf.numPages);
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    viewports.push(vp);
    const tc = await page.getTextContent({ includeMarkedContent: true });

    // Tagged PDF なら、マークされた内容の ID → 構造要素の番号 を作る
    const mcMap = new Map();
    try {
      const tree = await page.getStructTree();
      const walk = (node, parent) => {
        if (!node) return;
        if (node.type === 'content' || node.type === 'object') {
          if (node.id && parent >= 0) mcMap.set(node.id, parent);
          return;
        }
        let idx = parent;
        if (node.role && node.role !== 'Root') {
          idx = elems.length;
          elems.push({ r: node.role, p: parent });
        }
        (node.children || []).forEach((c) => walk(c, idx));
      };
      walk(tree, -1);
    } catch {
      /* 構造ツリーが壊れていても本文の取り出しは続ける */
    }

    const items = [];
    const stack = [];
    for (const it of tc.items) {
      if (it.type === 'beginMarkedContent' || it.type === 'beginMarkedContentProps') {
        stack.push({ tag: it.tag || '', id: it.id || null });
        continue;
      }
      if (it.type === 'endMarkedContent') {
        stack.pop();
        continue;
      }
      if (typeof it.str !== 'string' || !it.str) continue;
      const m = mul(vp.transform, it.transform);
      const size = Math.hypot(m[2], m[3]);
      // 回転した文字 (arXiv の余白の透かし、縦書きの表見出しなど) は本文の流れに入れない
      if (!size || Math.abs(m[1]) > Math.abs(m[0]) * 0.05 || m[0] <= 0) continue;
      const x = m[4];
      const y = m[5];
      const prev = items[items.length - 1];
      if (!it.str.trim()) {
        // 単語間の空白だけの要素は、直前の要素の末尾に空白として付ける
        if (prev && Math.abs(prev.y - y) < size * 0.3 && !/\s$/.test(prev.s)) prev.s += ' ';
        continue;
      }
      let f = fontIndex.get(it.fontName);
      if (f === undefined) {
        f = fonts.length;
        fontIndex.set(it.fontName, f);
        fonts.push({ id: it.fontName, family: tc.styles[it.fontName]?.fontFamily || '' });
      }
      const item = { s: it.str, x: r1(x), y: r1(y), w: r1(it.width || it.str.length * size * 0.5), h: r1(size), f };
      for (let k = stack.length - 1; k >= 0; k--) {
        if (stack[k].id && mcMap.has(stack[k].id)) {
          item.e = mcMap.get(stack[k].id);
          break;
        }
      }
      if (stack.some((s) => s.tag === 'Artifact')) item.a = 1;
      items.push(item);
    }
    pages.push({ w: r1(vp.width), h: r1(vp.height), items });
    page.cleanup();
  }

  const outline = [];
  try {
    const walk = async (nodes, depth) => {
      for (const n of nodes || []) {
        const entry = { t: String(n.title || '').trim(), d: depth, p: -1, y: null };
        try {
          const dest = typeof n.dest === 'string' ? await pdf.getDestination(n.dest) : n.dest;
          if (Array.isArray(dest) && dest.length) {
            const ref = dest[0];
            entry.p = Number.isInteger(ref) ? ref : await pdf.getPageIndex(ref);
            const kind = dest[1] && dest[1].name;
            const args = dest.slice(2);
            const top = kind === 'XYZ' ? args[1] : kind === 'FitH' || kind === 'FitBH' ? args[0] : kind === 'FitR' ? args[3] : null;
            const vp = viewports[entry.p];
            if (vp && typeof top === 'number') entry.y = r1(vp.convertToViewportPoint(typeof args[0] === 'number' && kind === 'XYZ' ? args[0] : 0, top)[1]);
          }
        } catch {
          /* 解決できないしおりは位置なしで残す */
        }
        if (entry.t) outline.push(entry);
        await walk(n.items, depth + 1);
      }
    };
    await walk(await pdf.getOutline(), 0);
  } catch {
    /* しおりなし */
  }

  let info = {};
  try {
    const meta = await pdf.getMetadata();
    info = { title: String(meta?.info?.Title || '').trim(), author: String(meta?.info?.Author || '').trim() };
  } catch {
    /* メタデータなし */
  }
  return { numPages: pdf.numPages, info, fonts, elems, pages, outline };
}
