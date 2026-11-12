import { HttpError } from './contracts.js';
import { identity, requireAuthor, accessConfigured } from './auth.js';
import { getCookie, setCookie } from 'hono/cookie';

export async function requireDatabase(c, next) {
  if (!c.env.DB) throw new HttpError(503, '出題サービスの設定が必要です。');
  await next();
}

export async function authenticate(c, next) {
  c.set('user', { ...await identity(c.req.raw, c.env), anonymousId: c.get('user')?.anonymousId });
  await next();
}

export async function visitor(c, next) {
  let token = getCookie(c, '__Host-quiz-session');
  if (!/^[a-f0-9]{64}$/.test(token || '')) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
    setCookie(c, '__Host-quiz-session', token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 31536000 });
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const anonymousId = `guest:${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')}`;
  let user = { id: anonymousId, authenticated: false };
  if (accessConfigured(c.env) && c.req.header('cf-access-jwt-assertion')) {
    try { user = await identity(c.req.raw, c.env); } catch (error) { if (!(error instanceof HttpError) || error.status !== 401) throw error; }
  }
  c.set('user', { ...user, anonymousId });
  await next();
}

export async function sameOrigin(c, next) {
  if (c.req.method === 'POST') {
    const origin = c.req.header('origin');
    if ((origin && origin !== new URL(c.req.url).origin) || c.req.header('sec-fetch-site') === 'cross-site') {
      throw new HttpError(403, '同じサイトから送信してください。');
    }
  }
  await next();
}

export async function authorOnly(c, next) {
  requireAuthor(c.get('user'), c.env);
  await next();
}

export function validId(validate) {
  return async (c, next) => {
    if (!validate(c.req.param('id'))) throw new HttpError(404, 'エンドポイントが見つかりません。');
    await next();
  };
}
