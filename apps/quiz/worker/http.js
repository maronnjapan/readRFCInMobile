import { HttpError, fail } from './contracts.js';

export const now = () => Math.floor(Date.now() / 1000);
export async function readJson(request) {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) throw new HttpError(415, 'JSON で送信してください。');
  if (Number(request.headers.get('content-length')) > 300000) throw new HttpError(413, '入力が大きすぎます。');
  const reader = request.body?.getReader();
  if (!reader) fail('本文が必要です。');
  const decoder = new TextDecoder();
  let body = '', length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 300000) { await reader.cancel(); throw new HttpError(413, '入力が大きすぎます。'); }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();
  try { return JSON.parse(body); } catch { fail('JSON が正しくありません。'); }
}
