// 共通 AI API の呼び出し認証。利用者の Access 認証・callback 認証とは独立させる。
// 差し替え先は fetch(request, send) -> Promise<Response> を実装する。
export function createApiKeyAuth(apiKey) {
  if (typeof apiKey !== 'string' || !apiKey || apiKey.trim() !== apiKey || /[\r\n]/.test(apiKey)) {
    throw new Error('AI executor API key is not configured');
  }
  return {
    async fetch(request, send) {
      request.headers.set('Authorization', `Bearer ${apiKey}`);
      return send(request);
    },
  };
}

export function createExecutorAuth(env) {
  switch (env.AI_EXECUTOR_AUTH || 'api-key') {
    case 'api-key': return createApiKeyAuth(env.AI_EXECUTOR_API_KEY);
    case 'service-binding':
      if (env.AI_EXECUTOR_TRANSPORT !== 'service-binding') throw new Error('Service binding authentication requires a service binding transport');
      return { async fetch(request, send) { return send(request); } };
    default: throw new Error('Unsupported AI executor authentication');
  }
}
