import { Hono } from 'hono';
import { authenticate, requireDatabase, authorOnly, validId } from '../middleware.js';
import { readJson } from '../http.js';
import { getSet, parseSet, listQuestionSets, listAttempts } from '../store.js';
import { startAttempt } from '../services/attempts.js';
import { publishQuestionSet } from '../services/question-sets.js';

export const questionSetRoutes = new Hono();
const setId = validId((id) => /^[a-f0-9]{64}$/.test(id));

questionSetRoutes.get('/', async (c) => {
  return c.json({ sets: await listQuestionSets(c.env, c.req.query('spec')) });
});

questionSetRoutes.post('/import', requireDatabase, authenticate, authorOnly, async (c) => {
  return c.json(await publishQuestionSet(c.env, await readJson(c.req.raw)));
});

questionSetRoutes.get('/:id', setId, async (c) => {
  return c.json(parseSet(await getSet(c.env, c.req.param('id'))));
});

questionSetRoutes.get('/:id/attempts', requireDatabase, setId, async (c) => {
  const set = await getSet(c.env, c.req.param('id'));
  return c.json({ attempts: await listAttempts(c.env, set.id, c.get('user')) });
});

questionSetRoutes.post('/:id/attempts', requireDatabase, setId, async (c) => {
  const body = c.req.raw.body ? await readJson(c.req.raw) : {};
  return c.json(await startAttempt(c.env, c.get('user'), c.req.param('id'), body?.implementationMode), 201);
});
