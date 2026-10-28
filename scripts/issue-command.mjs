#!/usr/bin/env node
// GitHub Issue のタイトル (環境変数 ISSUE_TITLE) をコマンドとして実行する。
// GitHub Actions (store-rfc.yml) から呼ばれ、結果を $GITHUB_OUTPUT に書き出す。
//   action  : save | delete | clear | none
//   ok      : true | false
//   changed : true | false   (rfcs/ に変更があったか)
//   commit_message, summary (Issue へのコメント本文)
import { appendFileSync } from 'node:fs';
import { parseIssueTitle, storeRfcs, deleteRfcs, clearRfcs } from './lib/rfc-store.mjs';

const title = process.env.ISSUE_TITLE ?? process.argv.slice(2).join(' ');
const siteUrl = (process.env.SITE_URL || '').replace(/\/?$/, '/');
const { action, numbers } = parseIssueTitle(title);
const log = (s) => console.log(s);
const link = (n) => (siteUrl ? `[RFC ${n}](${siteUrl}?rfc=${n})` : `RFC ${n}`);

let ok = true;
let changed = false;
let commitMessage = '';
const lines = [];

if (action === 'save') {
  const r = await storeRfcs(numbers, { log });
  changed = r.saved.length > 0;
  ok = r.failed.length === 0;
  commitMessage = `Store RFC text: ${r.saved.join(', ')}`;
  if (r.saved.length) lines.push(`保存しました: ${r.saved.map(link).join(', ')}`);
  if (r.skipped.length) lines.push(`既に保存済みでした: ${r.skipped.map(link).join(', ')}`);
  if (r.failed.length) lines.push(`取得に失敗しました: ${r.failed.map((f) => `RFC ${f.n} (${f.error})`).join(', ')}`);
  if (changed) lines.push('', 'サイトの再デプロイが終わると（数分後）、上のリンクから読めるようになります。');
} else if (action === 'delete') {
  const r = deleteRfcs(numbers, { log });
  changed = r.deleted.length > 0;
  commitMessage = `Delete RFC text: ${r.deleted.join(', ')}`;
  if (r.deleted.length) lines.push(`削除しました: ${r.deleted.map((n) => `RFC ${n}`).join(', ')}`);
  if (r.missing.length) lines.push(`保存されていませんでした: ${r.missing.map((n) => `RFC ${n}`).join(', ')}`);
} else if (action === 'clear') {
  const r = clearRfcs({ log });
  changed = r.deleted.length > 0;
  commitMessage = `Clear stored RFC text (${r.deleted.length} files)`;
  lines.push(r.deleted.length ? `保存済みの RFC テキストを ${r.deleted.length} 件削除しました: ${r.deleted.map((n) => `RFC ${n}`).join(', ')}` : '削除対象の RFC テキストはありませんでした。');
} else {
  lines.push('このタイトルはコマンドとして認識されませんでした。');
}

const summary = `${lines.join('\n')}\n\n---\n_readRFCInMobile の自動処理 (Issue のタイトル: \`${String(title).replace(/`/g, '')}\`)_`;
console.log(`action=${action} ok=${ok} changed=${changed}`);
console.log(summary);

if (process.env.GITHUB_OUTPUT) {
  const out = [`action=${action}`, `ok=${ok}`, `changed=${changed}`, `commit_message=${commitMessage}`, 'summary<<__EOF__', summary, '__EOF__', ''].join('\n');
  appendFileSync(process.env.GITHUB_OUTPUT, out);
}
