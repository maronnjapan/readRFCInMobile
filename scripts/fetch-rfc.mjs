#!/usr/bin/env node
// RFC のプレーンテキストを rfc-editor.org から取得して rfcs/ に保存し、rfcs/index.json を更新する。
//
//   node scripts/fetch-rfc.mjs 9110 6749 2616     # 取得して保存
//   node scripts/fetch-rfc.mjs --force 9110        # 既にあっても上書き
//   node scripts/fetch-rfc.mjs --delete 9110 6749  # 削除
//   node scripts/fetch-rfc.mjs --clear             # rfcs/ の RFC テキストをすべて削除
//   node scripts/fetch-rfc.mjs --reindex           # index.json だけ作り直す
//
// 環境変数 RFC_SOURCE_URL="https://example.com/rfc{n}.txt" で取得元を差し替えられる。
// 依存パッケージなし (Node 18 以降)。
import { storeRfcs, deleteRfcs, clearRfcs, reindex } from './lib/rfc-store.mjs';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const numbers = args
  .filter((a) => !a.startsWith('--'))
  .flatMap((a) => a.split(/[\s,]+/))
  .map((a) => a.replace(/^rfc/i, ''))
  .filter((a) => /^\d+$/.test(a))
  .map(Number);
const log = (s) => console.log(s);

if (flags.has('--clear')) {
  const r = clearRfcs({ log });
  console.log(`${r.deleted.length} 件削除しました。index.json を更新しました。`);
} else if (flags.has('--delete')) {
  if (!numbers.length) {
    console.error('削除する RFC 番号を指定してください。');
    process.exit(1);
  }
  const r = deleteRfcs(numbers, { log });
  if (r.missing.length) console.log(`見つからなかった番号: ${r.missing.join(', ')}`);
  console.log(`${r.deleted.length} 件削除しました。index.json を更新しました。`);
} else if (flags.has('--reindex') && !numbers.length) {
  const list = reindex();
  console.log(`index.json: ${list.length} 件`);
} else if (numbers.length) {
  const r = await storeRfcs(numbers, { force: flags.has('--force'), log });
  console.log(`保存 ${r.saved.length} 件、スキップ ${r.skipped.length} 件、失敗 ${r.failed.length} 件。index.json を更新しました。`);
  process.exit(r.failed.length ? 1 : 0);
} else {
  console.error('使い方: node scripts/fetch-rfc.mjs <RFC番号...> | --force <番号...> | --delete <番号...> | --clear | --reindex');
  process.exit(1);
}
