import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startQuizWorker, patternsFixture, callbackSecret } from '../test-support/quiz-worker.mjs';
import { buildAiInput } from '../worker/prompts.js';
import { dispatchJobs } from '../worker/jobs/dispatch.js';

function assertPrompt(input) {
  assert.deepEqual(Object.keys(input).sort(), ['messages', 'system']);
  assert.equal(typeof input.system, 'string');
  assert.equal(input.messages.length, 1);
  assert.equal(input.messages[0].role, 'user');
  assert.equal(typeof input.messages[0].content, 'string');
  return JSON.parse(input.messages[0].content);
}

test('the quiz app constructs complete generation and grading prompts for a generic executor', () => {
  const generated = buildAiInput('questions.generate', { questionCount: 6, questionCategories: ['flow', 'design'], context: patternsFixture, material: '取得した固定版の資料' });
  const input = assertPrompt(generated);
  assert.match(generated.system, /単語を平易な説明/);
  assert.match(generated.system, /solutionsは問題id/);
  assert.ok(generated.system.includes('\n回答はJSON'));
  assert.equal(input.data.context.references[0].excerpt, patternsFixture.references[0].excerpt);
  assert.deepEqual(input.data.questionCategories, ['flow', 'design']);
  assert.ok(input.outputFormat.questions);
  const graded = buildAiInput('answers.grade', { questions: [{ id: 'design', answer: '短い回答', solution: { rubric: ['採点基準'] } }], sourceMaterials: { source: '出典本文' } });
  const data = assertPrompt(graded);
  assert.equal(data.data.questions[0].answer, '短い回答');
  assert.equal(data.data.sourceMaterials.source, '出典本文');
  assert.match(graded.system, /短い箇条書き/);
  assert.ok(data.outputFormat.grades);
  assert.throws(() => buildAiInput('chat', {}));
});

let worker;
before(async () => { worker = await startQuizWorker(); });
after(async () => { await worker?.mf.dispose(); });

test('the exact assembled prompt is stored before dispatch and sent unchanged to the AI API', async () => {
  const author = worker.client('author');
  const job = await (await author('/api/authoring/requests', { method: 'POST', body: { context: patternsFixture, material: '出典を参照', questionCount: 6, questionCategories: ['vocabulary', 'flow', 'design'] } })).json();
  const execution = await worker.waitForExecution(job.id);
  assertPrompt(execution.input);
  const stored = await worker.db.prepare('SELECT input_json FROM ai_jobs WHERE id = ?').bind(job.id).first();
  assert.deepEqual(execution.input, JSON.parse(stored.input_json).executorInput);
  assert.equal(execution.input.context, undefined);
  assert.equal(execution.input.instructions, undefined);
  await worker.complete(job.id, { output: JSON.stringify(patternsFixture) });
  assert.equal((await (await author(`/api/authoring/requests/${job.id}`)).json()).status, 'completed');
});

test('legacy queued jobs are converted and pinned by the quiz app before reaching the generic AI API', async () => {
  const id = randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  await worker.db.prepare("INSERT INTO ai_jobs (id, operation, target_id, owner, profile, input_json, context_json, created_at, updated_at) VALUES (?, 'questions.generate', 'legacy', 'author', 'test', ?, '{}', ?, ?)")
    .bind(id, JSON.stringify({ instructions: '過去の作問指示', questionCount: 2, material: '過去の資料' }), timestamp, timestamp).run();
  let payload, acknowledged = false;
  await dispatchJobs({ queue: 'spec-quiz-ai', messages: [{ body: { kind: 'ai', id }, ack: () => { acknowledged = true; }, retry: () => { throw new Error('Unexpected retry'); } }] }, {
    DB: worker.db, AI_CALLBACK_SECRET: callbackSecret, AI_EXECUTOR_TRANSPORT: 'service-binding', AI_EXECUTOR_AUTH: 'service-binding', APP_ORIGIN: 'https://reader.test',
    AI_EXECUTOR: { fetch: async (request) => { payload = await request.json(); return new Response('{}', { status: 202 }); } },
  });
  assert.equal(acknowledged, true);
  assert.match(payload.input.system, /過去の作問指示/);
  assert.equal(assertPrompt(payload.input).data.material, '過去の資料');
  const stored = JSON.parse((await worker.db.prepare('SELECT input_json FROM ai_jobs WHERE id = ?').bind(id).first()).input_json);
  assert.deepEqual(stored.executorInput, payload.input);
});
