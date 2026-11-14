import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, realpath } from 'node:fs/promises';
import vm from 'node:vm';
import { startQuizWorker, implementationFixture, fixture, accessToken, promptData } from '../test-support/quiz-worker.mjs';
import { validateSet, validateAnswers, initialResults, validateGrades, validateCategories } from '../worker/contracts.js';
import { setForAttempt, isImmediate } from '../shared/quiz-types.js';
import { buildAiInput } from '../worker/prompts.js';

const qid = 'resolve-auth-method';
const sample = () => structuredClone(implementationFixture);

test('implementation samples cite real source lines and keep all grading data private', async () => {
  const value = sample();
  value.questions[0].implementation.referenceCode = 'PRIVATE_CODE';
  value.questions[0].implementation.mobile.answer = 'PRIVATE_ANSWER';
  value.questions[0].implementation.cases[0].rubric = 'PRIVATE_RUBRIC';
  const { public: set, solutions } = validateSet(value, { published: true });
  assert.equal(set.questions[0].type, 'implementation');
  assert.equal(set.questions[0].implementation.cases.length, 6);
  assert.equal(JSON.stringify(set).includes('PRIVATE_'), false);
  assert.equal(JSON.stringify(set).includes('mobileAnswer'), false);
  assert.equal(JSON.stringify(set).includes('mobileExplanation'), false);
  assert.equal(JSON.stringify(set).includes('referenceCode'), false);
  assert.ok(solutions[qid].referenceCode);
  assert.deepEqual(validateCategories(['knowledge', 'implementation'], 2), ['knowledge', 'implementation']);
  for (const ref of value.references) {
    const source = (await readFile(new URL(`../../../${ref.path}`, import.meta.url), 'utf8')).split('\n');
    assert.equal(ref.excerpt, source.slice(ref.startLine - 1, ref.endLine).join('\n'));
  }
});

test('implementation schema rejects missing cases, unsupported languages and incomplete mobile alternatives', () => {
  for (const mutate of [
    (v) => { delete v.questions[0].scenario; },
    (v) => { v.questions[0].category = 'knowledge'; },
    (v) => { v.questions[0].type = 'written'; },
    (v) => { delete v.questions[0].implementation; },
    (v) => { v.questions[0].implementation.language = 'shell'; },
    (v) => { v.questions[0].implementation.language = ['javascript']; },
    (v) => { v.questions[0].implementation.starterCode = ''; },
    (v) => { v.questions[0].implementation.cases = []; },
    (v) => { v.questions[0].implementation.cases[0] = null; },
    (v) => { v.questions[0].implementation.cases[0].expected = ''; },
    (v) => { v.questions[0].implementation.cases[0].name = v.questions[0].implementation.cases[1].name; },
    (v) => { delete v.questions[0].implementation.mobile; },
    (v) => { v.questions[0].implementation.mobile.code = ''; },
    (v) => { v.questions[0].implementation.mobile.options = ['same', 'same']; },
    (v) => { v.solutions[qid].mobileAnswer = 8; },
    (v) => { v.solutions[qid].mobileExplanation = ''; },
    (v) => { delete v.solutions[qid].referenceCode; },
    (v) => { v.solutions[qid].rubric[0].points = 10; },
    (v) => { v.solutions[qid].rubric[0].referenceIds = ['missing']; },
  ]) { const value = sample(); mutate(value); assert.throws(() => validateSet(value)); }
  for (const language of ['javascript', 'typescript', 'python']) {
    const value = sample(); value.questions[0].implementation.language = language;
    assert.equal(validateSet(value).public.questions[0].implementation.language, language);
  }
});

