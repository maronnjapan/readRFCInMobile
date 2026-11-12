import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startQuizWorker, fixture, multipleChoiceFixture } from '../test-support/quiz-worker.mjs';
import { initialResults } from '../worker/contracts.js';

let worker;
before(async () => { worker = await startQuizWorker(); });
after(async () => { await worker?.mf.dispose(); });
async function start(artifact = multipleChoiceFixture(), commit = 'e'.repeat(40)) {
  const set = await worker.publish(artifact, commit);
  const call = worker.client();
  const state = await (await call(`/api/question-sets/${set.id}/attempts`, { method: 'POST', body: {} })).json();
  const choice = (questionId, answer) => call(`/api/attempts/${state.id}/choice-answers`, { method: 'POST', body: { questionId, answer } });
  return { call, state, choice };
}

test('each choice is graded immediately and future answers stay hidden while progress survives reload', async () => {
  const { call, state, choice } = await start();
  assert.equal(state.completed, false);
  assert.equal((await choice('server-audience', 1)).status, 409, 'cannot skip the first choice');
  for (const [id, answer] of [['missing', 0], ['audience-validation', 0], ['client-sub', null], ['client-sub', 10], ['client-sub', '0']]) {
    assert.equal((await choice(id, answer)).status, 400);
  }
  const firstResponse = await choice('client-sub', 3);
  assert.equal(firstResponse.status, 200);
  assert.equal(firstResponse.headers.get('cache-control'), 'no-store');
  const first = await firstResponse.json();
  assert.equal(first.completed, false);
  assert.equal(first.results[0].score, 0);
  assert.equal(first.results[0].answer, 0);
  assert.ok(first.results[0].reason);
  assert.deepEqual(first.answers, { 'client-sub': 3 });
  assert.equal(first.results.length, 1);
  assert.equal(first.set.questions[1].answer, undefined);
  assert.equal((await choice('client-sub', 3)).status, 200, 'same answer is idempotent');
  assert.equal((await choice('client-sub', 0)).status, 409, 'cannot revise an answer after seeing its solution');
  const reloaded = await (await call(`/api/attempts/${state.id}`)).json();
  assert.deepEqual(reloaded.answers, first.answers);
  assert.deepEqual(reloaded.results, first.results);
  const second = await (await choice('server-audience', 1)).json();
  assert.equal(second.results.length, 2);
  assert.equal(second.results[1].score, 1);
  assert.equal(second.completed, false, 'written answers have not been submitted');
  assert.equal((await call(`/api/attempts/${state.id}/grading-requests`, { method: 'POST', body: {} })).status, 409);
  assert.equal(worker.executions.size, 0);
  const written = await call(`/api/attempts/${state.id}/answers`, { method: 'POST', body: { answers: { 'audience-validation': '意図された受信者ではないため拒否する。' } } });
  assert.equal(written.status, 200);
  const saved = await written.json();
  assert.equal(saved.completed, true);
  assert.equal(saved.status, 'saved');
  assert.equal(saved.results[0].score, 0, 'written submission preserves the first choice result');
  assert.equal(saved.results[1].score, 1);
  assert.equal(saved.results[2].status, 'pending');
  assert.equal((await worker.client('other')(`/api/attempts/${state.id}/choice-answers`, { method: 'POST', body: { questionId: 'client-sub', answer: 3 } })).status, 404);
});

test('a choice-only quiz finishes with the last immediate result and never queues AI', async () => {
  const { call, state, choice } = await start(multipleChoiceFixture({ written: false }), 'f'.repeat(40));
  await choice('client-sub', 0);
  const response = await choice('server-audience', 1);
  assert.equal(response.status, 200);
  const last = await response.json();
  assert.equal(last.completed, true);
  assert.equal(last.status, 'graded');
  assert.equal(last.results.reduce((n, r) => n + r.score, 0), 2);
  assert.equal((await choice('server-audience', 1)).status, 200);
  assert.equal((await choice('server-audience', 0)).status, 409);
  assert.equal((await (await call(`/api/attempts/${state.id}`)).json()).completed, true);
  assert.equal(worker.executions.size, 0);
});

test('simultaneous different choice answers record one immutable result', async () => {
  const { state, choice } = await start();
  const responses = await Promise.all([choice('client-sub', 0), choice('client-sub', 2)]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const count = await worker.db.prepare('SELECT COUNT(*) AS count FROM instant_answers WHERE attempt_id = ?').bind(state.id).first();
  assert.equal(count.count, 1);
});

test('written-only sets still save answers without a choice stage', async () => {
  const artifact = structuredClone(fixture);
  artifact.questions = artifact.questions.filter((q) => q.type === 'written');
  delete artifact.solutions['client-sub'];
  const { call, state } = await start(artifact, '1'.repeat(40));
  const response = await call(`/api/attempts/${state.id}/answers`, { method: 'POST', body: { answers: { 'audience-validation': '受信者を確認し、異なる受信者向けの JWT は拒否する。' } } });
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.completed, true);
  assert.equal(saved.status, 'saved');
  assert.equal(saved.results[0].status, 'pending');
});

test('previously submitted attempts remain readable without per-choice rows', async () => {
  const { call, state, choice } = await start(fixture, '2'.repeat(40));
  const answers = { 'client-sub': 0, 'audience-validation': '受信者を確認する。' };
  const results = initialResults(state.set, fixture.solutions, answers);
  await worker.db.prepare("UPDATE attempts SET answers_json = ?, results_json = ?, status = 'saved' WHERE id = ?")
    .bind(JSON.stringify(answers), JSON.stringify(results), state.id).run();
  const reloaded = await (await call(`/api/attempts/${state.id}`)).json();
  assert.equal(reloaded.completed, true);
  assert.deepEqual(reloaded.answers, answers);
  assert.deepEqual(reloaded.results, results);
  assert.equal((await choice('client-sub', 0)).status, 200);
  assert.equal((await choice('client-sub', 2)).status, 409);
});
