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
  assert.throws(() => createExecutorClient({ endpoint }), /authentication adapter/);
  assert.throws(() => executorClient({ AI_EXECUTOR_URL: endpoint }), /API key/);
  assert.throws(() => executorClient({ AI_EXECUTOR_URL: endpoint, AI_EXECUTOR_AUTH: 'unknown', AI_EXECUTOR_API_KEY: 'key' }), /Unsupported/);
  assert.throws(() => executorClient({ AI_EXECUTOR_URL: endpoint, AI_EXECUTOR_AUTH: 'service-binding' }), /requires a service binding/);
  assert.throws(() => executorClient({ AI_EXECUTOR_TRANSPORT: 'unknown', AI_EXECUTOR_API_KEY: 'key' }), /transport/);
});

test('redirect responses fail without forwarding credentials', async () => {
  let sent = 0;
  const client = createExecutorClient({ endpoint, auth: createApiKeyAuth('test-only-key'), fetcher: async (request) => {
    sent++;
    assert.equal(request.url, endpoint);
    assert.equal(request.redirect, 'manual');
    return new Response(null, { status: 307, headers: { Location: 'https://other.example/collect' } });
  } });
  await assert.rejects(client.submit(payload), /redirects are not allowed/);
  assert.equal(sent, 1);
});

test('a replacement authentication adapter owns the request and response exchange', async () => {
  let authorized = 0, observed;
  const auth = {
    async fetch(request, send) {
      assert.equal(request.url, endpoint);
      assert.equal(request.method, 'POST');
      assert.ok(request.signal instanceof AbortSignal);
      request.headers.set('Authorization', 'Custom adapter-token');
      authorized++;
      const response = await send(request);
      observed = response.status;
      return response;
    },
  };
  const client = createExecutorClient({ endpoint, auth, fetcher: async (request) => {
    assert.equal(request.headers.get('authorization'), 'Custom adapter-token');
    assert.deepEqual(await request.json(), payload);
    return new Response(null, { status: 202 });
  } });
  assert.equal((await client.submit(payload)).status, 202);
  assert.equal(authorized, 1);
  assert.equal(observed, 202);
});

test('the executor client returns responses without its own authentication retry policy', async () => {
  for (const status of [202, 400, 401, 429, 503]) {
    let count = 0;
    const client = createExecutorClient({ endpoint, auth: createApiKeyAuth('test-only-key'), fetcher: async () => {
      count++;
      return new Response(null, { status });
    } });
    assert.equal((await client.submit(payload)).status, status);
    assert.equal(count, 1);
  }
});