test('desktop code uses rubric grading while reading answers are validated and graded as choices', () => {
  const { public: set, solutions } = validateSet(sample());
  assert.equal(isImmediate(set.questions[0]), false);
  for (const answer of [0, {}, [], '', ' ', 'x'.repeat(16001)]) assert.throws(() => validateAnswers({ [qid]: answer }, set));
  const answers = validateAnswers({ [qid]: solutions[qid].referenceCode }, set);
  assert.equal(initialResults(set, solutions, answers)[0].status, 'pending');
  assert.throws(() => validateGrades({ grades: [] }, set));
  const grades = [{ questionId: qid, score: 2, reason: '不正入力のケースを満たしません。', referenceIds: ['auth-method-metadata'] }];
  assert.equal(validateGrades({ grades }, set)[0].score, 2);
  const mobile = setForAttempt(set, 'reading');
  assert.equal(mobile.questions[0].type, 'choice');
  assert.equal(set.questions[0].type, 'implementation', 'projection does not mutate the stored problem');
  for (const answer of ['0', 'code', -1, 4]) assert.throws(() => validateAnswers({ [qid]: answer }, mobile));
  assert.equal(initialResults(mobile, solutions, { [qid]: 0 })[0].score, 3);
  assert.equal(initialResults(mobile, solutions, { [qid]: 1 })[0].score, 0);
  assert.equal(initialResults(mobile, solutions, { [qid]: 0 })[0].reason, solutions[qid].mobileExplanation);
});

test('the sample reference implementation meets its cases without changing metadata', () => {
  const resolve = vm.runInNewContext(`${sample().solutions[qid].referenceCode}; resolveAuthMethod`);
  for (const c of sample().questions[0].implementation.cases) {
    const input = JSON.parse(c.input), original = structuredClone(input);
    if (c.expected.startsWith('TypeError')) assert.throws(() => resolve(input), { name: 'TypeError' });
    else assert.equal(resolve(input), JSON.parse(c.expected));
    assert.deepEqual(input, original);
  }
});

test('both agent directories resolve to the common skill and prompts describe the complete implementation contract', async () => {
  const root = new URL('../../../', import.meta.url);
  const canonical = await realpath(new URL('skills/quiz-authoring/SKILL.md', root));
  for (const path of ['.agents/skills/quiz-authoring/SKILL.md', '.claude/skills/quiz-authoring/SKILL.md']) assert.equal(await realpath(new URL(path, root)), canonical);
  const generation = buildAiInput('questions.generate', {});
  for (const field of ['implementation', 'starterCode', 'cases', 'mobileAnswer', 'mobileExplanation', 'referenceCode']) assert.ok(generation.system.includes(field));
  assert.match(buildAiInput('answers.grade', {}).system, /コードは実行せず/);
});

