import { createExecutorAuth } from './ai-executor-auth.js';

// auth.fetch(request, send) -> Promise<Response>
// 認証付きの通信全体をアダプタへ委譲し、出題・採点処理から独立させる。
export function createExecutorClient({ endpoint, auth, fetcher = fetch, timeoutMs = 20000 }) {
  let url;
  try { url = new URL(endpoint); } catch { throw new Error('AI executor URL is not configured'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('AI executor requires an HTTPS endpoint without URL credentials or fragment');
  if (typeof auth?.fetch !== 'function') throw new Error('AI executor authentication adapter is required');

  return {
    async submit(payload) {
      const request = new Request(url.href, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs), redirect: 'manual',
      });
      const response = await auth.fetch(request, fetcher);
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        throw new Error('AI executor redirects are not allowed');
      }
      return response;
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
