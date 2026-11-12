import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startQuizWorker, patternsFixture, accessToken } from '../test-support/quiz-worker.mjs';
import { isImmediate } from '../shared/quiz-types.js';

let worker;
before(async () => { worker = await startQuizWorker(); });
after(async () => { await worker?.mf.dispose(); });

async function answerWithoutLogin(app, call) {
  const list = await call('/api/question-sets?spec=rfc-7591');
  assert.equal(list.status, 200);
  const set = (await list.json()).sets.find((entry) => entry.revision.path.endsWith('/rfc-7591.json'));
  assert.ok(set, 'GitHub files are available without an import');
  const response = await call(`/api/question-sets/${set.id}/attempts`, { method: 'POST', body: {} });
  assert.equal(response.status, 201);
  const attempt = await response.json();
  for (const question of patternsFixture.questions.filter(isImmediate)) {
    const result = await call(`/api/attempts/${attempt.id}/instant-answers`, { method: 'POST', body: {
      questionId: question.id, answer: patternsFixture.solutions[question.id].answer,
    } });
    assert.equal(result.status, 200);
    const data = await result.json();
    assert.equal(data.results.at(-1).score, question.points);
    assert.equal(data.completed, false);
  }
  const saved = await call(`/api/attempts/${attempt.id}/answers`, { method: 'POST', body: { answers: { 'public-client-design': '公開クライアントには none。TLS で redirect_uris を含む JSON を POST する。' } } });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).status, 'saved');
  assert.equal(app.executions.size, 0, 'answering and saving never start AI');
  return { set, attempt };
}