let worker, set;
before(async () => { worker = await startQuizWorker(); set = await worker.publish(sample(), '8'.repeat(40)); });
after(async () => { await worker?.mf.dispose(); });
const call = (path, body, subject = 'reader') => worker.client(subject)(path, body === undefined ? {} : { method: 'POST', body });
const postForm = (path, fields) => worker.mf.dispatchFetch(`https://reader.test${path}`, {
  method: 'POST', redirect: 'manual', headers: { Origin: 'https://reader.test', 'cf-access-jwt-assertion': accessToken(), 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString(),
});
const start = async (mode = 'code', setId = set.id) => (await call(`/api/question-sets/${setId}/attempts`, { implementationMode: mode })).json();

test('PC attempts save code, send cases and rubric to AI, accept the callback and preserve immutable answers', async () => {
  const state = await start();
  assert.equal(state.implementationMode, 'code');
  const page = await (await call(`/quiz?attempt=${state.id}`)).text();
  assert.match(page, /data-code-input/);
  assert.match(page, /満たすケース/);
  assert.ok(!page.includes(sample().solutions[qid].referenceCode));
  assert.equal((await call(`/api/attempts/${state.id}/instant-answers`, { questionId: qid, answer: 0 })).status, 400);
  const code = sample().solutions[qid].referenceCode;
  const saved = await (await call(`/api/attempts/${state.id}/answers`, { answers: { [qid]: code } })).json();
  assert.equal(saved.status, 'saved');
  assert.equal(saved.completed, true);
  assert.equal(saved.results[0].status, 'pending');
  assert.equal((await call(`/api/attempts/${state.id}/answers`, { answers: { [qid]: 'different code' } })).status, 409);
  assert.equal((await call(`/api/attempts/${state.id}/answers`, { answers: { [qid]: code } })).status, 200);
  const job = await (await call(`/api/attempts/${state.id}/grading-requests`, {})).json();
  const execution = await worker.waitForExecution(job.id);
  const question = promptData(execution).questions[0];
  assert.equal(question.answer, code);
  assert.deepEqual(question.implementation.cases, sample().questions[0].implementation.cases);
  assert.deepEqual(question.solution.rubric, sample().solutions[qid].rubric);
  assert.equal(promptData(execution).promptVersion, 4);
  await worker.complete(job.id);
  const result = await (await call(`/api/attempts/${state.id}`)).json();
  assert.equal(result.status, 'graded');
  assert.equal(result.results[0].score, 3);
  assert.equal(result.answers[qid], code);
  assert.match(await (await call(`/quiz?attempt=${state.id}`)).text(), /data-code-preview/);
  assert.equal((await call(`/api/attempts/${state.id}`, undefined, 'other')).status, 404);
});

test('mobile form submissions grade reading choices immediately and persist their mode on resume', async () => {
  const response = await postForm('/quiz/attempts', { setId: set.id, implementationMode: 'reading' });
  assert.equal(response.status, 303);
  const url = new URL(response.headers.get('location'), 'https://reader.test');
  const id = url.searchParams.get('attempt');
  const page = await (await call(url.pathname + url.search)).text();
  assert.match(page, /コード読解・選択式/);
  assert.match(page, /data-code-preview/);
  assert.equal((page.match(/data-code-preview/g) || []).length, sample().questions[0].implementation.mobile.options.length + 1);
  assert.match(page, /aria-label="問題のコード"/);
  assert.match(page, /aria-label="選択肢 A のコード"/);
  assert.ok(!page.includes('<textarea'));
  assert.ok(!page.includes('data-code-input'));
  const state = await (await call(`/api/attempts/${id}`)).json();
  assert.equal(state.implementationMode, 'reading');
  assert.equal(state.set.questions[0].prompt, sample().questions[0].implementation.mobile.prompt);
  assert.equal(state.results, null);
  const executions = worker.executions.size;
  const feedback = await postForm(`/quiz/attempts/${id}/instant-answers`, { questionId: qid, [qid]: '0' });
  assert.equal(feedback.status, 303);
  const saved = await (await call(`/api/attempts/${id}`)).json();
  assert.equal(saved.status, 'graded');
  assert.equal(saved.completed, true);
  assert.equal(saved.results[0].reason, sample().solutions[qid].mobileExplanation);
  assert.equal(worker.executions.size, executions, 'no paid AI job for reading choices');
  assert.equal((await call(`/api/attempts/${id}/instant-answers`, { questionId: qid, answer: 1 })).status, 409);
  assert.equal((await call(`/api/attempts/${id}/instant-answers`, { questionId: qid, answer: 0 })).status, 200);
  assert.equal((await call(`/api/attempts/${id}`)).status, 200);
});

test('anonymous code saves retain the code mode through login and grading', async () => {
  const anonymous = worker.anonymousClient();
  const state = await (await anonymous(`/api/question-sets/${set.id}/attempts`, { method: 'POST', body: { implementationMode: 'code' } })).json();
  const saved = await anonymous(`/api/attempts/${state.id}/answers`, { method: 'POST', body: { answers: { [qid]: sample().solutions[qid].referenceCode } } });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).implementationMode, 'code');
  const loginPage = await anonymous(`/quiz/ai-grading?attempt=${state.id}`, { subject: 'reader' });
  assert.equal(loginPage.status, 200);
  assert.match(await loginPage.text(), /id="grading-form"/);
  const requested = await anonymous(`/api/attempts/${state.id}/grading-requests`, { method: 'POST', body: {}, subject: 'reader' });
  assert.equal(requested.status, 202);
  const job = await requested.json();
  const execution = await worker.waitForExecution(job.id);
  assert.equal(promptData(execution).questions[0].type, 'implementation');
  await worker.complete(job.id);
  const result = await (await anonymous(`/api/attempts/${state.id}`)).json();
  assert.equal(result.status, 'graded');
  assert.equal(result.implementationMode, 'code');
  assert.equal(result.results[0].score, 3);
});

