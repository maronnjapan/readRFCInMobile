import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { parsePdfIssue, isAttachmentUrl, pdfFileName, nameFromUrl, downloadPdf, addPdf, storePdfs, deletePdfs, clearPdfs, reindexPdfs, loadPdfIndex } from '../scripts/lib/pdf-store.mjs';
import { findStoredPdf, storedPdfKey } from '../src/pdf-reader.js';

const here = dirname(fileURLToPath(import.meta.url));
const paper = readFileSync(join(here, 'fixtures/pdf/two-column.pdf'));
const nist = readFileSync(join(here, 'fixtures/pdf/nist-like.pdf'));
const PAPER_TITLE = 'Reading Order Reconstruction for Mobile Document Readers';
const NIST_TITLE = 'NIST Special Publication 800-999';
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const dirs = [];
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), 'pdf-store-'));
  dirs.push(d);
  return d;
};

test('parsePdfIssue understands save / delete / clear commands and attached files', () => {
  assert.deepEqual(parsePdfIssue('save pdf https://arxiv.org/abs/1706.03762'), { action: 'save', targets: ['https://arxiv.org/pdf/1706.03762'] });
  assert.deepEqual(parsePdfIssue('Save PDF 1706.03762, `https://example.com/A.pdf` arXiv:1706.03762'), { action: 'save', targets: ['https://arxiv.org/pdf/1706.03762', 'https://example.com/A.pdf'] });

  const attached = 'この下に PDF ファイルを添付してください。\n\n[paper v2.pdf](https://github.com/user-attachments/files/17000001/paper-v2.pdf)\n';
  assert.deepEqual(parsePdfIssue('save pdf', attached), { action: 'save', targets: ['https://github.com/user-attachments/files/17000001/paper-v2.pdf'] });
  // タイトルに URL があるときは、本文からは添付ファイルだけを使う
  assert.deepEqual(parsePdfIssue('save pdf 1706.03762', `${attached}see https://example.com/notes.pdf`), {
    action: 'save',
    targets: ['https://arxiv.org/pdf/1706.03762', 'https://github.com/user-attachments/files/17000001/paper-v2.pdf'],
  });
  // タイトルに URL が無ければ本文の URL も使う (アプリはタイトルに収まらない長い URL を本文に書く)
  assert.deepEqual(parsePdfIssue('save pdf', '次の URL から取得します。\n\nhttps://example.com/long.pdf?token=abc.'), { action: 'save', targets: ['https://example.com/long.pdf?token=abc'] });
  // 添付し忘れは save のまま返し、コメントで知らせる
  assert.deepEqual(parsePdfIssue('save pdf', 'ファイルを付け忘れた'), { action: 'save', targets: [] });

  assert.deepEqual(parsePdfIssue('delete pdf arxiv-1706.03762 paper.pdf'), { action: 'delete', targets: ['arxiv-1706.03762', 'paper.pdf'] });
  assert.deepEqual(parsePdfIssue('clear pdfs'), { action: 'clear', targets: [] });
  assert.deepEqual(parsePdfIssue('Delete all PDFs'), { action: 'clear', targets: [] });
  // すべて消すのは後ろに何も付かないときだけ (「clear pdf paper.pdf」で全部消さない)
  assert.deepEqual(parsePdfIssue('clear pdf paper.pdf'), { action: 'none', targets: [] });
  assert.deepEqual(parsePdfIssue('delete pdf'), { action: 'none', targets: [] });
  assert.deepEqual(parsePdfIssue('save rfc 9110'), { action: 'none', targets: [] });
  assert.deepEqual(parsePdfIssue('Bug: tables in PDFs are broken'), { action: 'none', targets: [] });

  assert.ok(isAttachmentUrl('https://github.com/user-attachments/files/17000001/paper.pdf'));
  assert.ok(isAttachmentUrl('https://github.com/owner/repo/files/123/paper.pdf'));
  assert.ok(!isAttachmentUrl('https://example.com/user-attachments/files/1/paper.pdf'));
});

