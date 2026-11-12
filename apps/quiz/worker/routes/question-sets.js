import { Hono } from 'hono';
import { authorOnly, validId } from '../middleware.js';
import { readJson, now } from '../http.js';
import { getSet, parseSet, getAttempt, attemptView } from '../store.js';
import { publishQuestionSet } from '../services/question-sets.js';

export const questionSetRoutes = new Hono();
const setId = validId((id) => /^[a-f0-9]{64}$/.test(id));

questionSetRoutes.get('/', async (c) => {
  const spec = c.req.query('spec');
  const query = spec
    ? c.env.DB.prepare('SELECT * FROM question_sets WHERE spec_id = ? ORDER BY created_at DESC LIMIT 100').bind(spec)
    : c.env.DB.prepare('SELECT * FROM question_sets ORDER BY created_at DESC LIMIT 100');
  const rows = await query.all();
  const sets = rows.results.map((row) => ({
    id: row.id, title: row.title, spec: JSON.parse(row.public_json).spec,
    pullRequest: JSON.parse(row.pr_json || 'null'), revision: JSON.parse(row.revision_json),
  }));
  return c.json({ sets });
});

questionSetRoutes.post('/import', authorOnly, async (c) => {
  return c.json(await publishQuestionSet(c.env, await readJson(c.req.raw)));
});

questionSetRoutes.get('/:id', setId, async (c) => {
  return c.json(parseSet(await getSet(c.env, c.req.param('id'))));
});

questionSetRoutes.get('/:id/attempts', setId, async (c) => {
  const set = await getSet(c.env, c.req.param('id'));
  const rows = await c.env.DB.prepare('SELECT id, status, created_at FROM attempts WHERE set_id = ? AND owner = ? ORDER BY created_at DESC LIMIT 20')
    .bind(set.id, c.get('user').id).all();
  return c.json({ attempts: rows.results });
});

questionSetRoutes.post('/:id/attempts', setId, async (c) => {
  const set = await getSet(c.env, c.req.param('id'));
  const user = c.get('user');
  const id = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO attempts (id, set_id, owner, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, set.id, user.id, now(), now()).run();
  return c.json(await attemptView(c.env, await getAttempt(c.env, id, user)), 201);
});
