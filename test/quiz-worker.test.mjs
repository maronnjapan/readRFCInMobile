import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startQuizWorker, fixture, accessToken } from '../test-support/quiz-worker.mjs';
import workerHandler from '../worker/index.js';
import { randomUUID } from 'node:crypto';

let worker;
before(async () => { worker = await startQuizWorker(); });
after(async () => { await worker?.mf.dispose(); });
const answers = { 'client-sub': 0, 'audience-validation': '自身が意図された受信者でない JWT は拒否する。別の受信者向けの JWT を受け入れないため。' };
async function attempt(subject = 'reader', commit) {
  const set = await worker.publish(fixture, commit);
  const call = worker.client(subject);
  const response = await call(`/api/question-sets/${set.id}/attempts`, { method: 'POST', body: {} });
  assert.equal(response.status, 201);
  return { call, set, attempt: await response.json() };
}

test('Access JWT validation and author permissions reject unauthorized callers', async () => {
  assert.equal((await worker.mf.dispatchFetch('https://reader.test/api/quiz/config')).status, 401);
  assert.equal((await worker.client('reader', { aud: ['other-app'] })('/api/quiz/config')).status, 401);
  assert.equal((await worker.client('reader', { exp: 1 })('/api/quiz/config')).status, 401);
  assert.equal((await worker.client('reader')('/api/question-sets/import', { method: 'POST', body: {} })).status, 403);
  const service = await worker.client('ignored', { sub: '', common_name: 'author.access', email: '' })('/api/quiz/config');
  assert.equal(service.status, 200);
  assert.equal((await service.json()).canAuthor, true, 'Access Service Auth uses the signed common_name when sub is empty');
  assert.equal((await worker.client('ignored', { sub: '', common_name: 'other.access', email: '' })('/api/authoring/requests', { method: 'POST', body: {} })).status, 403);
  const token = accessToken('reader');
  assert.equal((await worker.client()('/api/quiz/config', { headers: { 'cf-access-jwt-assertion': `${token.slice(0, -10)}abcdefghij` } })).status, 401);
});

test('published sets are pinned, exclude grading secrets, and support spec-only discovery', async () => {
  const published = await worker.publish();
  const call = worker.client();
  const response = await call(`/api/question-sets/${published.id}`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const set = await response.json();
  assert.equal(set.revision.commit, 'a'.repeat(40));
  assert.equal(set.solutions, undefined);
  assert.equal(set.questions[0].answer, undefined);
  assert.equal(set.references[0].excerpt, undefined);
  assert.equal(set.spec.status, 'adopted');
  assert.equal((await (await call('/api/question-sets?spec=rfc-7523')).json()).sets[0].id, set.id);
  const rejected = await worker.client('author')('/api/question-sets/import', { method: 'POST', body: { repository: 'other/repo', commit: 'main', path: '../bad' } });
  assert.equal(rejected.status, 400);
  const draft = structuredClone(fixture); draft.status = 'draft'; worker.behavior.artifact = draft;
  assert.equal((await worker.client('author')('/api/question-sets/import', { method: 'POST', body: { repository: 'maronnjapan/readRFCInMobile', commit: 'b'.repeat(40), path: 'questions/spec/draft.json' } })).status, 400);
});

test('choice scoring is immediate; written answers are saved before a separate grading request', async () => {
  const run = await attempt();
  const { call, set, attempt: state } = run;
  assert.equal(state.set.id, set.id);
  assert.equal(state.results, null);
  const invalid = await call(`/api/attempts/${state.id}/answers`, { method: 'POST', body: { answers: { 'client-sub': 0 } } });
  assert.equal(invalid.status, 400);
  const response = await call(`/api/attempts/${state.id}/answers`, { method: 'POST', body: { answers } });
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.status, 'saved');
  assert.equal(saved.results[0].score, 1);
  assert.equal(saved.results[1].status, 'pending');
  assert.equal(worker.executions.size, 0, 'saving answers does not synchronously call AI');
  const grade = await call(`/api/attempts/${state.id}/grading-requests`, { method: 'POST', body: {} });
  assert.equal(grade.status, 202);
  const job = await grade.json();
  const execution = await worker.waitForExecution(job.id);
  assert.equal(execution.operation, 'answers.grade');
  assert.ok(execution.input.sourceMaterials['jwt-claims'].includes('client_id'));
  assert.equal(execution.input.questions[0].answer, answers['audience-validation']);
  assert.ok(execution.input.questions[0].solution.rubric);
  assert.ok(execution.callback.url.endsWith('/api/ai/results'));
  assert.equal((await worker.complete(job.id)).status, 200);
  const graded = await (await call(`/api/attempts/${state.id}`)).json();
  assert.equal(graded.status, 'graded');
  assert.equal(graded.results[1].score, 2);
  assert.equal(graded.grading.model, 'claude-test-model');
  assert.equal(graded.set.revision.commit, 'a'.repeat(40));
  assert.deepEqual(graded.answers, answers);
  await worker.complete(job.id);
  const count = await worker.db.prepare('SELECT COUNT(*) AS count FROM grading_history WHERE attempt_id = ?').bind(state.id).first();
  assert.equal(count.count, 1);
  const history = await worker.db.prepare('SELECT configuration_json FROM grading_history WHERE attempt_id = ?').bind(state.id).first();
  assert.equal(JSON.parse(history.configuration_json).context.revision.commit, 'a'.repeat(40));
});