test('file names come from arXiv ids, URLs and attached file names', () => {
  assert.equal(pdfFileName(nameFromUrl('https://arxiv.org/pdf/1706.03762v7')), 'arxiv-1706.03762v7.pdf');
  assert.equal(pdfFileName(nameFromUrl('https://arxiv.org/pdf/hep-th/9901001')), 'arxiv-hep-th-9901001.pdf');
  assert.equal(pdfFileName(nameFromUrl('https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-63-4.pdf')), 'NIST.SP.800-63-4.pdf');
  assert.equal(pdfFileName(nameFromUrl('https://github.com/user-attachments/files/1/My%20Paper%20(final).PDF')), 'My-Paper-final.pdf');
  assert.equal(pdfFileName(nameFromUrl('https://example.com/')), 'example.com.pdf');
  assert.equal(pdfFileName('論文 ドラフト.pdf'), '論文-ドラフト.pdf');
  assert.equal(pdfFileName('../../etc/passwd'), 'etc-passwd.pdf');
  assert.equal(pdfFileName(''), 'document.pdf');
});

// ローカルの HTTP サーバーを取得元にして、保存・重複の判定・index.json の更新を確認する (題名は PDF.js で解析する)
const hits = new Map();
const served = { '/paper.pdf': paper, '/mirror/paper.pdf': paper, '/nist/paper.pdf': nist };
const server = createServer((req, res) => {
  hits.set(req.url, (hits.get(req.url) || 0) + 1);
  if (served[req.url]) {
    res.writeHead(200, { 'content-type': 'application/pdf' });
    res.end(served[req.url]);
  } else if (req.url === '/page.html') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html>not a pdf</html>');
  } else if (req.url === '/broken.pdf') {
    res.writeHead(200, { 'content-type': 'application/pdf' });
    res.end('%PDF-1.7\nthis is not really a pdf\n');
  } else {
    res.writeHead(404);
    res.end('nope');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
after(() => {
  server.close();
  dirs.forEach((d) => rmSync(d, { recursive: true, force: true }));
});

test('storePdfs downloads PDFs, skips ones already stored, and reports failures', async () => {
  const dir = tempDir();
  const r1 = await storePdfs([`${base}/paper.pdf`, `${base}/page.html`, `${base}/missing.pdf`, `${base}/broken.pdf`], { dir });
  assert.deepEqual(r1.saved, [{ file: 'paper.pdf', title: PAPER_TITLE, pages: 2, size: paper.length, sha256: sha(paper), url: `${base}/paper.pdf` }]);
  assert.deepEqual(
    r1.failed.map((f) => [f.target, f.error]),
    [
      [`${base}/page.html`, 'PDF ではありません'],
      [`${base}/missing.pdf`, 'HTTP 404'],
      [`${base}/broken.pdf`, 'PDF を開けませんでした (Invalid PDF structure.)'],
    ],
  );
  assert.deepEqual(loadPdfIndex(dir), r1.saved);
  assert.ok(readFileSync(join(dir, 'paper.pdf')).equals(paper));

  // 保存済みの URL は取得し直さない。別の URL でも同じ内容なら二重に保存しない
  const r2 = await storePdfs([`${base}/paper.pdf`, `${base}/mirror/paper.pdf`], { dir });
  assert.deepEqual(r2.skipped.map((e) => e.file), ['paper.pdf', 'paper.pdf']);
  assert.equal(hits.get('/paper.pdf'), 1);

  // 名前が同じで内容が違う PDF は、ハッシュを付けた名前で新しい順の先頭に載せる
  const r3 = await storePdfs([`${base}/nist/paper.pdf`], { dir });
  assert.deepEqual(r3.saved.map((e) => [e.file, e.title]), [[`paper-${sha(nist).slice(0, 8)}.pdf`, NIST_TITLE]]);
  assert.deepEqual(loadPdfIndex(dir).map((e) => e.file), [`paper-${sha(nist).slice(0, 8)}.pdf`, 'paper.pdf']);

  await assert.rejects(downloadPdf(`${base}/paper.pdf`, { maxBytes: 1000 }), /を超えています/);
});

test('a PDF saved as a file gets its URL when the same content is saved from a URL later', async () => {
  const dir = tempDir();
  const a = await addPdf(nist, { dir, name: 'NIST SP 800-999 (draft).pdf' });
  assert.equal(a.status, 'saved');
  assert.deepEqual(a.entry, { file: 'NIST-SP-800-999-draft.pdf', title: NIST_TITLE, pages: 4, size: nist.length, sha256: sha(nist), url: '' });
  assert.equal((await addPdf(nist, { dir, name: 'again.pdf' })).status, 'exists');

  const r = await storePdfs([`${base}/nist/paper.pdf`], { dir });
  assert.deepEqual(r.linked.map((e) => e.file), ['NIST-SP-800-999-draft.pdf']);
  assert.equal(loadPdfIndex(dir)[0].url, `${base}/nist/paper.pdf`);
  assert.deepEqual(readdirSync(dir).sort(), ['NIST-SP-800-999-draft.pdf', 'index.json']);
  await assert.rejects(addPdf(Buffer.from('<html></html>'), { dir }), /PDF ではありません/);
});

test('reindexPdfs, deletePdfs and clearPdfs keep pdfs/ and index.json consistent', async () => {
  const dir = tempDir();
  await addPdf(paper, { dir, name: 'paper.pdf', url: 'https://arxiv.org/pdf/2401.00001' });
  // GitHub の画面などから直接置いた PDF は、reindex で題名を求めて先頭に載せる (載っている PDF の URL は残す)
  writeFileSync(join(dir, 'direct.pdf'), nist);
  let list = await reindexPdfs({ dir });
  assert.deepEqual(list.map((e) => [e.file, e.title, e.url]), [
    ['direct.pdf', NIST_TITLE, ''],
    ['paper.pdf', PAPER_TITLE, 'https://arxiv.org/pdf/2401.00001'],
  ]);
  rmSync(join(dir, 'direct.pdf'));
  list = await reindexPdfs({ dir });
  assert.deepEqual(list.map((e) => e.file), ['paper.pdf']);
  assert.deepEqual(loadPdfIndex(dir), list);

  await addPdf(nist, { dir, name: 'nist.pdf' });
  writeFileSync(join(dir, 'stray.pdf'), nist);
  // 元の URL、内容のハッシュ (アプリのキー)、index.json に無いファイルの名前で消せる
  const d = deletePdfs(['https://arxiv.org/abs/2401.00001', `local:${sha(nist).slice(0, 16)}`, 'stray', 'nothing.pdf'], { dir });
  assert.deepEqual(d.deleted.map((e) => e.file), ['paper.pdf', 'nist.pdf', 'stray.pdf']);
  assert.deepEqual(d.missing, ['nothing.pdf']);
  assert.deepEqual(readdirSync(dir), ['index.json']);
  assert.deepEqual(loadPdfIndex(dir), []);

  await addPdf(paper, { dir, name: 'paper.pdf' });
  writeFileSync(join(dir, 'stray.pdf'), nist);
  assert.deepEqual(clearPdfs({ dir }).deleted.map((e) => e.file), ['paper.pdf', 'stray.pdf']);
  assert.deepEqual(readdirSync(dir), ['index.json']);
  assert.deepEqual(loadPdfIndex(dir), []);
  assert.ok(!existsSync(join(dir, 'paper.pdf')));
});

test('the app finds stored PDFs by URL, by content hash (opened as a file) and by path', () => {
  const list = [
    { file: 'arxiv-1706.03762.pdf', sha256: 'ab'.repeat(32), url: 'https://arxiv.org/pdf/1706.03762' },
    { file: '論文 1.pdf', sha256: '0123456789abcdef'.repeat(4), url: '' },
  ];
  const page = 'https://example.github.io/readRFCInMobile/?pdf=x';
  assert.equal(storedPdfKey(list[0]), 'https://arxiv.org/pdf/1706.03762');
  assert.equal(storedPdfKey(list[1]), 'local:0123456789abcdef');
  assert.equal(findStoredPdf(list, 'https://arxiv.org/pdf/1706.03762', page), list[0]);
  assert.equal(findStoredPdf(list, 'https://arxiv.org/abs/1706.03762', page), list[0]);
  assert.equal(findStoredPdf(list, 'pdfs/arxiv-1706.03762.pdf', page), list[0]);
  assert.equal(findStoredPdf(list, 'local:0123456789ABCDEF', page), list[1]);
  assert.equal(findStoredPdf(list, 'https://example.github.io/readRFCInMobile/pdfs/%E8%AB%96%E6%96%87%201.pdf', page), list[1]);
  assert.equal(findStoredPdf(list, 'local:fedcba9876543210', page), null);
  assert.equal(findStoredPdf(list, 'https://arxiv.org/pdf/1706.03762v2', page), null);
  assert.equal(findStoredPdf(null, 'local:0123456789abcdef', page), null);
});
