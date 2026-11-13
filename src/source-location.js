// GitHub と同じ 1 始まりの行範囲を、整形後の本文の段落・見出し・項目に対応させる。
// 改ページのヘッダーやリストのマーカーは、表示時に取り除かれる。
const normalize = (text) => text.replace(/\s+/g, '');

export function sourceTargetIndex(source, startLine, endLine, texts) {
  if (!Number.isSafeInteger(startLine) || startLine < 1 || !Number.isSafeInteger(endLine) || endLine < startLine) return -1;
  const candidates = texts.map(normalize);
  const lines = source.replace(/\r\n?/g, '\n').split('\n').slice(startLine - 1, endLine);
  for (const line of lines) {
    const text = line.trim();
    if (!text || /^RFC\s+\d+\s{2,}/.test(text) || /\[Page\s+[\divxlc]+\]$/i.test(text)) continue;
    const queries = [
      text.replace(/^((?:\d+|[A-Z])(?:\.\d+)*)\.\s+/, '$1 '),
      text.replace(/^(?:\d+(?:\.\d+)*[.)]?|[a-zA-Z][.)]|\([\da-zA-Z]+\)|[-*o+])\s+/, ''),
    ].map(normalize).filter((query) => query.length >= 3);
    for (const query of queries) {
      let best = -1;
      for (let i = 0; i < candidates.length; i++) {
        if (candidates[i].includes(query) && (best < 0 || candidates[i].length < candidates[best].length)) best = i;
      }
      if (best >= 0) return best;
    }
  }
  return -1;
}
