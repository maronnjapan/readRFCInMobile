import { Hono } from 'hono';
import { uuid } from '../contracts.js';
import { validId } from '../middleware.js';
import { readJson } from '../http.js';
import { getAttempt, attemptView } from '../store.js';
import { saveInstantAnswers, saveWrittenAnswers, requestWrittenGrading } from '../services/attempts.js';

export const attemptRoutes = new Hono();
const attemptId = validId(uuid);

attemptRoutes.get('/:id', attemptId, async (c) => {
  return c.json(await attemptView(c.env, await getAttempt(c.env, c.req.param('id'), c.get('user'))));
});

async function instantAnswer(c) {
  const body = await readJson(c.req.raw);
  return c.json(await saveInstantAnswers(c.env, c.get('user'), c.req.param('id'), body));
}
attemptRoutes.post('/:id/instant-answers', attemptId, instantAnswer);
attemptRoutes.post('/:id/choice-answers', attemptId, instantAnswer);

attemptRoutes.post('/:id/answers', attemptId, async (c) => {
  const body = await readJson(c.req.raw);
  return c.json(await saveWrittenAnswers(c.env, c.get('user'), c.req.param('id'), body?.answers));
});

attemptRoutes.post('/:id/grading-requests', attemptId, async (c) => {
  const result = await requestWrittenGrading(c.env, c.get('user'), c.req.param('id'));
  return c.json(result, result.status === 'queued' ? 202 : 200);
});
