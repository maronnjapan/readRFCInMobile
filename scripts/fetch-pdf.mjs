#!/usr/bin/env node
// PDF を pdfs/ に保存し、pdfs/index.json を更新する。
//
//   node scripts/fetch-pdf.mjs https://arxiv.org/abs/1706.03762   # URL (arXiv の ID も可) から取得して保存
//   node scripts/fetch-pdf.mjs ~/Downloads/paper.pdf              # 手元のファイルを保存
//   node scripts/fetch-pdf.mjs --delete arxiv-1706.03762          # 削除 (ファイル名・元の URL で指定)
//   node scripts/fetch-pdf.mjs --clear                            # pdfs/ の PDF をすべて削除
//   node scripts/fetch-pdf.mjs --reindex                          # index.json を pdfs/ の中身に合わせる (直接置いた PDF を登録)
//
// 依存パッケージなし (Node 18 以降)。題名は vendor/pdfjs の PDF.js で解析して求める。
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { addPdf, storePdfs, deletePdfs, clearPdfs, reindexPdfs } from './lib/pdf-store.mjs';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const targets = args.filter((a) => !a.startsWith('--'));
const log = (s) => console.log(s);

if (flags.has('--clear')) {
  const r = clearPdfs({ log });
  console.log(`${r.deleted.length} 件削除しました。index.json を更新しました。`);
} else if (flags.has('--delete')) {
  if (!targets.length) {
    console.error('削除する PDF のファイル名か URL を指定してください。');
    process.exit(1);
  }
  const r = deletePdfs(targets, { log });
  if (r.missing.length) console.log(`見つからなかったもの: ${r.missing.join(', ')}`);
  console.log(`${r.deleted.length} 件削除しました。index.json を更新しました。`);
} else if (flags.has('--reindex') && !targets.length) {
  const list = await reindexPdfs({ log });
  console.log(`index.json: ${list.length} 件`);
} else if (targets.length) {
  const isFile = (p) => existsSync(p) && statSync(p).isFile();
  const r = await storePdfs(targets.filter((t) => !isFile(t)), { log });
  for (const path of targets.filter(isFile)) {
    log(`${path} を保存中…`);
    try {
      const { status, entry } = await addPdf(readFileSync(path), { name: basename(path), log });
      (status === 'saved' ? r.saved : r.skipped).push(entry);
    } catch (e) {
      log(`  x ${path}: ${e.message}`);
      r.failed.push({ target: path, error: e.message });
    }
  }
  console.log(`保存 ${r.saved.length + r.linked.length} 件、スキップ ${r.skipped.length} 件、失敗 ${r.failed.length} 件。index.json を更新しました。`);
  process.exit(r.failed.length ? 1 : 0);
} else {
  console.error('使い方: node scripts/fetch-pdf.mjs <URL|arXiv ID|ファイル...> | --delete <ファイル名|URL...> | --clear | --reindex');
  process.exit(1);
}
