// PDF をレイアウト解析用の JSON (src/pdf-extract.js の出力) に変換する。テスト用データの作成や解析結果の確認に使う。
//   node scripts/pdf-extract.mjs paper.pdf > paper.json         抽出結果 (JSON)
//   node scripts/pdf-extract.mjs --text paper.pdf               解析結果を読みやすいテキストで表示
//   node scripts/pdf-extract.mjs --html paper.pdf > out.html    解析結果を HTML で出力
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extractPdf } from '../src/pdf-extract.js';
import { layoutPdf, docToText } from '../src/pdf-layout.js';
import { renderDocument } from '../src/render.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const mode = args[0] === '--text' || args[0] === '--html' ? args.shift().slice(2) : 'json';
const file = args[0];
if (!file) {
  console.error('usage: node scripts/pdf-extract.mjs [--text|--html] file.pdf|file.json');
  process.exit(1);
}

let data;
if (file.endsWith('.json')) {
  data = JSON.parse(readFileSync(file, 'utf8'));
} else {
  const pdfjs = await import(pathToFileURL(join(root, 'vendor/pdfjs/pdf.min.mjs')).href);
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(join(root, 'vendor/pdfjs/pdf.worker.min.mjs')).href;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(file)), verbosity: 0 }).promise;
  data = await extractPdf(pdf);
  await pdf.loadingTask.destroy();
}

if (mode === 'json') {
  process.stdout.write(`${JSON.stringify(data)}\n`);
} else {
  const doc = layoutPdf(data);
  if (mode === 'text') process.stdout.write(docToText(doc));
  else {
    const { html } = renderDocument(doc);
    process.stdout.write(`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(join(root, 'styles.css')).href}"><main>${html}</main>\n`);
  }
}