test('attempts belong to the authenticated user and cannot be changed after submission', async () => {
  const { call, attempt: state } = await attempt('owner');
  assert.equal((await worker.client('other')(`/api/attempts/${state.id}`)).status, 404);
  assert.equal((await worker.client('other')(`/api/attempts/${state.id}/answers`, { method: 'POST', body: { answers } })).status, 404);
  assert.equal((await call(`/api/attempts/${state.id}/answers`, { method: 'POST', body: { answers }, headers: { Origin: 'https://evil.test' } })).status, 403);
  const responses = await Promise.all([
    call(`/api/attempts/${state.id}/answers`, { method: 'POST', body: { answers } }),
    call(`/api/attempts/${state.id}/answers`, { method: 'POST', body: { answers: { ...answers, 'client-sub': 1 } } }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const saved = await (await call(`/api/attempts/${state.id}`)).json();
  assert.equal((await call(`/api/attempts/${state.id}/answers`, { method: 'POST', body: { answers: saved.answers } })).status, 200);
});

test('generation uses an asynchronous common API and produces an unpublished review artifact', async () => {
  worker.behavior.artifact = structuredClone(fixture);
  const call = worker.client('author');
  const context = { id: fixture.id, title: fixture.title, spec: fixture.spec, references: fixture.references };
  const response = await call('/api/authoring/requests', { method: 'POST', body: { context, material: '出典の excerpt を資料本文として参照する。', questionCount: 2 } });
  assert.equal(response.status, 202);
  const job = await response.json();
  const execution = await worker.waitForExecution(job.id);
  assert.equal(execution.operation, 'questions.generate');
  assert.equal(execution.profile, 'quiz-generate-v1');
  assert.equal(execution.maxOutputTokens, 8000);
  assert.equal((await worker.complete(job.id)).status, 200);
  const result = await (await call(`/api/authoring/requests/${job.id}`)).json();
  assert.equal(result.status, 'completed');
  assert.equal(result.artifact.status, 'draft');
  assert.ok(result.artifact.solutions['audience-validation'].rubric);
  assert.equal((await worker.client()(`/api/authoring/requests/${job.id}`)).status, 403);
});

test('forged results are rejected; invalid grades are recorded as failed and can be retried', async () => {
  const { call, attempt: state } = await attempt('retry-user');
  await call(`/api/attempts/${state.id}/answers`, { method: 'POST', body: { answers } });
  const job = await (await call(`/api/attempts/${state.id}/grading-requests`, { method: 'POST', body: {} })).json();
  await worker.waitForExecution(job.id);
  const forged = await worker.mf.dispatchFetch('https://reader.test/api/ai/results', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong' }, body: JSON.stringify({ requestId: job.id }) });
  assert.equal(forged.status, 401);
  await worker.complete(job.id, { output: { grades: [{ questionId: 'audience-validation', score: 100, reason: 'invalid', referenceIds: ['jwt-claims'] }] } });
  assert.equal((await (await call(`/api/attempts/${state.id}`)).json()).status, 'grading_failed');
  const next = await (await call(`/api/attempts/${state.id}/grading-requests`, { method: 'POST', body: {} })).json();
  assert.notEqual(next.id, job.id);
  await worker.waitForExecution(next.id); await worker.complete(next.id);
  assert.equal((await (await call(`/api/attempts/${state.id}`)).json()).status, 'graded');
});

test('duplicate grading requests share one job and an early callback is retained', async () => {
  const { call, attempt: state } = await attempt('early-user');
  await call(`/api/attempts/${state.id}/answers`, { method: 'POST', body: { answers } });
  worker.behavior.earlyCallback = true;
  try {
    const replies = await Promise.all([call(`/api/attempts/${state.id}/grading-requests`, { method: 'POST', body: {} }), call(`/api/attempts/${state.id}/grading-requests`, { method: 'POST', body: {} })]);
    const jobs = await Promise.all(replies.map((r) => r.json()));
    assert.equal(jobs[0].id, jobs[1].id);
    await worker.waitForExecution(jobs[0].id);
    for (let i = 0; i < 30; i++) {
      const result = await (await call(`/api/attempts/${state.id}`)).json();
      if (result.status === 'graded') return;
      await new Promise((r) => setTimeout(r, 30));
    }
    assert.fail('early callback was lost');
  } finally { worker.behavior.earlyCallback = false; }
});

test('the outbox recovers queued work and times out stale grading without losing answers', async () => {
  const { call, set, attempt: state } = await attempt('recovery-user');
  await call(`/api/attempts/${state.id}/answers`, { method: 'POST', body: { answers } });
  const timestamp = Math.floor(Date.now() / 1000);
  const oldId = randomUUID(), queuedId = randomUUID();
  await worker.db.prepare("INSERT INTO ai_jobs (id, operation, target_id, owner, status, profile, input_json, context_json, created_at, updated_at) VALUES (?, 'answers.grade', ?, 'recovery-user', 'submitted', 'test', '{}', ?, ?, ?)")
    .bind(oldId, state.id, JSON.stringify({ setId: set.id }), timestamp - 1900, timestamp - 1900).run();
  await worker.db.prepare("INSERT INTO ai_jobs (id, operation, target_id, owner, profile, input_json, context_json, created_at, updated_at) VALUES (?, 'questions.generate', 'outbox-recovery', 'author', 'test', '{}', '{}', ?, ?)")
    .bind(queuedId, timestamp, timestamp - 120).run();
  const sent = [], pending = [];
  await workerHandler.scheduled({}, { DB: worker.db, AI_JOBS: { send: async (body) => { sent.push(body); } } }, { waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);
  assert.ok(sent.some((b) => b.id === queuedId));
  const saved = await (await call(`/api/attempts/${state.id}`)).json();
  assert.equal(saved.status, 'grading_failed');
  assert.deepEqual(saved.answers, answers);
  assert.equal((await worker.db.prepare('SELECT status FROM ai_jobs WHERE id = ?').bind(oldId).first()).status, 'failed');
  await worker.db.prepare('DELETE FROM ai_jobs WHERE id = ?').bind(queuedId).run();
});

test('per-user AI limits apply before dispatching additional paid work', async () => {
  const call = worker.client('cost-limited-author', { email: 'author@example.com' });
  for (let i = 0; i < 5; i++) {
    const context = { id: `cost-test-${i}`, title: fixture.title, spec: fixture.spec, references: fixture.references };
    assert.equal((await call('/api/authoring/requests', { method: 'POST', body: { context, material: '出典本文を参照', questionCount: 2 } })).status, 202);
  }
  const context = { id: 'cost-test-rejected', title: fixture.title, spec: fixture.spec, references: fixture.references };
  assert.equal((await call('/api/authoring/requests', { method: 'POST', body: { context, material: '出典本文を参照', questionCount: 2 } })).status, 429);
  assert.equal((await worker.db.prepare("SELECT COUNT(*) AS n FROM ai_jobs WHERE target_id = 'cost-test-rejected'").first()).n, 0);
});

test('PR publishing records an immutable diff and posts an informational link and neutral Check', async () => {
  const app = await startQuizWorker({ github: true });
  try {
    const artifact = structuredClone(fixture);
    artifact.pullRequest = { repository: 'example/product', number: 42, baseSha: 'b'.repeat(40), headSha: 'c'.repeat(40) };
    artifact.references.push({ id: 'change', kind: 'diff', repository: 'example/product', commit: 'c'.repeat(40), path: 'src/auth.js', startLine: 1, endLine: 3, reason: 'PR の差分', excerpt: '+validateAudience(jwt);' });
    const set = await app.publish(artifact, 'd'.repeat(40));
    for (let i = 0; i < 100 && !app.githubWrites.some((w) => w.path.endsWith('/comments')); i++) await new Promise((r) => setTimeout(r, 30));
    const check = app.githubWrites.find((w) => w.path.endsWith('/check-runs'));
    assert.equal(check.body.head_sha, 'c'.repeat(40));
    assert.equal(check.body.conclusion, 'neutral');
    assert.equal(check.body.details_url, set.url);
    const comment = app.githubWrites.find((w) => w.path.endsWith('/comments'));
    assert.ok(comment.body.body.includes(set.id));
    assert.ok(comment.body.body.includes('参考情報'));
  } finally { await app.mf.dispose(); }
});
