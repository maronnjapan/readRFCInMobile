import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { parseIssueTitle, storeRfcs, deleteRfcs, clearRfcs, listStored, reindex } from '../scripts/lib/rfc-store.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(here, 'fixtures/v3-sample.txt'), 'utf8');

test('parseIssueTitle understands save / delete / clear commands', () => {
  assert.deepEqual(parseIssueTitle('save rfc 9110'), { action: 'save', numbers: [9110] });
  assert.deepEqual(parseIssueTitle('Save RFC 9110, 6749 and 2616'), { action: 'save', numbers: [9110, 6749, 2616] });
  assert.deepEqual(parseIssueTitle('store rfcs 1 1'), { action: 'save', numbers: [1] });
  assert.deepEqual(parseIssueTitle('delete rfc 9110'), { action: 'delete', numbers: [9110] });
  assert.deepEqual(parseIssueTitle('remove rfcs 1 2'), { action: 'delete', numbers: [1, 2] });
  assert.deepEqual(parseIssueTitle('clear rfcs'), { action: 'clear', numbers: [] });
  assert.deepEqual(parseIssueTitle('delete all rfcs'), { action: 'clear', numbers: [] });
  assert.deepEqual(parseIssueTitle('save rfc'), { action: 'none', numbers: [] });
  assert.deepEqual(parseIssueTitle('Bug: the TOC is broken for RFC 2616'), { action: 'none', numbers: [] });
  assert.deepEqual(parseIssueTitle(''), { action: 'none', numbers: [] });
});

// ローカルの HTTP サーバーを取得元にして、保存・削除・index.json の更新を確認する
const dir = mkdtempSync(join(tmpdir(), 'rfc-store-'));
const server = createServer((req, res) => {
  if (req.url === '/rfc99999.txt') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end(fixture);
  } else if (req.url === '/rfc42.txt') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html>not an rfc</html>');
  } else {
    res.writeHead(404);
    res.end('nope');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
process.env.RFC_SOURCE_URL = `http://127.0.0.1:${server.address().port}/rfc{n}.txt`;
after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

test('storeRfcs saves the text, skips existing files, reports failures, and updates index.json', async () => {
  const r1 = await storeRfcs([99999, 42, 7], { dir });
  assert.deepEqual(r1.saved, [99999]);
  assert.equal(r1.failed.length, 2, 'non-RFC content and missing files both fail');
  assert.ok(existsSync(join(dir, 'rfc99999.txt')));
  assert.ok(!existsSync(join(dir, 'rfc42.txt')));
  const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
  assert.equal(index.length, 1);
  assert.equal(index[0].number, 99999);
  assert.equal(index[0].title, 'A Sample Protocol in RFCXML v3 Text');

  const r2 = await storeRfcs([99999], { dir });
  assert.deepEqual(r2.skipped, [99999]);
  assert.deepEqual(r2.saved, []);
});

test('deleteRfcs and clearRfcs remove files and reindex', async () => {
  writeFileSync(join(dir, 'rfc5.txt'), fixture);
  writeFileSync(join(dir, 'rfc6.txt'), fixture);
  reindex(dir);
  assert.deepEqual(listStored(dir), [5, 6, 99999]);

  const d = deleteRfcs([5, 8], { dir });
  assert.deepEqual(d, { deleted: [5], missing: [8] });
  assert.deepEqual(listStored(dir), [6, 99999]);
  assert.equal(JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')).length, 2);

  const c = clearRfcs({ dir });
  assert.deepEqual(c.deleted, [6, 99999]);
  assert.deepEqual(listStored(dir), []);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')), []);
});
