import { Miniflare, convertV4MiniflareOptions, Response as WorkerResponse } from 'miniflare';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { build } from 'esbuild';
import { questionFilePath } from '../shared/question-paths.js';

export const fixture = JSON.parse(await readFile(new URL('../questions/spec/rfc-7523.json', import.meta.url), 'utf8'));
export const patternsFixture = JSON.parse(await readFile(new URL('../questions/spec/rfc-7591.json', import.meta.url), 'utf8'));
export const callbackSecret = 'test-callback-secret-with-at-least-32-characters';
export const executorApiKey = 'test-only-ai-executor-api-key';
export function multipleChoiceFixture({ written = true } = {}) {
  const value = structuredClone(fixture);
  const question = { id: 'server-audience', type: 'choice', prompt: 'JWT の aud に含める必要がある受信者は？',
    options: ['任意の端末', '検証する認可サーバー自身', '仕様書の著者', '無関係なサーバー'], points: 1, referenceIds: ['jwt-claims'] };
  value.questions = [value.questions[0], question, ...(written ? [value.questions[1]] : [])];
  value.solutions[question.id] = { answer: 1, explanation: '認可サーバー自身が意図された受信者であることを確認します。' };
  if (!written) delete value.solutions['audience-validation'];
  return value;
}
const root = fileURLToPath(new URL('../', import.meta.url));
const workerBundle = build({ entryPoints: [`${root}worker/index.js`], bundle: true, format: 'esm', target: 'es2022', jsx: 'automatic', jsxImportSource: 'hono/jsx', write: false });
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'quiz-test-key' };
const issuer = 'https://quiz-test.cloudflareaccess.com';
export function accessToken(subject = 'reader', overrides = {}) {
  const encode = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const data = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode({ iss: issuer, aud: ['quiz-test'], sub: subject, email: `${subject}@example.com`, exp: Math.floor(Date.now() / 1000) + 3600, ...overrides })}`;
  return `${data}.${createSign('RSA-SHA256').update(data).sign(privateKey).toString('base64url')}`;
}

export async function startQuizWorker({ assets = false, port = 0, github = false, access = true, executorTransport = 'https', executorAuth = 'api-key' } = {}) {
  const executions = new Map();
  const executorRequests = [];
  const githubWrites = [];
  const questionFiles = new Map();
  const behavior = { executorStatus: 202, artifact: structuredClone(fixture), earlyCallback: false };
  let mf;
  async function execute(request) {
    const authorization = request.headers.get('authorization');
    executorRequests.push({ url: request.url, method: request.method, authorization, redirect: request.redirect });
    if (executorAuth === 'api-key' && authorization !== `Bearer ${executorApiKey}`) return WorkerResponse.json({ error: 'unauthorized' }, { status: 401 });
    const body = await request.json();
    executions.set(body.requestId, body);
    if (behavior.earlyCallback) await complete(body.requestId);
    return WorkerResponse.json({ accepted: true }, { status: behavior.executorStatus });
  }
  const options = convertV4MiniflareOptions({
    name: 'quiz-test-worker',
    modules: [{ type: 'ESModule', path: `${root}worker/index.js`, contents: (await workerBundle).outputFiles[0].text }],
    modulesRoot: root, compatibilityDate: '2026-11-01', cf: false, port,
    d1Databases: ['DB'],
    bindings: { APP_ORIGIN: 'https://reader.test', QUESTION_REPOSITORY: 'maronnjapan/readRFCInMobile', CODE_REPOSITORIES: 'example/product',
      ACCESS_ISSUER: access ? issuer : '', ACCESS_AUD: access ? 'quiz-test' : '', AUTHOR_SUBJECTS: 'author,service:author.access', AUTHOR_EMAILS: 'author@example.com', AI_CALLBACK_SECRET: callbackSecret,
      AI_EXECUTOR_TRANSPORT: executorTransport, AI_EXECUTOR_AUTH: executorAuth, AI_EXECUTOR_API_KEY: executorApiKey, AI_EXECUTOR_URL: 'https://ai-executor.test/v1/requests',
      ...(github ? { GITHUB_APP_ID: '1', GITHUB_INSTALLATION_ID: '2', GITHUB_APP_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }) } : {}) },
    ratelimits: { AI_RATE_LIMITER: { namespace_id: '1001', simple: { limit: 5, period: 60 } } },
    queueProducers: { AI_JOBS: 'spec-quiz-ai' }, queueConsumers: { 'spec-quiz-ai': { maxBatchSize: 1, maxBatchTimeout: 0 } },
    serviceBindings: { ...(executorTransport === 'service-binding' ? { AI_EXECUTOR: execute } : {}), ...(!assets ? { ASSETS: async () => new WorkerResponse('static content') } : {}) },
    ...(assets ? { assets: { directory: `${root}dist`, binding: 'ASSETS', run_worker_first: true, routerConfig: { has_user_worker: true }, assetConfig: { html_handling: 'auto-trailing-slash', not_found_handling: 'none' } } } : {}),
    outboundService: async (request) => {
      const url = new URL(request.url);
      if (url.origin === 'https://ai-executor.test') return execute(request);
      if (url.origin === issuer) return WorkerResponse.json({ keys: [jwk] });
      if (url.hostname === 'raw.githubusercontent.com') {
        if (!questionFiles.has(url.pathname)) questionFiles.set(url.pathname, structuredClone(behavior.artifact));
        return WorkerResponse.json(questionFiles.get(url.pathname));
      }
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
  for (const name of (await readdir(new URL('../migrations/', import.meta.url))).filter((p) => p.endsWith('.sql')).sort()) {
    const migration = await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
    for (const sql of migration.split(';').map((s) => s.trim()).filter(Boolean)) await db.prepare(sql).run();
  }
  const client = (subject = 'reader', overrides = {}) => async (path, { method = 'GET', body, headers = {} } = {}) => mf.dispatchFetch(`https://reader.test${path}`, {
    method, headers: { Origin: 'https://reader.test', 'cf-access-jwt-assertion': accessToken(subject, overrides), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const anonymousClient = () => {
    let cookie = '';
    const call = async (path, { method = 'GET', body, headers = {}, form, subject } = {}) => {
      const response = await mf.dispatchFetch(`https://reader.test${path}`, {
        method, redirect: 'manual', headers: { Origin: 'https://reader.test', Cookie: cookie,
          ...(subject ? { 'cf-access-jwt-assertion': accessToken(subject) } : {}),
          ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
        ...(form ? { body: new URLSearchParams(form).toString() } : body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      return response;
    };
    return call;
  };
  async function waitForExecution(id) {
    for (let i = 0; i < 100; i++) { if (executions.has(id)) return executions.get(id); await new Promise((r) => setTimeout(r, 30)); }
    throw new Error(`Queue did not dispatch ${id}`);
  }
  async function complete(id, patch = {}) {
    const execution = executions.get(id) || await waitForExecution(id);
    const output = execution.operation === 'questions.generate' ? structuredClone(behavior.artifact)
      : { grades: promptData(execution).questions.map((q) => ({ questionId: q.id, score: q.points, reason: '保存された採点基準と出典の要件を満たしています。', referenceIds: q.referenceIds })) };
    return mf.dispatchFetch('https://reader.test/api/ai/results', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${execution.callback.token}` },
      body: JSON.stringify({ requestId: id, operation: execution.operation, status: 'completed', output, model: 'claude-test-model', usage: { inputTokens: 100, outputTokens: 50 }, ...patch }) });
  }
  async function publish(artifact = fixture, commit = 'a'.repeat(40)) {
    behavior.artifact = structuredClone(artifact);
    const response = await client('author')('/api/question-sets/import', { method: 'POST', body: { repository: 'maronnjapan/readRFCInMobile', commit, path: questionFilePath(artifact) } });
    if (!response.ok) throw new Error(`Publish ${response.status}: ${await response.text()}`);
    return response.json();
  }
  return { mf, db, client, anonymousClient, publish, executions, executorRequests, complete, waitForExecution, behavior, githubWrites, questionFiles };
}

export async function submitAttemptAnswers(call, id, answers) {
  const state = await (await call(`/api/attempts/${id}`)).json();
  let response;
  for (const q of state.set.questions.filter((q) => q.type !== 'written')) {
    response = await call(`/api/attempts/${id}/instant-answers`, { method: 'POST', body: { questionId: q.id, answer: answers[q.id] } });
    if (!response.ok) return response;
  }
  const written = state.set.questions.filter((q) => q.type === 'written');
  return written.length ? call(`/api/attempts/${id}/answers`, { method: 'POST', body: { answers: Object.fromEntries(written.map((q) => [q.id, answers[q.id]])) } }) : response;
}

export function promptData(execution) {
  return JSON.parse(execution.input.messages[0].content).data;
}
