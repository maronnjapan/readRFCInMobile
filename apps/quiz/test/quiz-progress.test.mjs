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

function writtenFixture() {
  const artifact = structuredClone(fixture);
  const first = artifact.questions.find((q) => q.type === 'written');
  artifact.questions = [first, { ...first, id: 'audience-validation-next' }];
  artifact.solutions = { [first.id]: artifact.solutions[first.id], 'audience-validation-next': structuredClone(artifact.solutions[first.id]) };
  return artifact;
}

test('written responses save one at a time and survive reload without completing or grading early', async () => {
  const { call, state } = await start(writtenFixture(), '3'.repeat(40));
  const save = (answers) => call(`/api/attempts/${state.id}/answers`, { method: 'POST', body: { answers } });
  assert.equal((await save({ 'audience-validation-next': '先の問題への回答。' })).status, 409);
  for (const answers of [{}, { missing: '回答' }, { 'audience-validation': '' }, { 'audience-validation': 'x'.repeat(8001) }]) assert.equal((await save(answers)).status, 400);
  const answer = '意図された受信者であることを確認する。';
  const first = await save({ 'audience-validation': answer });
  assert.equal(first.status, 200);
  const partial = await first.json();
  assert.equal(partial.completed, false);
  assert.equal(partial.status, 'answering');
  assert.deepEqual(partial.answers, { 'audience-validation': answer });
  assert.equal(partial.results.length, 1);
  assert.equal(partial.results[0].status, 'pending');
  assert.deepEqual((await (await call(`/api/attempts/${state.id}`)).json()).answers, partial.answers);
  assert.equal((await save({ 'audience-validation': answer })).status, 200);
  assert.equal((await save({ 'audience-validation': '変更した回答。' })).status, 409);
  assert.equal((await call(`/api/attempts/${state.id}/grading-requests`, { method: 'POST', body: {} })).status, 409);
  const last = await (await save({ 'audience-validation-next': '異なる受信者向けの JWT を拒否する。' })).json();
  assert.equal(last.completed, true);
  assert.equal(last.status, 'saved');
  assert.equal(last.answers['audience-validation'], answer);
  assert.equal(last.results.length, 2);
  assert.equal(worker.executions.size, 0);
  assert.equal((await save({ 'audience-validation': answer })).status, 200);
  assert.equal((await save({ 'audience-validation-next': '変更。' })).status, 409);
});

test('concurrent written saves preserve one immutable answer and finish with all earlier answers', async () => {
  const { call, state } = await start(writtenFixture(), '4'.repeat(40));
  const save = (answers) => call(`/api/attempts/${state.id}/answers`, { method: 'POST', body: { answers } });
  const responses = await Promise.all([save({ 'audience-validation': '回答 A' }), save({ 'audience-validation': '回答 B' })]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const partial = await (await call(`/api/attempts/${state.id}`)).json();
  const finalResponses = await Promise.all([save({ 'audience-validation-next': '最後の回答 A' }), save({ 'audience-validation-next': '最後の回答 B' })]);
  assert.deepEqual(finalResponses.map((r) => r.status).sort(), [200, 409]);
  const last = await (await call(`/api/attempts/${state.id}`)).json();
  assert.equal(last.completed, true);
  assert.equal(last.status, 'saved');
  assert.equal(last.answers['audience-validation'], partial.answers['audience-validation']);
});

test('existing bulk written submissions remain supported and total length is checked before saving', async () => {
  const artifact = writtenFixture();
  const first = artifact.questions[0];
  for (let n = 0; n < 4; n++) {
    const id = `extra-${n}`;
    artifact.questions.push({ ...first, id });
    artifact.solutions[id] = structuredClone(artifact.solutions[first.id]);
  }
  const { call, state } = await start(artifact, '5'.repeat(40));
  const save = (answers) => call(`/api/attempts/${state.id}/answers`, { method: 'POST', body: { answers } });
  const long = Object.fromEntries(artifact.questions.slice(0, 5).map((q) => [q.id, 'x'.repeat(7900)]));
  assert.equal((await save(long)).status, 200);
  const lastId = artifact.questions.at(-1).id;
  assert.equal((await save({ [lastId]: 'x'.repeat(8000) })).status, 400);
  const final = await (await save({ [lastId]: '短い回答。' })).json();
  assert.equal(final.completed, true);
  assert.equal(Object.keys(final.answers).length, artifact.questions.length);
});
