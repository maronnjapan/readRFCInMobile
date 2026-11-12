import { HttpError } from './contracts.js';
import { identity, requireAuthor } from './auth.js';

export async function requireDatabase(c, next) {
  if (!c.env.DB) throw new HttpError(503, '出題サービスの設定が必要です。');
  await next();
}

export async function authenticate(c, next) {
  c.set('user', await identity(c.req.raw, c.env));
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
