import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startQuizWorker, patternsFixture, accessToken } from '../test-support/quiz-worker.mjs';
import { isImmediate } from '../shared/quiz-types.js';
let worker, set;
before(async () => { worker = await startQuizWorker(); set = await worker.publish(patternsFixture, '6'.repeat(40)); });
after(async () => { await worker?.mf.dispose(); });
const get = (path, subject = 'reader') => worker.client(subject)(path);
const post = (path, fields = {}, { subject = 'reader', json = false, origin = 'https://reader.test' } = {}) => worker.mf.dispatchFetch(`https://reader.test${path}`, {
  method: 'POST', redirect: 'manual', headers: { 'cf-access-jwt-assertion': accessToken(subject), Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded', Accept: json ? 'application/json' : 'text/html' }, body: new URLSearchParams(fields).toString(),
});
async function start(setId = set.id) {
  const response = await post('/quiz/attempts', { setId });
  assert.equal(response.status, 303);
  const location = response.headers.get('location');
  return { id: new URL(location, 'https://reader.test').searchParams.get('attempt'), location };
}
async function answer(id, q, value = patternsFixture.solutions[q.id].answer) {
  const response = await post(`/quiz/attempts/${id}/instant-answers`, { questionId: q.id, [q.id]: q.type === 'ordering' ? JSON.stringify(value) : String(value) });
  assert.equal(response.status, 303);
  return response.headers.get('location');
}

test('Hono renders list, setup and first question in the HTTP response without a static HTML shell', async () => {
  const list = await get('/quiz');
  assert.equal(list.status, 200);
  assert.equal(list.headers.get('cache-control'), 'private, no-store');
  assert.match(list.headers.get('content-type'), /text\/html/);
  assert.ok((await list.text()).includes(patternsFixture.title));
  const setup = await (await get(`/quiz?set=${set.id}`)).text();
  assert.match(setup, /全6問/);
  assert.match(setup, /action="\/quiz\/attempts"/);
  const run = await start();
  const html = await (await get(run.location)).text();
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /redirect_uris/);
  assert.match(html, /即時採点 1 \/ 5/);
  assert.match(html, /href="\/\?rfc=7591#L417-L444"/);
  assert.match(html, /RFC 7591 の該当箇所/);
  assert.ok(!html.includes('https://github.com/maronnjapan/readRFCInMobile/blob/'));
  assert.ok(!html.includes(patternsFixture.questions[1].prompt), 'future questions are not rendered');
  assert.ok(!html.includes('solutions'));
  assert.ok(!html.includes('sourceMaterials'));
  assert.equal((await worker.mf.dispatchFetch('https://reader.test/quiz')).status, 200);
  assert.equal((await get(`/quiz?attempt=${run.id}`, 'other')).status, 404);
  const alias = await worker.mf.dispatchFetch('https://reader.test/quiz.html?spec=rfc-7591', { redirect: 'manual' });
  assert.equal(alias.headers.get('location'), '/quiz?spec=rfc-7591');
});

test('Hono form actions save and immediately grade one choice before the next question', async () => {
  const run = await start();
  const location = await answer(run.id, patternsFixture.questions[0], 3);
  const html = await (await get(location)).text();
  assert.match(html, /不正解/);
  assert.ok(html.includes(patternsFixture.solutions['redirect-uris-meaning'].explanation));
  assert.match(html, /href="\/\?rfc=7591#L417-L444"/);
  assert.match(html, /id="next-question"/);
  assert.ok(!html.includes(patternsFixture.questions[1].prompt));
  assert.equal((await post(`/quiz/attempts/${run.id}/instant-answers`, { questionId: 'redirect-uris-meaning', 'redirect-uris-meaning': '0' }, { json: true })).status, 409);
  assert.equal(worker.executions.size, 0);
});

test('ordering can be answered through Hono forms including native select fields without JavaScript', async () => {
  const run = await start();
  for (const q of patternsFixture.questions.slice(0, 2)) await answer(run.id, q);
  const page = await (await get(`/quiz?attempt=${run.id}`)).text();
  assert.match(page, /id="ordering-editor"/);
  assert.match(page, /<noscript>/);
  const order = patternsFixture.solutions['registration-order'].answer;
  const response = await post(`/quiz/attempts/${run.id}/instant-answers`, [['questionId', 'registration-order'], ...order.map((id) => ['order', id])], { json: true });
  assert.equal(response.status, 200);
  const html = await (await get((await response.json()).location)).text();
  assert.match(html, /正解 · 2 \/ 2点/);
  assert.equal(worker.executions.size, 0);
});

