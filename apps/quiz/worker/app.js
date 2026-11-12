import { Hono } from 'hono';
import { HttpError } from './contracts.js';
import { isAuthor } from './auth.js';
import { authenticate, requireDatabase, sameOrigin } from './middleware.js';
import { questionSetRoutes } from './routes/question-sets.js';
import { attemptRoutes } from './routes/attempts.js';
import { authoringRoutes } from './routes/authoring.js';
import { aiResultRoutes } from './routes/ai-results.js';
import { pageRoutes } from './routes/pages.jsx';
import { ErrorPage } from '../web/document.jsx';
import { jsx } from 'hono/jsx';

const apiHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const api = new Hono();
api.use('*', requireDatabase);
api.use('*', async (c, next) => {
  for (const [name, value] of Object.entries(apiHeaders)) c.header(name, value);
  await next();
});

// AI の結果はジョブ専用トークンで認証する。利用者向けの Access 認証とは分ける。
api.route('/ai', aiResultRoutes);

const authenticated = new Hono();
authenticated.use('*', authenticate, sameOrigin);
authenticated.get('/quiz/config', (c) => {
  const user = c.get('user');
  return c.json({ available: true, canAuthor: isAuthor(user, c.env), user: user.email || user.id });
});
authenticated.route('/question-sets', questionSetRoutes);
authenticated.route('/attempts', attemptRoutes);
authenticated.route('/authoring/requests', authoringRoutes);
authenticated.all('*', () => { throw new HttpError(404, 'エンドポイントまたはメソッドが見つかりません。'); });
api.route('/', authenticated);

export const app = new Hono();
app.route('/api', api);
app.route('/quiz', pageRoutes);
app.get('/quiz.html', (c) => c.redirect(`/quiz${new URL(c.req.url).search}`, 308));
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));
app.onError((error, c) => {
  if (!(error instanceof HttpError)) console.error('quiz_api_error', { path: c.req.path, name: error.name });
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof HttpError ? error.message : '処理できませんでした。もう一度お試しください。';
  if (c.req.path.startsWith('/quiz') && !c.req.header('accept')?.includes('application/json')) {
    return c.html(jsx(ErrorPage, { message }), status, { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  }
  return c.json({ message }, status, apiHeaders);
});
