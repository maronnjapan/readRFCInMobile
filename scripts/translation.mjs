#!/usr/bin/env node
// 日本語訳の翻訳ファイルのひな形を作る・検査する。訳文は自分で (またはお好みの方法で) 書き込む。
//
//   node scripts/translation.mjs template rfc 7591          rfcs/ja/rfc7591.json のひな形を作る
//   node scripts/translation.mjs template pdf paper.pdf     PDF (ファイルか URL) から pdfs/ja/<ID>.json のひな形を作る
//   node scripts/translation.mjs check                      rfcs/ja/・pdfs/ja/ の翻訳ファイルを検査し、訳した数を表示する
//
// ひな形は原文の見出し・段落などを "src" に、空の訳文を "dst" に並べたもの。既にファイルがあれば訳文を引き継いで、
// 原文に足りない項目だけ足す (アプリを更新して解析結果が変わったときに使う)。
// --lang <code> で ja 以外の言語、--out <path> で書き出し先を指定できる。依存パッケージなし (Node 18 以降)。
import { relative } from 'node:path';
import { rfcTemplate, pdfTemplate, checkTranslations } from './lib/translation-store.mjs';
import { repoRoot } from './lib/rfc-store.mjs';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const lang = opt('--lang') || 'ja';
const out = opt('--out');
const verbose = args.includes('--verbose') ? args.splice(args.indexOf('--verbose'), 1) && true : false;
const [cmd, kind, ...rest] = args;
const rel = (f) => relative(process.cwd(), f) || f;
const log = (s) => console.log(s);
const usage = () => {
  console.error('使い方: node scripts/translation.mjs template rfc <番号...> | template pdf <ファイル|URL...> | check [--verbose]');
  process.exit(1);
};

if (cmd === 'template' && kind === 'rfc' && rest.length) {
  const numbers = rest.flatMap((a) => a.split(/[\s,]+/)).map((a) => a.replace(/^rfc/i, '')).filter((a) => /^\d+$/.test(a)).map(Number);
  if (!numbers.length || (out && numbers.length > 1)) usage();
  for (const n of numbers) {
    const r = await rfcTemplate(n, { lang, out, log });
    log(`${rel(r.file)}: ${r.segments} 項目 (訳文あり ${r.translated})${r.previous ? ' — 既存の訳文を引き継ぎました' : ''}`);
  }
} else if (cmd === 'template' && kind === 'pdf' && rest.length) {
  if (out && rest.length > 1) usage();
  for (const input of rest) {
    const r = await pdfTemplate(input, { lang, out, log });
    log(`${rel(r.file)}: ${r.segments} 項目 (訳文あり ${r.translated})${r.previous ? ' — 既存の訳文を引き継ぎました' : ''}`);
  }
} else if (cmd === 'check' && !kind) {
  const results = checkTranslations(repoRoot);
  if (!results.length) log('翻訳ファイルはありません (rfcs/ja/rfcNNNN.json、pdfs/ja/<ID>.json)。');
  let bad = 0;
  for (const r of results) {
    const head = rel(r.file);
    if (r.errors.length) {
      bad++;
      log(`x ${head}: ${r.errors.join(' / ')}`);
      continue;
    }
    const stat = r.total !== undefined ? `訳文 ${r.translated} / ${r.total} 項目` : `訳文 ${r.filled} / ${r.segments} 項目`;
    const unused = r.unused?.length ? `、原文に見つからない訳文 ${r.unused.length} 件` : '';
    log(`${r.warnings.length || r.unused?.length ? '!' : 'o'} ${head}: ${stat}${unused}`);
    for (const w of r.warnings) log(`    ${w}`);
    for (const u of (r.unused || []).slice(0, verbose ? Infinity : 3)) log(`    原文に見つからない: ${u.length > 80 ? `${u.slice(0, 80)}…` : u}`);
    if (!verbose && r.unused?.length > 3) log('    (--verbose ですべて表示)');
  }
  if (results.some((r) => r.unused?.length)) {
    log('原文に見つからない訳文は、アプリの更新で段落の区切りが変わったか、原文が違う可能性があります。template で作り直すと、今の原文の項目が並びます (訳文は引き継がれます)。');
  }
  process.exit(bad ? 1 : 0);
} else {
  usage();
}
