import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startQuizWorker, patternsFixture, fixture } from '../test-support/quiz-worker.mjs';
import { validateSet, validateAnswers, validateCategories, initialResults } from '../worker/contracts.js';
import { QUESTION_CATEGORIES, isImmediate } from '../shared/quiz-types.js';

const flowId = 'registration-order';
const correctOrder = patternsFixture.solutions[flowId].answer;
function flowOnly() {
  const value = structuredClone(patternsFixture);
  value.questions = value.questions.filter((q) => q.id === flowId);
  value.solutions = { [flowId]: value.solutions[flowId] };
  return value;
}

test('six learning categories have independent response types and keep answer keys private', async () => {
  const value = structuredClone(patternsFixture);
  value.solutions[flowId].acceptedOrders = [[...correctOrder].reverse()];
  value.questions.find((q) => q.id === flowId).items[0].secret = 'private';
  const { public: set } = validateSet(value, { published: true });
  assert.deepEqual(new Set(set.questions.map((q) => q.category)), new Set(Object.keys(QUESTION_CATEGORIES)));
  assert.equal(set.questions.filter(isImmediate).length, 5);
  assert.equal(set.questions.find((q) => q.category === 'design').type, 'written');
  assert.equal(set.questions.find((q) => q.category === 'vocabulary').term, 'redirect_uris');
  assert.equal(set.questions.find((q) => q.id === flowId).items[0].secret, undefined);
  assert.equal(set.questions.find((q) => q.id === flowId).answer, undefined);
  assert.equal(JSON.stringify(set).includes('acceptedOrders'), false);
  assert.equal(set.solutions, undefined);
  assert.equal(validateSet(fixture).public.questions[0].category, 'knowledge', 'old files remain supported');
  for (const ref of patternsFixture.references) {
    const source = (await readFile(new URL(`../../../${ref.path}`, import.meta.url), 'utf8')).split('\n');
    assert.equal(ref.excerpt, source.slice(ref.startLine - 1, ref.endLine).join('\n'), 'sample citations use actual source lines');
  }
});

test('question schemas reject invalid categories, missing scenarios and ambiguous ordering items', () => {
  for (const mutate of [
    (v) => { v.questions[0].category = 'translation'; },
    (v) => { v.questions[0].category = ['vocabulary']; },
    (v) => { delete v.questions[0].term; },
    (v) => { delete v.questions.find((q) => q.category === 'design').scenario; },
    (v) => { delete v.questions.find((q) => q.category === 'debugging').scenario; },
    (v) => { v.questions[0].category = 'flow'; },
    (v) => { v.questions.find((q) => q.id === flowId).items.pop(); },
    (v) => { const q = v.questions.find((q) => q.id === flowId); q.items[1].id = q.items[0].id; },
    (v) => { const q = v.questions.find((q) => q.id === flowId); q.items[1].text = q.items[0].text; },
    (v) => { v.solutions[flowId].answer = [...correctOrder, 'invented']; },
    (v) => { v.solutions[flowId].acceptedOrders = [['prepare', 'send']]; },
  ]) {
    const value = structuredClone(patternsFixture); mutate(value);
    assert.throws(() => validateSet(value));
  }
  assert.deepEqual(validateCategories(['vocabulary', 'design'], 2), ['vocabulary', 'design']);
  for (const categories of [[], ['flow', 'flow'], ['translation'], Object.keys(QUESTION_CATEGORIES)]) assert.throws(() => validateCategories(categories, 2));
});

test('ordering requires every item once, accepts alternative valid orders and grades without AI', () => {
  const value = flowOnly();
  const alternate = [correctOrder[1], correctOrder[0], ...correctOrder.slice(2)];
  value.solutions[flowId].acceptedOrders = [alternate];
  const { public: set, solutions } = validateSet(value);
  for (const answer of [0, 'prepare', [], correctOrder.slice(1), [...correctOrder.slice(1), correctOrder[1]], [...correctOrder.slice(1), 'invented']]) {
    assert.throws(() => validateAnswers({ [flowId]: answer }, set));
  }
  for (const answer of [correctOrder, alternate]) {
    const results = initialResults(set, solutions, validateAnswers({ [flowId]: answer }, set));
    assert.equal(results[0].correct, true);
    assert.equal(results[0].score, 2);
    assert.equal(results[0].status, 'graded');
  }
  assert.equal(initialResults(set, solutions, { [flowId]: [...correctOrder].reverse() })[0].score, 0);
});

let worker;
before(async () => { worker = await startQuizWorker(); });
after(async () => { await worker?.mf.dispose(); });
async function start(artifact = patternsFixture, commit = '3'.repeat(40)) {
  const set = await worker.publish(artifact, commit);
  const call = worker.client();
  const state = await (await call(`/api/question-sets/${set.id}/attempts`, { method: 'POST', body: {} })).json();
  const answer = (questionId, value) => call(`/api/attempts/${state.id}/instant-answers`, { method: 'POST', body: { questionId, answer: value } });
  return { call, state, answer };
}

