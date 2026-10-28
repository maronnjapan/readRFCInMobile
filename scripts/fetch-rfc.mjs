#!/usr/bin/env node
// RFC のプレーンテキストを rfc-editor.org から取得して rfcs/ に保存し、rfcs/index.json を更新する。
//
//   node scripts/fetch-rfc.mjs 9110 6749 2616
//   node scripts/fetch-rfc.mjs --reindex        # index.json だけ作り直す
//
// 依存パッケージなし (Node 18 以降)。
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRfc } from '../src/rfc-parser.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'rfcs');
mkdirSync(dir, { recursive: true });

const SOURCES = [(n) => `https://www.rfc-editor.org/rfc/rfc${n}.txt`, (n) => `https://www.ietf.org/rfc/rfc${n}.txt`];

async function fetchText(n) {
  let lastErr;
  for (const src of SOURCES) {
    const url = src(n);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'readRFCInMobile/1.0 (+https://github.com/maronnjapan/readRFCInMobile)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!/Request for Comments|RFC\s*:?\s*\d|Network Working Group|Internet Engineering Task Force/i.test(text.slice(0, 4000))) {
        throw new Error('RFC のテキストではありません');
      }
      return text;
    } catch (e) {
      lastErr = new Error(`${url}: ${e.message}`);
      console.warn(`  ! ${lastErr.message}`);
    }
  }
  throw lastErr;
}

function reindex() {
  const list = readdirSync(dir)
    .filter((f) => /^rfc\d+\.txt$/.test(f))
    .map((f) => {
      const number = Number(f.match(/\d+/)[0]);
      const doc = parseRfc(readFileSync(join(dir, f), 'utf8'), { number });
      return { number, title: doc.meta.title, date: doc.meta.date || '', category: doc.meta.category || '' };
    })
    .sort((a, b) => a.number - b.number);
  writeFileSync(join(dir, 'index.json'), `${JSON.stringify(list, null, 2)}\n`);
  console.log(`index.json: ${list.length} 件`);
  return list;
}

const args = process.argv.slice(2);
const numbers = args.flatMap((a) => a.split(/[\s,]+/)).map((a) => a.replace(/^rfc/i, '')).filter((a) => /^\d+$/.test(a)).map(Number);
if (!numbers.length && !args.includes('--reindex')) {
  console.error('使い方: node scripts/fetch-rfc.mjs <RFC番号> [<RFC番号> ...] | --reindex');
  process.exit(1);
}
let failed = 0;
for (const n of numbers) {
  const file = join(dir, `rfc${n}.txt`);
  if (existsSync(file) && !args.includes('--force')) {
    console.log(`rfc${n}.txt は既にあります (上書きするには --force)`);
    continue;
  }
  console.log(`RFC ${n} を取得中…`);
  try {
    writeFileSync(file, await fetchText(n));
    console.log(`  -> ${file}`);
  } catch (e) {
    failed++;
    console.error(`  x RFC ${n} の取得に失敗: ${e.message}`);
  }
}
reindex();
process.exit(failed ? 1 : 0);
