import { Miniflare, convertV4MiniflareOptions, Response as WorkerResponse } from 'miniflare';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync, createSign } from 'node:crypto';

export const fixture = JSON.parse(await readFile(new URL('../questions/spec/rfc-7523.json', import.meta.url), 'utf8'));
export const callbackSecret = 'test-callback-secret-with-at-least-32-characters';
const root = fileURLToPath(new URL('../', import.meta.url));
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'quiz-test-key' };
const issuer = 'https://quiz-test.cloudflareaccess.com';
export function accessToken(subject = 'reader', overrides = {}) {
  const encode = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const data = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode({ iss: issuer, aud: ['quiz-test'], sub: subject, email: `${subject}@example.com`, exp: Math.floor(Date.now() / 1000) + 3600, ...overrides })}`;
  return `${data}.${createSign('RSA-SHA256').update(data).sign(privateKey).toString('base64url')}`;
}

export async function startQuizWorker({ assets = false, port = 0, github = false } = {}) {
  const executions = new Map();
  const githubWrites = [];
  const behavior = { executorStatus: 202, artifact: structuredClone(fixture), earlyCallback: false };
  let mf;
  const options = convertV4MiniflareOptions({
    name: 'quiz-test-worker',
    modules: ['worker/index.js', 'worker/contracts.js', 'worker/auth.js', 'worker/github.js'].map((path) => ({ type: 'ESModule', path: `${root}${path}` })),
    modulesRoot: root, compatibilityDate: '2026-11-01', cf: false, port,
    d1Databases: ['DB'],
    bindings: { APP_ORIGIN: 'https://reader.test', QUESTION_REPOSITORY: 'maronnjapan/readRFCInMobile', CODE_REPOSITORIES: 'example/product',
      ACCESS_ISSUER: issuer, ACCESS_AUD: 'quiz-test', AUTHOR_SUBJECTS: 'author,service:author.access', AUTHOR_EMAILS: 'author@example.com', AI_CALLBACK_SECRET: callbackSecret,
      ...(github ? { GITHUB_APP_ID: '1', GITHUB_INSTALLATION_ID: '2', GITHUB_APP_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }) } : {}) },
    ratelimits: { AI_RATE_LIMITER: { namespace_id: '1001', simple: { limit: 5, period: 60 } } },
    queueProducers: { AI_JOBS: 'spec-quiz-ai' }, queueConsumers: { 'spec-quiz-ai': { maxBatchSize: 1, maxBatchTimeout: 0 } },
    serviceBindings: { AI_EXECUTOR: async (request) => {
      const body = await request.json();
      executions.set(body.requestId, body);
      if (behavior.earlyCallback) await complete(body.requestId);
      return WorkerResponse.json({ accepted: true }, { status: behavior.executorStatus });
    } },
    ...(assets ? { assets: { directory: `${root}dist`, binding: 'ASSETS', run_worker_first: ['/api/*'], routerConfig: { has_user_worker: true }, assetConfig: { html_handling: 'auto-trailing-slash', not_found_handling: 'none' } } } : {}),
    outboundService: async (request) => {
      const url = new URL(request.url);
      if (url.origin === issuer) return WorkerResponse.json({ keys: [jwk] });
      if (url.hostname === 'raw.githubusercontent.com') return WorkerResponse.json(behavior.artifact);
      if (url.origin === 'https://api.github.com') {
        if (request.method !== 'GET') {
          const body = await request.json(); githubWrites.push({ path: url.pathname, method: request.method, body });
          return WorkerResponse.json(url.pathname.endsWith('access_tokens') ? { token: 'test-installation-token' } : { id: 100 + githubWrites.length });
        }
        if (url.pathname.endsWith('/check-runs')) return WorkerResponse.json({ check_runs: [] });
        if (url.pathname.endsWith('/comments')) return WorkerResponse.json([]);
        if (url.pathname.includes('/compare/')) return WorkerResponse.json({ status: 'ahead' });
        return WorkerResponse.json({ private: false });
      }
      throw new Error(`Unexpected external request: ${url.hostname}`);
    },
  });
  mf = new Miniflare(options);
  const db = await mf.getD1Database('DB');
  const migration = await readFile(new URL('../migrations/0001_quizzes.sql', import.meta.url), 'utf8');
  for (const sql of migration.split(';').map((s) => s.trim()).filter(Boolean)) await db.prepare(sql).run();
  const client = (subject = 'reader', overrides = {}) => async (path, { method = 'GET', body, headers = {} } = {}) => mf.dispatchFetch(`https://reader.test${path}`, {
    method, headers: { Origin: 'https://reader.test', 'cf-access-jwt-assertion': accessToken(subject, overrides), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  async function waitForExecution(id) {
    for (let i = 0; i < 100; i++) { if (executions.has(id)) return executions.get(id); await new Promise((r) => setTimeout(r, 30)); }
    throw new Error(`Queue did not dispatch ${id}`);
  }
  async function complete(id, patch = {}) {
    const execution = executions.get(id) || await waitForExecution(id);
    const output = execution.operation === 'questions.generate' ? structuredClone(behavior.artifact)
      : { grades: execution.input.questions.map((q) => ({ questionId: q.id, score: q.points, reason: '保存された採点基準と出典の要件を満たしています。', referenceIds: q.referenceIds })) };
    return mf.dispatchFetch('https://reader.test/api/ai/results', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${execution.callback.token}` },
      body: JSON.stringify({ requestId: id, operation: execution.operation, status: 'completed', output, model: 'claude-test-model', usage: { inputTokens: 100, outputTokens: 50 }, ...patch }) });
  }
  async function publish(artifact = fixture, commit = 'a'.repeat(40)) {
    behavior.artifact = structuredClone(artifact);
    const response = await client('author')('/api/question-sets/import', { method: 'POST', body: { repository: 'maronnjapan/readRFCInMobile', commit, path: artifact.pullRequest ? 'questions/pr/example/product/42.json' : 'questions/spec/rfc-7523.json' } });
    if (!response.ok) throw new Error(`Publish ${response.status}: ${await response.text()}`);
    return response.json();
  }
  return { mf, db, client, publish, executions, complete, waitForExecution, behavior, githubWrites };
}
