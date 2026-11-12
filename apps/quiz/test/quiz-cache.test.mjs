import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
const source = await readFile(new URL('../../../sw.js', import.meta.url), 'utf8');
function harness(cacheControl = 'public, max-age=3600') {
  const handlers = {}, writes = [];
  runInNewContext(source, {
    self: { location: { origin: 'https://reader.test' }, addEventListener: (type, handler) => { handlers[type] = handler; } },
    caches: { open: async () => ({ match: async () => null, put: async (request) => { writes.push(request.url); } }) },
    URL, fetch: async () => new Response('content', { headers: { 'Cache-Control': cacheControl } }),
  });
  return { writes, async request(path) {
    let response;
    handlers.fetch({ request: new Request(`https://reader.test${path}`), respondWith: (value) => { response = value; } });
    await response;
    await Promise.resolve();
    return response;
  } };
}
test('the service worker bypasses personalized Hono quiz pages and APIs', async () => {
  const cache = harness();
  for (const path of ['/quiz', '/quiz?attempt=private', '/quiz.html?attempt=private', '/quiz/attempts/id', '/api/attempts/id']) assert.equal(await cache.request(path), undefined);
  assert.deepEqual(cache.writes, []);
  await cache.request('/quiz.css');
  assert.equal(cache.writes.length, 1, 'public CSS still caches');
});
test('private and no-store responses never enter the offline cache even through other paths', async () => {
  for (const control of ['no-store', 'private, no-store', 'max-age=0, private']) {
    const cache = harness(control);
    await cache.request('/other-page');
    await cache.request('/q%75iz?attempt=private');
    await cache.request('/rfcs/rfc7591.txt');
    assert.deepEqual(cache.writes, []);
  }
});
