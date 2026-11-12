import { Hono } from 'hono';
import { HttpError, fail, uuid } from '../contracts.js';
import { authenticate, requireDatabase, sameOrigin, validId, visitor } from '../middleware.js';
import { accessConfigured } from '../auth.js';
import { readForm } from '../http.js';
import { getSet, getAttempt, parseSet } from '../store.js';
import { startAttempt, saveInstantAnswers, saveWrittenAnswers, requestWrittenGrading } from '../services/attempts.js';
import { loadPage } from '../services/page-data.js';
import { QuizPage } from '../../web/pages.jsx';

export const pageRoutes = new Hono();
pageRoutes.use('*', visitor, sameOrigin);
pageRoutes.use('/attempts', requireDatabase);
pageRoutes.use('/attempts/*', requireDatabase);
pageRoutes.use('*', async (c, next) => {
  c.header('Cache-Control', 'private, no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  await next();
});
async function renderPage(c) {
  const page = await loadPage(c.env, c.get('user'), new URL(c.req.url).searchParams);
  page.canGrade = c.get('user').authenticated;
  page.gradingAvailable = accessConfigured(c.env);
  return c.html(<QuizPage page={page} />);
}
pageRoutes.get('/', renderPage);
// Access のログイン導線は GET に限定し、ログイン後も回答と専用の採点ボタンを表示する。
pageRoutes.get('/ai-grading', requireDatabase, authenticate, async (c) => {
  if (!uuid(c.req.query('attempt'))) throw new HttpError(404, '回答が見つかりません。');
  return renderPage(c);
});

function navigate(c, location) {
  return c.req.header('accept')?.includes('application/json') ? c.json({ location }) : c.redirect(location, 303);
}
const attemptUrl = (id, extra = {}) => `/quiz?${new URLSearchParams({ attempt: id, ...extra })}`;

pageRoutes.post('/attempts', async (c) => {
  const form = await readForm(c.req.raw);
  const setId = form.get('setId');
  if (!/^[a-f0-9]{64}$/.test(setId)) fail('問題セットを指定してください。');
  const data = await startAttempt(c.env, c.get('user'), setId, form.get('implementationMode') ?? 'code');
  return navigate(c, attemptUrl(data.id));
});

pageRoutes.post('/attempts/:id/instant-answers', validId(uuid), async (c) => {
  const form = await readForm(c.req.raw);
  const id = c.req.param('id');
  const questionId = form.get('questionId');
  const row = await getAttempt(c.env, id, c.get('user'));
  const set = parseSet(await getSet(c.env, row.set_id));
  const question = set.questions.find((q) => q.id === questionId);
  let answer;
  if (question?.type === 'ordering') {
    try { answer = form.getAll('order').length ? form.getAll('order') : JSON.parse(form.get(questionId)); } catch { fail('並び順を確認してください。'); }
  } else {
    const value = form.get(questionId);
    answer = value === null || value.trim() === '' ? null : Number(value);
  }
  await saveInstantAnswers(c.env, c.get('user'), id, { questionId, answer });
  return navigate(c, attemptUrl(id, { question: questionId, focus: 'feedback' }));
});

pageRoutes.post('/attempts/:id/answers', validId(uuid), async (c) => {
  const form = await readForm(c.req.raw);
  const id = c.req.param('id');
  await saveWrittenAnswers(c.env, c.get('user'), id, Object.fromEntries(form));
  return navigate(c, attemptUrl(id));
});
pageRoutes.post('/attempts/:id/grading-requests', validId(uuid), authenticate, async (c) => {
  await requestWrittenGrading(c.env, c.get('user'), c.req.param('id'));
  return navigate(c, attemptUrl(c.req.param('id')));
});
pageRoutes.all('*', () => { throw new HttpError(404, '画面が見つかりません。'); });
