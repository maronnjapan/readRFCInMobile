// 共通 AI API の呼び出し認証。利用者の Access 認証・callback 認証とは独立させる。
// 将来の OAuth + DPoP provider も authorize(context) / onResponse(context) を実装する。
export function createApiKeyAuth(apiKey) {
  if (typeof apiKey !== 'string' || !apiKey || apiKey.trim() !== apiKey || /[\r\n]/.test(apiKey)) {
    throw new Error('AI executor API key is not configured');
  }
  return {
    async authorize() { return { Authorization: `Bearer ${apiKey}` }; },
  };
}

export function createExecutorAuth(env) {
  switch (env.AI_EXECUTOR_AUTH || 'api-key') {
    case 'api-key': return createApiKeyAuth(env.AI_EXECUTOR_API_KEY);
    case 'service-binding':
      if (env.AI_EXECUTOR_TRANSPORT !== 'service-binding') throw new Error('Service binding authentication requires a service binding transport');
      return { async authorize() { return {}; } };
    default: throw new Error('Unsupported AI executor authentication');
  }
}
