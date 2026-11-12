import { HttpError } from './contracts.js';

const cache = new Map();
const bytes = (s) => Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));
const parse = (s) => JSON.parse(new TextDecoder().decode(bytes(s)));
export const accessConfigured = (env) => /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_ISSUER || '') && Boolean(env.ACCESS_AUD);

export async function identity(request, env) {
  if (!accessConfigured(env)) throw new HttpError(503, '記述式の AI 採点には利用者認証の設定が必要です。');
  try {
    const token = request.headers.get('cf-access-jwt-assertion') || '';
    if (token.length > 16000) throw new Error();
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error();
    const header = parse(parts[0]);
    const claims = parse(parts[1]);
    const now = Math.floor(Date.now() / 1000);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || claims.iss !== env.ACCESS_ISSUER || !audiences.includes(env.ACCESS_AUD)
        || !Number.isFinite(claims.exp) || claims.exp <= now || (claims.nbf && claims.nbf > now + 30)
        || typeof claims.sub !== 'string' || claims.sub.length > 256) throw new Error();
    const service = !claims.sub && typeof claims.common_name === 'string' && /^[\w-]{1,200}\.access$/.test(claims.common_name);
    if (!claims.sub && !service) throw new Error();
    let entry = cache.get(env.ACCESS_ISSUER);
    if (!entry || entry.expires < now || !entry.keys.some((k) => k.kid === header.kid)) {
      const response = await fetch(`${env.ACCESS_ISSUER}/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error();
      const data = await response.json();
      entry = { keys: data.keys, expires: now + 300 };
      cache.set(env.ACCESS_ISSUER, entry);
    }
    const jwk = entry.keys.find((k) => k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) throw new Error();
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))) throw new Error();
    return { id: service ? `service:${claims.common_name}` : claims.sub, email: !service && typeof claims.email === 'string' ? claims.email : '', authenticated: true };
  } catch { throw new HttpError(401, '許可されたアカウントでログインしてください。'); }
}

export const isAuthor = (user, env) => (env.AUTHOR_SUBJECTS || '').split(',').map((v) => v.trim()).includes(user.id)
  || Boolean(user.email && (env.AUTHOR_EMAILS || '').split(',').map((v) => v.trim()).includes(user.email));
export function requireAuthor(user, env) {
  if (!isAuthor(user, env)) throw new HttpError(403, '作問・公開の権限が必要です。');
}

export async function callbackToken(id, secret) {
  if (!secret || secret.length < 32) throw new HttpError(503, 'AI 結果受付の設定が必要です。');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(id));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function verifyCallback(request, id, secret) {
  try {
    if (!secret || secret.length < 32) throw new Error();
    const token = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify('HMAC', key, Uint8Array.from(atob(token), (c) => c.charCodeAt(0)), new TextEncoder().encode(id))) throw new Error();
  } catch { throw new HttpError(401, 'AI 結果の認証に失敗しました。'); }
}
