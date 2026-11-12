import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExecutorClient, executorClient } from '../worker/ai-executor.js';
import { createApiKeyAuth } from '../worker/ai-executor-auth.js';

const endpoint = 'https://executor.example/api/v1/requests?aud=quiz';
const payload = { requestId: 'same-job-on-every-attempt', operation: 'answers.grade', input: { answer: 'test' } };

test('API key authentication goes only into the finalized HTTPS request headers', async () => {
  const secret = 'test-only-executor-secret';
  const requests = [];
  const client = createExecutorClient({ endpoint, auth: createApiKeyAuth(secret), fetcher: async (request) => {
    requests.push(request);
    assert.equal(request.url, endpoint);
    assert.equal(request.method, 'POST');
    assert.equal(request.headers.get('authorization'), `Bearer ${secret}`);
    assert.equal(request.headers.get('content-type'), 'application/json');
    assert.equal(request.headers.get('dpop'), null);
    assert.equal(request.redirect, 'manual');
    assert.deepEqual(await request.json(), payload);
    return Response.json({ accepted: true }, { status: 202 });
  } });
  assert.equal((await client.submit(payload)).status, 202);
  assert.equal(requests.length, 1);
  assert.equal(JSON.stringify(payload).includes(secret), false);
});

test('missing credentials, unknown auth and unsafe endpoint configuration fail closed', () => {
  for (const key of [undefined, '', ' ', 'line\nbreak', 'leading-space ']) assert.throws(() => createApiKeyAuth(key));
  for (const url of ['', 'http://executor.example/requests', 'https://user:pass@executor.example/requests', 'https://executor.example/requests#fragment']) {
    assert.throws(() => createExecutorClient({ endpoint: url, auth: createApiKeyAuth('key') }));
  }
  assert.throws(() => createExecutorClient({ endpoint }), /authentication provider/);
  assert.throws(() => executorClient({ AI_EXECUTOR_URL: endpoint }), /API key/);
  assert.throws(() => executorClient({ AI_EXECUTOR_URL: endpoint, AI_EXECUTOR_AUTH: 'oauth-dpop', AI_EXECUTOR_API_KEY: 'key' }), /Unsupported/);
  assert.throws(() => executorClient({ AI_EXECUTOR_URL: endpoint, AI_EXECUTOR_AUTH: 'service-binding' }), /requires a service binding/);
  assert.throws(() => executorClient({ AI_EXECUTOR_TRANSPORT: 'unknown', AI_EXECUTOR_API_KEY: 'key' }), /transport/);
});

test('redirect responses fail without forwarding credentials or invoking an auth retry', async () => {
  let sent = 0, observed = 0;
  const client = createExecutorClient({ endpoint, auth: {
    ...createApiKeyAuth('test-only-key'), onResponse: async () => { observed++; return true; },
  }, fetcher: async (request) => {
    sent++;
    assert.equal(request.url, endpoint);
    assert.equal(request.redirect, 'manual');
    return new Response(null, { status: 307, headers: { Location: 'https://other.example/collect' } });
  } });
  await assert.rejects(client.submit(payload), /redirects are not allowed/);
  assert.equal(sent, 1);
  assert.equal(observed, 0);
});

test('a replacement OAuth/DPoP provider sees the final URL/method and regenerates proof after a nonce challenge', async () => {
  let nonce;
  let proofs = 0;
  const contexts = [], requests = [], bodies = [];
  // 実際の OAuth/DPoP 実装ではなく、同じ client に別 provider を接続できることを検証する。
  const auth = {
    async authorize(context) {
      assert.ok(Object.isFrozen(context));
      assert.equal(context.url, endpoint);
      assert.equal(context.method, 'POST');
      assert.ok(context.signal instanceof AbortSignal);
      contexts.push(context);
      return { Authorization: 'DPoP access-token-from-provider', DPoP: `proof-${++proofs}-${nonce || 'initial'}` };
    },
    async onResponse({ response }) {
      nonce = response.headers.get('DPoP-Nonce') || nonce;
      return response.status === 401 && Boolean(nonce);
    },
  };
  const client = createExecutorClient({ endpoint, auth, fetcher: async (request) => {
    requests.push({ authorization: request.headers.get('authorization'), proof: request.headers.get('dpop') });
    bodies.push(await request.text());
    return requests.length === 1 ? new Response('nonce required', { status: 401, headers: { 'DPoP-Nonce': 'nonce-1' } }) : new Response(null, { status: 202 });
  } });
  assert.equal((await client.submit(payload)).status, 202);
  assert.equal(contexts.length, 2);
  assert.deepEqual(requests, [
    { authorization: 'DPoP access-token-from-provider', proof: 'proof-1-initial' },
    { authorization: 'DPoP access-token-from-provider', proof: 'proof-2-nonce-1' },
  ]);
  assert.equal(bodies[0], bodies[1], 'authentication retries keep the requestId and input unchanged');
  assert.deepEqual(JSON.parse(bodies[0]), payload);
});

test('authentication challenges are bounded to one immediate retry', async () => {
  let count = 0;
  const client = createExecutorClient({ endpoint, auth: { authorize: async () => ({ DPoP: `proof-${count}` }), onResponse: async () => true }, fetcher: async () => {
    count++;
    return new Response('still unauthorized', { status: 401 });
  } });
  const response = await client.submit(payload);
  assert.equal(response.status, 401);
  assert.equal(count, 2);
  assert.equal(await response.text(), 'still unauthorized');
});

test('response hooks cannot resend accepted jobs or bypass queue retry policy for other errors', async () => {
  for (const status of [202, 429, 503]) {
    let count = 0, observed = 0;
    const client = createExecutorClient({ endpoint, auth: {
      authorize: async () => ({ Authorization: 'DPoP token' }),
      onResponse: async () => { observed++; return true; },
    }, fetcher: async () => { count++; return new Response(null, { status }); } });
    assert.equal((await client.submit(payload)).status, status);
    assert.equal(count, 1);
    assert.equal(observed, 1, 'a future provider can also retain nonces from successful responses');
  }
});
