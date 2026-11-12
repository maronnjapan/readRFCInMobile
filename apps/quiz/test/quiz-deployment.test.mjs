import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, isAbsolute } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { appRoot, loadConfig, context, prepareDeployment, deploy, destroy, loadDeployment } from '../scripts/deployment.mjs';
import { CloudflareApi } from '../scripts/cloudflare.mjs';
import { DeploymentApi, account } from '../test-support/deployment-fake.mjs';
const base = await loadConfig();

async function fixture(fn) {
  const root = await mkdtemp(join(tmpdir(), 'quiz-deploy-'));
  const api = new DeploymentApi();
  const env = { CLOUDFLARE_API_TOKEN: 'test-token' };
  const config = structuredClone(base);
  const ctx = await context({ config, env, api, root });
  const calls = [];
  const commandOptions = [];
  const run = async (command, args, options) => {
    calls.push([command, ...args]);
    commandOptions.push(options);
    if (args[1] === 'deploy') api.publish(JSON.parse(await readFile(args.at(-1), 'utf8')));
  };
  try { await fn({ root, api, env, config, ctx, calls, commandOptions, run }); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test('deployment creates D1 and both queues, migrates before publishing, and pins generated configuration', async () => fixture(async ({ api, ctx, calls, commandOptions, run }) => {
  const result = await deploy(ctx, run);
  assert.equal(result.url, 'https://spec-understanding-quiz.quiz-test.workers.dev');
  assert.equal(api.databases.size, 1); assert.equal(api.queues.size, 2); assert.equal(api.workers.size, 1);
  assert.ok(result.state.resources.every((resource) => resource.created));
  assert.equal(calls[0][0], 'npm');
  assert.ok(calls[1].includes('migrations')); assert.ok(calls[1].includes('--remote'));
  assert.equal(calls[2][2], 'deploy');
  const generated = JSON.parse(await readFile(result.configPath, 'utf8'));
  assert.equal(generated.account_id, account);
  assert.equal(generated.keep_vars, true);
  assert.ok(isAbsolute(generated.main)); assert.ok(isAbsolute(generated.assets.directory)); assert.ok(isAbsolute(generated.d1_databases[0].migrations_dir));
  assert.equal(resolve(dirname(result.configPath), generated.tsconfig), join(ctx.root, 'tsconfig.json'));
  assert.equal(commandOptions[1].cwd, dirname(result.configPath));
  assert.equal(commandOptions[2].cwd, dirname(result.configPath));
  assert.equal(generated.d1_databases[0].database_id, result.state.databaseId);
  assert.equal(generated.vars.APP_ORIGIN, result.url);
  assert.ok(!JSON.stringify(generated).includes('test-token'));
  assert.equal(api.workers.get(ctx.name).secrets.get('AI_CALLBACK_SECRET').length, 64);
}));

test('Wrangler builds Hono JSX and migrates local D1 using the generated configuration outside the app directory', async () => fixture(async ({ root, api, env, config }) => {
  const assets = join(root, 'assets');
  await mkdir(assets); await writeFile(join(assets, 'index.html'), '<!doctype html><title>Test</title>');
  config.assets.directory = assets;
  const ctx = await context({ config, env, api, root: appRoot, statePath: join(root, 'state/deployment.json') });
  const { configPath } = await prepareDeployment(ctx);
  const require = createRequire(import.meta.url);
  const wrangler = join(dirname(require.resolve('wrangler/package.json')), 'bin/wrangler.js');
  const { stdout } = await promisify(execFile)(process.execPath, [wrangler, 'deploy', '--dry-run', '--config', configPath], {
    cwd: dirname(configPath), env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, timeout: 60000,
  });
  assert.match(stdout, /--dry-run: exiting now/);
  assert.match(stdout, /AI_JOBS/);
  const migration = await promisify(execFile)(process.execPath, [wrangler, 'd1', 'migrations', 'apply', 'DB', '--local', '--config', configPath], {
    cwd: dirname(configPath), env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, timeout: 60000,
  });
  assert.match(migration.stdout, /0001_quizzes\.sql/);
  assert.match(migration.stdout, /0003_instant_answers\.sql/);
}));

test('redeployment recovers ownership from D1 on a fresh runner, preserves settings and reuses resources', async () => fixture(async ({ root, api, env, config, ctx, run }) => {
  const first = await deploy(ctx, run);
  const callback = api.workers.get(ctx.name).secrets.get('AI_CALLBACK_SECRET');
  api.workers.get(ctx.name).bindings.push({ type: 'plain_text', name: 'ACCESS_ISSUER', text: 'https://team.cloudflareaccess.com' });
  const fresh = await context({ config, env, api, root: join(root, 'fresh') });
  const second = await deploy(fresh, run);
  assert.equal(api.databases.size, 1); assert.equal(api.queues.size, 2);
  assert.equal(second.state.id, first.state.id);
  assert.ok(second.state.resources.every((resource) => resource.created));
  assert.equal(JSON.parse(await readFile(second.configPath, 'utf8')).vars.ACCESS_ISSUER, 'https://team.cloudflareaccess.com');
  assert.equal(api.workers.get(ctx.name).secrets.get('AI_CALLBACK_SECRET'), callback);
}));

test('destroy defaults to a read-only plan and deletes consumers, Worker, queues and finally managed D1', async () => fixture(async ({ root, api, env, config, ctx, run }) => {
  await deploy(ctx, run);
  const fresh = await context({ config, env, api, root: join(root, 'cleanup') });
  const start = api.calls.length;
  const plan = await destroy(fresh);
  assert.equal(plan.destroyed, false); assert.equal(plan.plan.filter((item) => item.kind === 'queue').length, 2);
  assert.equal(api.calls.slice(start).filter((call) => call.method === 'DELETE').length, 0);
  await assert.rejects(destroy(fresh, { confirm: 'other-worker' }), /--confirm/);
  const result = await destroy(fresh, { confirm: ctx.name });
  assert.equal(result.destroyed, true);
  assert.equal(api.databases.size, 0); assert.equal(api.queues.size, 0); assert.equal(api.workers.size, 0);
  const deleted = api.calls.filter((call) => call.method === 'DELETE');
  assert.ok(deleted[0].path.includes('/consumers/'));
  assert.ok(deleted.at(-1).path.includes('/d1/database/'));
  assert.equal((await destroy(fresh, { confirm: ctx.name })).plan.length, 0);
  await deploy(fresh, run);
  assert.equal(api.databases.size, 1, 'deploy works after destroy');
}));

test('reused D1 and queues are retained with their application data when a new Worker is destroyed', async () => fixture(async ({ api, ctx, run }) => {
  const db = api.addDatabase(base.d1_databases[0].database_name);
  for (const entry of base.queues.consumers) api.addQueue(entry.queue);
  const result = await deploy(ctx, run);
  assert.ok(result.state.resources.every((resource) => !resource.created));
  await destroy(ctx, { confirm: ctx.name });
  assert.equal(api.workers.size, 0); assert.equal(api.databases.size, 1); assert.equal(api.queues.size, 2);
  assert.deepEqual(api.databases.get(db.uuid).applicationRows, ['keep existing answers']);
  assert.equal(api.databases.get(db.uuid).table, false, 'only the deployment metadata is removed');
}));

test('an existing Worker and its existing bindings and consumers are retained', async () => fixture(async ({ api, config, ctx, run }) => {
  const db = api.addDatabase(base.d1_databases[0].database_name);
  for (const entry of base.queues.consumers) api.addQueue(entry.queue);
  const existing = structuredClone(config);
  existing.d1_databases[0].database_id = db.uuid;
  api.publish(existing);
  const result = await deploy(ctx, run);
  assert.equal(result.state.workerCreated, false);
  assert.deepEqual((await destroy(ctx)).plan, []);
  await destroy(ctx, { confirm: ctx.name });
  assert.equal(api.workers.size, 1); assert.equal(api.databases.size, 1); assert.equal(api.queues.size, 2);
  assert.ok([...api.queues.values()].every((queue) => queue.consumers.length === 1));
}));

test('new resources bound to a reused Worker must be detached before removal', async () => fixture(async ({ api, ctx, run }) => {
  api.workers.set(ctx.name, { bindings: [], secrets: new Map() });
  await deploy(ctx, run);
  await assert.rejects(destroy(ctx, { confirm: ctx.name }), /bindingを切り離して/);
  assert.equal(api.calls.filter((call) => call.method === 'DELETE').length, 0);
}));

test('partial deployment failures remain recoverable and destructible using D1 state', async () => fixture(async ({ root, api, env, config, ctx, calls }) => {
  await assert.rejects(deploy(ctx, async (command, args) => { calls.push([command, ...args]); if (args[1] === 'deploy') throw new Error('Upload failed'); }), /Upload failed/);
  const fresh = await context({ config, env, api, root: join(root, 'recovery') });
  const state = await loadDeployment(fresh);
  assert.ok(state.resources.every((resource) => resource.created));
  await destroy(fresh, { confirm: ctx.name });
  assert.equal(api.databases.size, 0); assert.equal(api.queues.size, 0); assert.equal(api.workers.size, 0);
}));

test('local recovery state can remove a D1 when even the first metadata write failed', async () => fixture(async ({ api, ctx, run }) => {
  const query = api.query.bind(api);
  api.query = async (...args) => {
    if (args[2].startsWith('CREATE TABLE')) throw new Error('Metadata temporarily unavailable');
    return query(...args);
  };
  await assert.rejects(deploy(ctx, run), /Metadata temporarily unavailable/);
  api.query = query;
  assert.equal(api.databases.size, 1);
  await destroy(ctx, { confirm: ctx.name });
  assert.equal(api.databases.size, 0);
}));

test('redeployment retains queue ownership when a D1 state update failed after queue creation', async () => fixture(async ({ api, ctx, run }) => {
  const query = api.query.bind(api);
  api.query = async (...args) => {
    if (args[2].startsWith('INSERT') && api.queues.size === 1) throw new Error('Metadata write failed');
    return query(...args);
  };
  await assert.rejects(deploy(ctx, run), /Metadata write failed/);
  api.query = query;
  const result = await deploy(ctx, run);
  assert.ok(result.state.resources.every((resource) => resource.created));
  await destroy(ctx, { confirm: ctx.name });
  assert.equal(api.queues.size, 0);
}));

test('destroy preserves a D1 shared by another deployment', async () => fixture(async ({ api, ctx, run }) => {
  const { state } = await deploy(ctx, run);
  api.databases.get(state.databaseId).state.set('other-quiz', '{}');
  await assert.rejects(destroy(ctx, { confirm: ctx.name }), /別のデプロイ/);
  assert.equal(api.calls.filter((call) => call.method === 'DELETE').length, 0);
}));

test('destroy refuses changed ownership and queues used by another worker before deleting anything', async () => fixture(async ({ api, ctx, run }) => {
  await deploy(ctx, run);
  const mark = api.workers.get(ctx.name).bindings.find((binding) => binding.name === 'QUIZ_DEPLOYMENT_ID');
  const saved = mark.text; mark.text = 'changed-owner';
  await assert.rejects(destroy(ctx, { confirm: ctx.name }), /別のデプロイ/);
  mark.text = saved;
  [...api.queues.values()][0].consumers.push({ consumer_id: 'f'.repeat(32), script_name: 'other-worker' });
  await assert.rejects(destroy(ctx, { confirm: ctx.name }), /別のconsumer/);
  assert.equal(api.calls.filter((call) => call.method === 'DELETE').length, 0);
}));

test('the account must be unambiguous and local state cannot select a different target', async () => fixture(async ({ root, api, env, config, ctx, run }) => {
  api.accounts.push({ id: 'b'.repeat(32) });
  await assert.rejects(context({ config, env, api, root: join(root, 'no-account') }), /CLOUDFLARE_ACCOUNT_ID/);
  await deploy(ctx, run);
  await assert.rejects(context({ config, env: { ...env, CLOUDFLARE_ACCOUNT_ID: 'b'.repeat(32) }, api, root }), /アカウント/);
}));

test('the Cloudflare client keeps credentials in headers and does not treat authorization failure as missing', async () => {
  const requests = [];
  const client = new CloudflareApi('private-token', async (url, options) => {
    requests.push({ url, options });
    return Response.json({ success: false, errors: [{ code: 10000 }] }, { status: 403 });
  });
  await assert.rejects(client.request('/accounts', { missing: true }), (error) => error.message.includes('403') && !error.message.includes('private-token'));
  assert.equal(requests[0].options.headers.Authorization, 'Bearer private-token');
  assert.equal(requests[0].options.redirect, 'error');
  assert.throws(() => new CloudflareApi(''), /CLOUDFLARE_API_TOKEN/);
});