test('mixed sets grade mobile implementation with choices and only send written responses to AI', async () => {
  const mixed = sample();
  mixed.references.push(...fixture.references);
  mixed.questions.unshift(...fixture.questions);
  Object.assign(mixed.solutions, fixture.solutions);
  const published = await worker.publish(mixed, '9'.repeat(40));
  const state = await start('reading', published.id);
  assert.equal((await call(`/api/attempts/${state.id}/instant-answers`, { questionId: qid, answer: 0 })).status, 409);
  assert.equal((await call(`/api/attempts/${state.id}/instant-answers`, { questionId: 'client-sub', answer: 0 })).status, 200);
  assert.equal((await call(`/api/attempts/${state.id}/instant-answers`, { questionId: qid, answer: 0 })).status, 200);
  const saved = await (await call(`/api/attempts/${state.id}/answers`, { answers: { 'audience-validation': '受信者が異なるため拒否する。' } })).json();
  assert.equal(saved.status, 'saved');
  assert.equal(saved.results.find((r) => r.questionId === qid).score, 3);
  const job = await (await call(`/api/attempts/${state.id}/grading-requests`, {})).json();
  assert.deepEqual(promptData(await worker.waitForExecution(job.id)).questions.map((q) => q.type), ['written']);
  await worker.complete(job.id);
  assert.equal((await (await call(`/api/attempts/${state.id}`)).json()).status, 'graded');
});

test('mode, answer types and code HTML are validated before storage and rendering', async () => {
  assert.equal((await call(`/api/question-sets/${set.id}/attempts`, { implementationMode: 'unknown' })).status, 400);
  const state = await start();
  for (const code of [0, '', 'x'.repeat(16001)]) assert.equal((await call(`/api/attempts/${state.id}/answers`, { answers: { [qid]: code } })).status, 400);
  const source = '</textarea><script>globalThis.quizInjected=true</script>';
  assert.equal((await postForm(`/quiz/attempts/${state.id}/answers`, { [qid]: source })).status, 303);
  const html = await (await call(`/quiz?attempt=${state.id}`)).text();
  assert.ok(!html.includes(source));
  assert.ok(html.includes('&lt;/textarea&gt;'));
});

test('written and multiple code implementations each save and resume independently before grading', async () => {
  const artifact = sample();
  const written = structuredClone(fixture.questions.find((q) => q.type === 'written'));
  const second = { ...structuredClone(artifact.questions[0]), id: 'second-implementation' };
  artifact.questions = [written, ...artifact.questions, second];
  artifact.references.push(...fixture.references);
  artifact.solutions[written.id] = structuredClone(fixture.solutions[written.id]);
  artifact.solutions[second.id] = structuredClone(artifact.solutions[qid]);
  const published = await worker.publish(artifact, 'b'.repeat(40));
  const state = await start('code', published.id);
  const save = (answers) => call(`/api/attempts/${state.id}/answers`, { answers });
  assert.equal((await save({ [qid]: artifact.solutions[qid].referenceCode })).status, 409);
  const first = await (await save({ [written.id]: '受信者を確認する。' })).json();
  assert.equal(first.completed, false);
  const nextPage = await (await call(`/quiz?attempt=${state.id}`)).text();
  assert.equal((nextPage.match(/data-code-input/g) || []).length, 1);
  assert.match(nextPage, /記述式・実装 2 \/ 3/);
  const code = artifact.solutions[qid].referenceCode;
  const partial = await (await save({ [qid]: code })).json();
  assert.equal(partial.completed, false);
  assert.equal(partial.answers[qid], code);
  assert.equal(partial.answers[written.id], '受信者を確認する。');
  const resumed = await (await call(`/quiz?attempt=${state.id}`)).text();
  assert.match(resumed, /記述式・実装 3 \/ 3/);
  assert.match(resumed, /name="second-implementation"/);
  assert.ok(!resumed.includes(`name="${qid}"`));
  const saved = await (await save({ [second.id]: code })).json();
  assert.equal(saved.completed, true);
  assert.equal(saved.status, 'saved');
  assert.equal(saved.results.length, 3);
  assert.deepEqual(saved.answers, { [written.id]: '受信者を確認する。', [qid]: code, [second.id]: code });
  const job = await (await call(`/api/attempts/${state.id}/grading-requests`, {})).json();
  assert.deepEqual(promptData(await worker.waitForExecution(job.id)).questions.map((q) => q.type), ['written', 'implementation', 'implementation']);
  await worker.complete(job.id);
  assert.equal((await (await call(`/api/attempts/${state.id}`)).json()).status, 'graded');
});
