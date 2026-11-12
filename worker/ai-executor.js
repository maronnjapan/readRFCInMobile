import { createExecutorAuth } from './ai-executor-auth.js';

// auth.authorize({ url, method, signal }) -> HeadersInit
// auth.onResponse?({ url, method, signal, response }) -> boolean (認証 challenge の再送を要求)
// URL・method の確定後に毎回認証し、proof を Queue や D1 に保持しない。
export function createExecutorClient({ endpoint, auth, fetcher = fetch, timeoutMs = 20000 }) {
  let url;
  try { url = new URL(endpoint); } catch { throw new Error('AI executor URL is not configured'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('AI executor requires an HTTPS endpoint without URL credentials or fragment');
  if (typeof auth?.authorize !== 'function') throw new Error('AI executor authentication provider is required');

  return {
    async submit(payload) {
      const body = JSON.stringify(payload);
      const signal = AbortSignal.timeout(timeoutMs);
      for (let attempt = 0; attempt < 2; attempt++) {
        const request = new Request(url.href, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal,
          // API キー・将来の access token / DPoP proof を別の宛先へ転送しない。
          redirect: 'manual',
        });
        const context = Object.freeze({ url: request.url, method: request.method, signal: request.signal });
        const headers = new Headers(await auth.authorize(context));
        headers.forEach((value, name) => request.headers.set(name, value));
        const response = await fetcher(request);
        if (response.status >= 300 && response.status < 400) {
          await response.body?.cancel();
          throw new Error('AI executor redirects are not allowed');
        }
        const retry = await auth.onResponse?.({ ...context, response });
        // DPoP nonce や OAuth token 更新用の再認証は1回だけ。正常な受付は再送しない。
        if (attempt === 0 && retry === true && [400, 401].includes(response.status)) {
          await response.body?.cancel();
          continue;
        }
        return response;
      }
    },
  };
}

export function executorClient(env) {
  const transport = env.AI_EXECUTOR_TRANSPORT || 'https';
  let endpoint = env.AI_EXECUTOR_URL;
  let fetcher;
  if (transport === 'https') fetcher = (request) => fetch(request);
  else if (transport === 'service-binding' && typeof env.AI_EXECUTOR?.fetch === 'function') {
    endpoint ||= 'https://ai-executor.internal/v1/requests';
    fetcher = (request) => env.AI_EXECUTOR.fetch(request);
  } else throw new Error('AI executor transport is not configured');
  return createExecutorClient({ endpoint, auth: createExecutorAuth(env), fetcher });
}