test('mixed categories preserve one-question progress and ordering feedback before written grading', async () => {
  const { call, state, answer } = await start();
  assert.equal((await answer(flowId, correctOrder)).status, 409, 'cannot skip choice questions');
  for (const q of patternsFixture.questions.filter((q) => isImmediate(q) && q.id !== flowId).slice(0, 2)) {
    assert.equal((await answer(q.id, patternsFixture.solutions[q.id].answer)).status, 200);
  }
  assert.equal((await answer(flowId, ['prepare', 'prepare', 'send', 'receive'])).status, 400);
  const response = await answer(flowId, [...correctOrder].reverse());
  assert.equal(response.status, 200);
  const progress = await response.json();
  const result = progress.results.find((r) => r.questionId === flowId);
  assert.equal(result.correct, false);
  assert.equal(result.score, 0);
  assert.deepEqual(result.answer, correctOrder);
  assert.equal(progress.results.length, 3, 'future answers remain hidden');
  assert.equal(progress.completed, false);
  const reloaded = await (await call(`/api/attempts/${state.id}`)).json();
  assert.deepEqual(reloaded.answers[flowId], [...correctOrder].reverse());
  assert.equal((await answer(flowId, [...correctOrder].reverse())).status, 200);
  assert.equal((await answer(flowId, correctOrder)).status, 409);
  const written = { 'public-client-design': 'redirect_uris にURL一覧。シークレットを持たないため none。TLSでJSONをPOST。' };
  assert.equal((await call(`/api/attempts/${state.id}/answers`, { method: 'POST', body: { answers: written } })).status, 409, 'cannot skip later immediate questions');
  for (const q of patternsFixture.questions.filter(isImmediate).slice(3)) assert.equal((await answer(q.id, patternsFixture.solutions[q.id].answer)).status, 200);
  const saved = await (await call(`/api/attempts/${state.id}/answers`, { method: 'POST', body: { answers: written } })).json();
  assert.equal(saved.status, 'saved');
  assert.equal(saved.results.find((r) => r.questionId === flowId).score, 0);
  assert.equal(worker.executions.size, 0, 'instant answers and saving written answers do not call AI');
  const job = await (await call(`/api/attempts/${state.id}/grading-requests`, { method: 'POST', body: {} })).json();
  const execution = await worker.waitForExecution(job.id);
  assert.equal(execution.input.questions.length, 1);
  assert.equal(execution.input.promptVersion, 2);
  assert.equal(execution.input.questions[0].category, 'design');
  assert.equal(execution.input.questions[0].answer, written['public-client-design']);
  assert.ok(execution.input.questions[0].solution.rubric);
  await worker.complete(job.id);
  const graded = await (await call(`/api/attempts/${state.id}`)).json();
  assert.equal(graded.status, 'graded');
  assert.equal(graded.grading.promptVersion, 2);
});

test('concurrent final ordering answers keep one immutable result and finish atomically', async () => {
  const { call, state, answer } = await start(flowOnly(), '4'.repeat(40));
  const responses = await Promise.all([answer(flowId, correctOrder), answer(flowId, [...correctOrder].reverse())]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const saved = await (await call(`/api/attempts/${state.id}`)).json();
  assert.equal(saved.status, 'graded'); assert.equal(saved.completed, true);
  assert.equal(saved.results[0].correct, JSON.stringify(saved.answers[flowId]) === JSON.stringify(correctOrder));
  assert.equal((await answer(flowId, saved.answers[flowId])).status, 200, 'array retries compare contents');
  assert.equal((await worker.db.prepare('SELECT COUNT(*) AS count FROM instant_answers WHERE attempt_id = ?').bind(state.id).first()).count, 1);
  assert.equal((await worker.client('other')(`/api/attempts/${state.id}/instant-answers`, { method: 'POST', body: { questionId: flowId, answer: correctOrder } })).status, 404);
});

test('partial choices written by an old Worker survive migration and can continue with new storage', async () => {
  const { call, state, answer } = await start(fixture, '5'.repeat(40));
  const result = initialResults({ questions: [state.set.questions[0]] }, fixture.solutions, { 'client-sub': 0 })[0];
  await worker.db.prepare('INSERT INTO choice_answers (attempt_id, question_id, answer, result_json, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(state.id, 'client-sub', 0, JSON.stringify(result), Math.floor(Date.now() / 1000)).run();
  const reloaded = await (await call(`/api/attempts/${state.id}`)).json();
  assert.deepEqual(reloaded.answers, { 'client-sub': 0 });
  assert.equal((await answer('client-sub', 0)).status, 200);
  assert.equal((await answer('client-sub', 1)).status, 409);
  assert.equal((await call(`/api/attempts/${state.id}/answers`, { method: 'POST', body: { answers: { 'audience-validation': '受信者が異なるため拒否する。' } } })).status, 200);
});

test('authoring specifies category coverage and rejects missing categories in AI output', async () => {
  const author = worker.client('author');
  const context = { ...patternsFixture, id: 'all-categories' };
  const body = { context, material: '出典の本文を参照', questionCount: 6, questionCategories: Object.keys(QUESTION_CATEGORIES) };
  assert.equal((await author('/api/authoring/requests', { method: 'POST', body: { ...body, questionCount: 4 } })).status, 400);
  assert.equal((await author('/api/authoring/requests', { method: 'POST', body: { ...body, questionCategories: ['translation'] } })).status, 400);
  const job = await (await author('/api/authoring/requests', { method: 'POST', body })).json();
  const execution = await worker.waitForExecution(job.id);
  assert.deepEqual(execution.input.questionCategories, Object.keys(QUESTION_CATEGORIES));
  await worker.complete(job.id, { output: patternsFixture });
  assert.equal((await (await author(`/api/authoring/requests/${job.id}`)).json()).status, 'completed');
  const missingJob = await (await author('/api/authoring/requests', { method: 'POST', body: { ...body, context: { ...context, id: 'missing-category' } } })).json();
  const missing = structuredClone(patternsFixture);
  missing.questions[0].category = 'knowledge';
  await worker.complete(missingJob.id, { output: missing });
  assert.equal((await (await author(`/api/authoring/requests/${missingJob.id}`)).json()).status, 'failed');
});