test('written save, separate grading request and raw AI text produce a Hono result page', async () => {
  const run = await start();
  for (const q of patternsFixture.questions.filter(isImmediate)) await answer(run.id, q);
  const written = await (await get(`/quiz?attempt=${run.id}`)).text();
  assert.match(written, /ユースケース設計/);
  assert.match(written, /textarea/);
  const saved = await post(`/quiz/attempts/${run.id}/answers`, { 'public-client-design': 'redirect_uris にURL。公開クライアントなので none。TLSでJSONをPOSTする。' });
  assert.equal(saved.status, 303);
  assert.ok(!saved.headers.get('location').includes('grade='), 'saving never starts paid grading automatically');
  assert.equal(worker.executions.size, 0, 'saving is separate from AI dispatch');
  const grade = await post(`/quiz/attempts/${run.id}/grading-requests`);
  assert.equal(grade.status, 303);
  const job = await worker.db.prepare("SELECT id FROM ai_jobs WHERE target_id = ? AND operation = 'answers.grade'").bind(run.id).first();
  await worker.waitForExecution(job.id);
  assert.match(await (await get(`/quiz?attempt=${run.id}`)).text(), /id="pending"/);
  await worker.complete(job.id, { output: JSON.stringify({ grades: [{ questionId: 'public-client-design', score: 3, reason: '制約を満たしています。', referenceIds: ['registration-metadata'] }] }) });
  const result = await (await get(`/quiz?attempt=${run.id}`)).text();
  assert.match(result, /9 \/ 9点/);
  assert.match(result, /制約を満たしています。/);
  assert.match(result, /href="\/\?rfc=7591#L417-L444"/);
});

test('Hono escapes question HTML and safely serializes ordering data into its document', async () => {
  const value = structuredClone(patternsFixture);
  value.questions = value.questions.filter((q) => q.type === 'ordering');
  value.solutions = { 'registration-order': value.solutions['registration-order'] };
  const payload = '</script><script>globalThis.quizInjected=true</script>';
  value.questions[0].items[0].text = payload;
  value.questions[0].prompt = payload;
  const special = await worker.publish(value, '7'.repeat(40));
  const run = await start(special.id);
  const html = await (await get(run.location)).text();
  assert.ok(!html.includes(payload));
  assert.ok(html.includes('&lt;/script&gt;'));
  const encoded = /id="ordering-data"[^>]*>([\s\S]*?)<\/script>/.exec(html)[1];
  assert.equal(JSON.parse(encoded).question.items[0].text, payload);
  assert.ok(encoded.includes('\\u003c'));
});

test('screen actions enforce origin, ownership, ID and form size checks', async () => {
  const run = await start();
  assert.equal((await post('/quiz/attempts', { setId: set.id }, { json: true, origin: 'https://untrusted.test' })).status, 403);
  assert.equal((await post(`/quiz/attempts/${run.id}/instant-answers`, { questionId: 'redirect-uris-meaning', 'redirect-uris-meaning': '0' }, { subject: 'other', json: true })).status, 404);
  assert.equal((await post('/quiz/attempts', { setId: 'bad' }, { json: true })).status, 400);
  assert.equal((await post(`/quiz/attempts/${run.id}/answers`, { answer: 'x'.repeat(300001) }, { json: true })).status, 413);
  assert.equal((await get('/quiz?attempt=bad')).status, 404);
});

test('written screens show one question, confirm each save and resume at the next unanswered question', async () => {
  const artifact = structuredClone(patternsFixture);
  const first = artifact.questions.find((q) => q.type === 'written');
  const second = { ...first, id: 'written-next', prompt: '続きの記述式問題です。' };
  artifact.questions = [first, second];
  artifact.solutions = { [first.id]: artifact.solutions[first.id], [second.id]: structuredClone(artifact.solutions[first.id]) };
  const published = await worker.publish(artifact, 'a'.repeat(40));
  const run = await start(published.id);
  const initial = await (await get(run.location)).text();
  assert.match(initial, /記述式・実装 1 \/ 2/);
  assert.equal((initial.match(/<fieldset/g) || []).length, 1);
  assert.ok(!initial.includes(second.prompt));
  assert.ok(!initial.includes('/instant-answers'));
  const skipped = await (await get(`${run.location}&question=${second.id}`)).text();
  assert.ok(!skipped.includes(second.prompt));
  const response = await post(`/quiz/attempts/${run.id}/answers`, { [first.id]: '最初の回答です。' }, { json: true });
  assert.equal(response.status, 200);
  const feedback = await (await get((await response.json()).location)).text();
  assert.match(feedback, /この問題の回答を保存しました/);
  assert.match(feedback, /<fieldset disabled/);
  assert.match(feedback, /次の問題へ/);
  assert.ok(!feedback.includes('id="grading-form"'));
  const resumed = await (await get(run.location)).text();
  assert.match(resumed, /記述式・実装 2 \/ 2/);
  assert.ok(resumed.includes(second.prompt));
  assert.ok(!resumed.includes(first.prompt));
  const last = await post(`/quiz/attempts/${run.id}/answers`, { [second.id]: '最後の回答です。' });
  const lastFeedback = await (await get(last.headers.get('location'))).text();
  assert.match(lastFeedback, /結果を見る/);
  assert.match(lastFeedback, /id="grading-form"/);
  const results = await (await get(run.location)).text();
  assert.ok(results.includes('最初の回答です。'));
  assert.ok(results.includes('最後の回答です。'));
});
