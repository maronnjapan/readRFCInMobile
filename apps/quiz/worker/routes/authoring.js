import { generationInstructions } from '../prompts.js';
import { Hono } from 'hono';
import { HttpError, fail, text, uuid, validateContext, validateCategories } from '../contracts.js';
import { authorOnly, validId } from '../middleware.js';
import { readJson } from '../http.js';
import { enforceAiLimit, createAiJob } from '../services/ai-jobs.js';

export const authoringRoutes = new Hono();
authoringRoutes.use('*', authorOnly);

authoringRoutes.post('/', async (c) => {
  const body = await readJson(c.req.raw);
  const { id: logicalId, title, spec, references, pullRequest } = validateContext(body.context);
  const context = { id: logicalId, title, spec, references, ...(pullRequest ? { pullRequest } : {}) };
  if (!text(body.material, 100000) || !Number.isInteger(body.questionCount) || body.questionCount < 2 || body.questionCount > 10) {
    fail('資料と問題数（2〜10問）が必要です。');
  }
  const questionCategories = validateCategories(body.questionCategories, body.questionCount);
  const user = c.get('user');
  await enforceAiLimit(c.env, user);
  const id = await createAiJob(c.env, {
    operation: 'questions.generate', target: context.id, owner: user.id, context,
    input: { instructions: generationInstructions, questionCount: body.questionCount, questionCategories, context, material: body.material },
    profile: c.env.AUTHORING_PROFILE || 'quiz-generate-v1',
  });
  return c.json({ id, status: 'queued' }, 202);
});

authoringRoutes.get('/:id', validId(uuid), async (c) => {
  const job = await c.env.DB.prepare("SELECT * FROM ai_jobs WHERE id = ? AND operation = 'questions.generate'")
    .bind(c.req.param('id')).first();
  if (!job) throw new HttpError(404, '作問ジョブが見つかりません。');
  return c.json({ id: job.id, status: job.status, error: job.error, artifact: job.status === 'completed' ? JSON.parse(job.output_json) : null });
});