test('unconfigured Access permits anonymous discovery, immediate scoring and written saving from GitHub files', async () => {
  const app = await startQuizWorker({ access: false });
  try {
    const call = app.anonymousClient();
    const landing = await call('/quiz');
    assert.equal(landing.status, 200);
    const cookie = landing.headers.get('set-cookie');
    for (const flag of ['__Host-quiz-session=', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert.ok(cookie.includes(flag));
    const { set, attempt } = await answerWithoutLogin(app, call);
    const row = await app.db.prepare('SELECT * FROM question_sets WHERE id = ?').bind(set.id).first();
    assert.deepEqual(Object.keys(JSON.parse(row.public_json)), ['spec']);
    assert.equal(row.solutions_json, '{}');
    assert.equal(row.materials_json, '{}');
    const owner = await app.db.prepare('SELECT owner FROM attempts WHERE id = ?').bind(attempt.id).first();
    assert.ok(owner.owner.startsWith('guest:'));
    assert.ok(!owner.owner.includes(cookie.split('=')[1].split(';')[0]), 'cookie capability is hashed at rest');
    const page = await call(`/quiz?attempt=${attempt.id}&grade=1`);
    const html = await page.text();
    assert.match(html, /回答は保存済みです/);
    assert.ok(!html.includes('data-auto-grade'));
    assert.ok(!html.includes('id="grading-form"'));
    assert.equal((await call(`/api/attempts/${attempt.id}/grading-requests`, { method: 'POST', body: {} })).status, 503);
    assert.equal(app.executions.size, 0);
  } finally { await app.mf.dispose(); }
});

test('anonymous attempts remain private, resume with their cookie and reject cross-site mutations', async () => {
  const owner = worker.anonymousClient();
  const other = worker.anonymousClient();
  const { set, attempt } = await answerWithoutLogin(worker, owner);
  const resumed = await (await owner(`/api/attempts/${attempt.id}`)).json();
  assert.equal(resumed.status, 'saved');
  assert.equal(resumed.results.filter((r) => r.status !== 'pending').length, 5);
  assert.equal((await other(`/api/attempts/${attempt.id}`)).status, 404);
  assert.equal((await other(`/quiz?attempt=${attempt.id}`)).status, 404);
  assert.equal((await other(`/api/attempts/${attempt.id}/answers`, { method: 'POST', body: { answers: {} } })).status, 404);
  assert.deepEqual((await (await other(`/api/question-sets/${set.id}/attempts`)).json()).attempts, []);
  assert.ok((await (await owner(`/api/question-sets/${set.id}/attempts`)).json()).attempts.some((row) => row.id === attempt.id));
  assert.equal((await owner(`/api/question-sets/${set.id}/attempts`, { method: 'POST', body: {}, headers: { Origin: 'https://evil.test' } })).status, 403);
  assert.equal((await owner(`/quiz/attempts/${attempt.id}/grading-requests`, { method: 'POST', form: {}, headers: { Accept: 'application/json' } })).status, 401);
  assert.equal((await owner(`/api/attempts/${attempt.id}/grading-requests`, { method: 'POST', body: {} })).status, 401);
  assert.equal(worker.executions.size, 0);
});

test('login preserves anonymous answers and only their owner can request paid grading', async () => {
  const call = worker.anonymousClient();
  const { attempt } = await answerWithoutLogin(worker, call);
  const gradingPath = `/api/attempts/${attempt.id}/grading-requests`;
  assert.equal((await worker.client('stranger')(gradingPath, { method: 'POST', body: {} })).status, 404);
  const wrongAudience = accessToken('reader', { aud: ['other-app'] });
  assert.equal((await call(gradingPath, { method: 'POST', body: {}, headers: { 'cf-access-jwt-assertion': wrongAudience } })).status, 401);
  const login = await call(`/quiz/ai-grading?attempt=${attempt.id}`, { subject: 'reader' });
  assert.equal(login.status, 200);
  assert.match(await login.text(), /id="grading-form"/);
  assert.equal(worker.executions.size, 0, 'login alone does not request AI');
  const response = await call(gradingPath, { method: 'POST', body: {}, subject: 'reader' });
  assert.equal(response.status, 202);
  const job = await response.json();
  await worker.waitForExecution(job.id);
  assert.equal((await call(gradingPath, { method: 'POST', body: {}, subject: 'another-user' })).status, 403);
  const row = await worker.db.prepare('SELECT owner, anonymous_owner FROM attempts WHERE id = ?').bind(attempt.id).first();
  assert.equal(row.owner, 'reader');
  assert.ok(row.anonymous_owner.startsWith('guest:'));
  assert.equal((await worker.complete(job.id)).status, 200);
  assert.equal((await (await call(`/api/attempts/${attempt.id}`)).json()).status, 'graded', 'public polling still works after authentication');
  assert.equal((await (await worker.client('reader')(`/api/attempts/${attempt.id}`)).json()).status, 'graded', 'the signed-in owner can also resume elsewhere');
});

test('all four RFC 9449 files added on main are discoverable and answerable without Access or importing', async () => {
  const app = await startQuizWorker({ access: false });
  try {
    const call = app.anonymousClient();
    const list = await (await call('/api/question-sets?spec=rfc-9449')).json();
    assert.equal(list.sets.length, 4);
    let count = 0;
    for (const set of list.sets) {
      const file = set.revision.path.split('/').at(-1);
      const artifact = JSON.parse(await readFile(new URL(`../questions/spec/${file}`, import.meta.url), 'utf8'));
      const start = await call(`/api/question-sets/${set.id}/attempts`, { method: 'POST', body: {} });
      assert.equal(start.status, 201);
      const attempt = await start.json();
      assert.equal(attempt.set.questions.length, 20);
      for (const question of artifact.questions.filter(isImmediate)) {
        const result = await call(`/api/attempts/${attempt.id}/instant-answers`, { method: 'POST', body: {
          questionId: question.id, answer: artifact.solutions[question.id].answer,
        } });
        assert.equal(result.status, 200, `${file}: ${question.id}`);
      }
      const answers = Object.fromEntries(artifact.questions.filter((q) => !isImmediate(q)).map((q) => [q.id, '仕様の要件に沿って検証し、条件に一致しない要求を拒否する。']));
      const saved = await call(`/api/attempts/${attempt.id}/answers`, { method: 'POST', body: { answers } });
      assert.equal(saved.status, 200, file);
      assert.equal((await saved.json()).status, 'saved');
      count += artifact.questions.length;
    }
    assert.equal(count, 80);
    assert.equal(app.executions.size, 0);
  } finally { await app.mf.dispose(); }
});
