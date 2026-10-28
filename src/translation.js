// 翻訳ファイル (日本語訳) の読み込み・検査・ひな形の作成と、文書構造への適用。
// 翻訳ファイルは、原文の見出し・段落・箇条書き・表のセル・図表の説明などの文字列 (src) と訳文 (dst) の組を並べたもの。
// 表示するときは原文を解析した構造 (rfc-parser.js / pdf-layout.js の出力) の文字列だけを訳文に置き換えるので、
// コード・図・表の組み方、リンク、PDF から切り出した図などの見た目は原文と同じになる。
// DOM に依存しないので Node のスクリプト・テストからも、ブラウザからも同じコードを使う。

export const FORMAT = 'rfcreader-translation';
export const VERSION = 1;

export const rfcTranslationPath = (n, lang = 'ja') => `rfcs/${lang}/rfc${n}.json`;
export const pdfTranslationPath = (id, lang = 'ja') => `pdfs/${lang}/${id}.json`;

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
// 空白・記号・大文字小文字の違いを無視したキー。解析の細かな変更で原文の表記が少し変わっても訳文を見つけられるようにする
const loose = (s) => norm(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// 訳す対象か: 文字を含み、空白のない識別子・URL・URN・パス ("client_id", "application/json", "urn:ietf:params:oauth", "SHA-256") ではないもの
function translatable(text) {
  const t = norm(text);
  if (!/\p{L}/u.test(t)) return false;
  if (!/\s/.test(t) && (/[_/@=<>{}[\]\\|#$%^~`\d]|:(?!$)/.test(t) || /^[a-z]+[A-Z]/.test(t))) return false;
  return true;
}

// 著者の連絡先 (名前・所属・メールアドレスの行) は訳さない
const ADDRESS_RE = /^(?:authors?|editors?)['’]?s?['’]?\s+address(?:es)?$/i;

// 日本語訳で置き換える図表・付録の見出しの語
const LABELS = {
  ja: [
    [/^(?:Figure|Fig\.|FIGURE)\s+/, '図 '],
    [/^(?:Table|TABLE)\s+/, '表 '],
    [/^(?:Appendix|APPENDIX|Annex|ANNEX)\s+/, '付録 '],
  ],
};
const localize = (s, lang) => (LABELS[lang] || []).reduce((acc, [re, to]) => acc.replace(re, to), s);

// 文書の中の訳す文字列を、出てくる順にたどる。visit(text, set) の set(訳文) で置き換える (set を呼ばなければ変更しない)。
// labels を指定すると、図表の番号 ("Figure 1" → "図 1") と付録の番号 ("Appendix A" → "付録 A") もその言語にする
function walkTexts(doc, visit, { labels } = {}) {
  const meta = doc.meta || {};
  const text = (s, set) => {
    if (typeof s === 'string' && translatable(s)) visit(s, set);
  };
  const caption = (cap) => {
    if (!cap) return;
    text(cap.text, (t) => {
      cap.text = t;
    });
    if (labels && cap.label) cap.label = localize(cap.label, labels);
  };
  text(meta.title, (t) => {
    meta.title = t;
  });
  let inAddresses = false;
  const blocks = (list, depth) => {
    for (const b of list || []) {
      switch (b.type) {
        case 'heading':
          if (depth === 0) inAddresses = ADDRESS_RE.test(norm(b.text)) || (inAddresses && b.level > 1);
          text(b.text, (t) => {
            // 英語の見出しを手がかりにする処理 (目次の位置など) のために原文を残す
            b.orig = b.text;
            b.text = t;
          });
          if (labels && b.number) b.number = localize(b.number, labels);
          break;
        case 'para':
          text(b.text, (t) => {
            b.text = t;
          });
          break;
        case 'lines':
          if (!inAddresses) {
            text(
              b.lines.map((l) => l.trim()).filter(Boolean).join('\n'),
              (t) => {
                b.lines = t.split('\n');
              },
            );
          }
          caption(b.caption);
          break;
        case 'pre':
        case 'figure':
          caption(b.caption);
          break;
        case 'table':
          for (const row of [...(b.header || []), ...(b.rows || [])]) {
            row.forEach((cell, i) =>
              text(cell, (t) => {
                row[i] = t;
              }),
            );
          }
          caption(b.caption);
          break;
        case 'list':
          // PDF の参考文献 (番号のない書誌情報の箇条書き) は訳さない
          if (b.refs) break;
          for (const it of b.items) {
            text(it.lead, (t) => {
              it.lead = t;
            });
            blocks(it.children, depth + 1);
          }
          break;
        case 'dl':
          for (const it of b.items) {
            text(it.term, (t) => {
              it.term = t;
            });
            text(it.lead, (t) => {
              it.lead = t;
            });
            blocks(it.children, depth + 1);
          }
          break;
        default:
          // refs (参考文献)、tocraw (原文の目次) は訳さない
          break;
      }
    }
  };
  blocks(doc.blocks, 0);
  const toc = (nodes) => {
    for (const n of nodes || []) {
      text(n.text, (t) => {
        n.text = t;
      });
      if (labels && n.number) n.number = localize(n.number, labels);
      toc(n.children);
    }
  };
  toc(doc.toc);
}

// 訳す文字列を、出てくる順に重複なしで返す
export function collectSegments(doc) {
  const out = [];
  const seen = new Set();
  walkTexts(doc, (text) => {
    const k = norm(text);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(text);
  });
  return out;
}

function lookup(segments) {
  const exact = new Map();
  const fuzzy = new Map();
  for (const s of segments || []) {
    if (!s || typeof s.src !== 'string' || typeof s.dst !== 'string' || !s.dst.trim()) continue;
    exact.set(norm(s.src), s.dst);
    const k = loose(s.src);
    if (k && !fuzzy.has(k)) fuzzy.set(k, s.dst);
  }
  return (text) => exact.get(norm(text)) ?? fuzzy.get(loose(text));
}

// 翻訳を文書に当てはめた複製を返す。訳文のない文字列は原文のまま残す。
// 返り値: { doc, total: 訳す文字列の数, translated: そのうち訳文があった数 }
export function applyTranslation(doc, translation) {
  const find = lookup(translation.segments);
  const out = structuredClone(doc);
  const seen = new Map();
  walkTexts(
    out,
    (text, set) => {
      const dst = find(text);
      const k = norm(text);
      if (!seen.has(k)) seen.set(k, dst !== undefined);
      if (dst !== undefined) set(dst);
    },
    { labels: translation.lang || 'ja' },
  );
  let translated = 0;
  for (const hit of seen.values()) if (hit) translated++;
  return { doc: out, total: seen.size, translated };
}

// 翻訳ファイルが今の原文にどれだけ合っているか。unused は、原文に見つからない (解析結果が変わった・原文が違う) 訳文の src
export function translationCoverage(doc, translation) {
  const { total, translated } = applyTranslation(doc, translation);
  const segs = collectSegments(doc);
  const exact = new Set(segs.map(norm));
  const fuzzy = new Set(segs.map(loose));
  const unused = (translation.segments || [])
    .filter((s) => s.dst && s.dst.trim() && !exact.has(norm(s.src)) && !fuzzy.has(loose(s.src)))
    .map((s) => s.src);
  return { total, translated, unused };
}

// 読み込んだ JSON を検査して、扱いやすい形 (dst は必ず文字列) にする。形が違えば分かりやすいメッセージの Error を投げる
export function parseTranslation(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('翻訳ファイルの中身が JSON のオブジェクトではありません。');
  if (data.format !== undefined && data.format !== FORMAT) throw new Error(`"format" は "${FORMAT}" にしてください (現在: ${JSON.stringify(data.format)})。`);
  if (data.version !== undefined && data.version !== VERSION) throw new Error(`"version" ${JSON.stringify(data.version)} には対応していません (対応しているのは ${VERSION})。`);
  if (data.lang !== undefined && (typeof data.lang !== 'string' || !data.lang)) throw new Error('"lang" は "ja" のような文字列にしてください。');
  if (!Array.isArray(data.segments)) throw new Error('"segments" (原文と訳文の組の配列) がありません。');
  const segments = data.segments.map((s, i) => {
    if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Error(`segments[${i}] が {"src": ..., "dst": ...} の形ではありません。`);
    if (typeof s.src !== 'string') throw new Error(`segments[${i}] の "src" (原文) が文字列ではありません。`);
    if (s.dst !== undefined && s.dst !== null && typeof s.dst !== 'string') throw new Error(`segments[${i}] の "dst" (訳文) が文字列ではありません。`);
    return { src: s.src, dst: s.dst ?? '' };
  });
  return { ...data, lang: data.lang || 'ja', segments };
}

// 訳文の記入用のひな形を作る。previous (既存の翻訳ファイル) があれば、同じ原文の訳文を引き継ぐ。
// 今の原文に見つからなくなった訳文も、作業が失われないよう末尾に残す (translation.mjs check で一覧できる)
export function makeTemplate(doc, { source = {}, lang = 'ja', previous = null } = {}) {
  const segs = collectSegments(doc);
  const find = lookup(previous?.segments);
  const segments = segs.map((src) => ({ src, dst: find(src) ?? '' }));
  const exact = new Set(segs.map(norm));
  const fuzzy = new Set(segs.map(loose));
  const kept = (previous?.segments || []).filter((s) => s.dst && s.dst.trim() && !exact.has(norm(s.src)) && !fuzzy.has(loose(s.src)));
  const out = { format: FORMAT, version: VERSION, lang: previous?.lang || lang, source };
  if (previous?.note) out.note = previous.note;
  out.segments = [...segments, ...kept];
  return out;
}

// 1 行に 1 組ずつ書き出す (差分が見やすく、手で編集しやすいように)
export function stringifyTranslation(translation) {
  const { segments = [], ...head } = translation;
  const top = JSON.stringify({ ...head, segments: [] }, null, 2);
  const body = segments.map((s) => `    {"src": ${JSON.stringify(s.src)}, "dst": ${JSON.stringify(s.dst ?? '')}}`).join(',\n');
  return `${top.replace(/"segments": \[\]\n\}$/, body ? `"segments": [\n${body}\n  ]\n}` : '"segments": []\n}')}\n`;
}

// 訳文の題名 (翻訳されていなければ空文字)
export function translatedTitle(doc, translation) {
  if (!doc.meta?.title) return '';
  return lookup(translation.segments)(doc.meta.title) || '';
}
