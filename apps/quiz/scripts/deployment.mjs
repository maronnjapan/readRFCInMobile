import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import { CloudflareApi } from './cloudflare.mjs';

export const appRoot = fileURLToPath(new URL('../', import.meta.url));
const project = '@rfc-reader/quiz';
const marker = 'QUIZ_DEPLOYMENT_ID';
const table = '_quiz_deployment_state';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const id = /^[a-f0-9]{32}$/i;
const workerName = /^[a-z0-9][a-z0-9-]{0,62}$/;
const runtimeKeys = ['APP_ORIGIN', 'AI_EXECUTOR_URL', 'AI_EXECUTOR_TRANSPORT', 'AI_EXECUTOR_AUTH', 'ACCESS_ISSUER', 'ACCESS_AUD', 'AUTHOR_SUBJECTS', 'AUTHOR_EMAILS', 'QUESTION_REPOSITORY', 'QUESTION_DEFAULT_BRANCH', 'AUTHORING_PROFILE', 'GRADING_PROFILE'];
const secretKeys = { AI_EXECUTOR_API_KEY: 'AI_EXECUTOR_API_KEY', AI_CALLBACK_SECRET: 'AI_CALLBACK_SECRET', QUIZ_GITHUB_APP_ID: 'GITHUB_APP_ID', QUIZ_GITHUB_INSTALLATION_ID: 'GITHUB_INSTALLATION_ID', QUIZ_GITHUB_APP_PRIVATE_KEY: 'GITHUB_APP_PRIVATE_KEY' };

export async function loadConfig() {
  const { experimental_readRawConfig } = await import('wrangler');
  return experimental_readRawConfig({ config: join(appRoot, 'wrangler.jsonc') }).rawConfig;
}
export function validateState(state, account, name) {
  if (state?.version !== 1 || state.project !== project || state.accountId !== account || state.workerName !== name || !uuid.test(state.id)
      || typeof state.workerCreated !== 'boolean' || !uuid.test(state.databaseId) || !Array.isArray(state.resources)
      || state.resources.some((resource) => !['d1', 'queue'].includes(resource.kind) || !(resource.kind === 'd1' ? uuid : id).test(resource.id)
        || typeof resource.name !== 'string' || typeof resource.created !== 'boolean')) throw new Error('デプロイ状態のアカウント・Worker・リソースを確認してください。');
  return state;
}
function resource(state, kind, value, created) {
  const key = kind === 'd1' ? value.uuid : value.queue_id;
  const previous = state.resources.find((item) => item.kind === kind && item.id === key);
  if (previous) previous.created ||= created;
  else state.resources.push({ kind, id: key, name: kind === 'd1' ? value.name : value.queue_name, created });
}
async function localState(path) {
  try {
    const value = JSON.parse(await readFile(path, 'utf8'));
    return value.destroyed ? null : value;
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function hasStateTable(ctx, database) {
  const exists = await ctx.api.query(ctx.account, database, `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, [table]);
  return exists.length > 0;
}
async function readState(ctx, database) {
  if (!await hasStateTable(ctx, database)) return null;
  const rows = await ctx.api.query(ctx.account, database, `SELECT state_json FROM ${table} WHERE worker_name = ?`, [ctx.name]);
  return rows.length ? validateState(JSON.parse(rows[0].state_json), ctx.account, ctx.name) : null;
}
async function saveState(ctx, state) {
  validateState(state, ctx.account, ctx.name);
  await mkdir(dirname(ctx.statePath), { recursive: true });
  await writeFile(ctx.statePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await ctx.api.query(ctx.account, state.databaseId, `CREATE TABLE IF NOT EXISTS ${table} (worker_name TEXT PRIMARY KEY, state_json TEXT NOT NULL)`);
  await ctx.api.query(ctx.account, state.databaseId, `INSERT OR REPLACE INTO ${table} (worker_name, state_json) VALUES (?, ?)`, [ctx.name, JSON.stringify(state)]);
}
export async function context({ config, env = process.env, api = new CloudflareApi(env.CLOUDFLARE_API_TOKEN), root = appRoot, statePath } = {}) {
  config ||= await loadConfig();
  const name = env.QUIZ_WORKER_NAME || config.name;
  if (!workerName.test(name)) throw new Error('QUIZ_WORKER_NAME を英小文字・数字・ハイフンの63文字以内で指定してください。');
  statePath ||= join(root, '.wrangler/quiz-deploy', `${name}.state.json`);
  const saved = await localState(statePath);
  let account = env.CLOUDFLARE_ACCOUNT_ID || config.account_id || saved?.accountId;
  if (!account) {
    const accounts = await api.list('/accounts', 50);
    if (accounts.length !== 1) throw new Error('CLOUDFLARE_ACCOUNT_ID を設定し、デプロイ先を指定してください。');
    account = accounts[0].id;
  }
  if (!id.test(account)) throw new Error('CLOUDFLARE_ACCOUNT_ID が正しくありません。');
  if (saved) validateState(saved, account, name);
  return { config, env, api, root, name, account, prefix: `/accounts/${account}`, statePath };
}
async function findDatabase(ctx) {
  const binding = ctx.config.d1_databases?.find((database) => database.binding === 'DB');
  if (!binding) throw new Error('DBのD1 bindingが必要です。');
  const fixed = binding.database_id;
  if (fixed && fixed !== '00000000-0000-0000-0000-000000000000') {
    if (!uuid.test(fixed)) throw new Error('D1 database_idが正しくありません。');
    return { binding, database: await ctx.api.request(`${ctx.prefix}/d1/database/${fixed}`) };
  }
  const databases = await ctx.api.list(`${ctx.prefix}/d1/database`);
  return { binding, database: databases.find((database) => database.name === binding.database_name) };
}
function sameDeployment(a, b) {
  if (a && b && a.id !== b.id) throw new Error('ローカルとD1のデプロイ状態が一致しません。--stateで正しい状態ファイルを指定してください。');
  if (!a || !b) return a || b;
  // D1への記録が一部失敗していても、ローカルに残った作成記録を失わない。
  for (const item of b.resources) {
    const previous = a.resources.find((resource) => resource.kind === item.kind && resource.id === item.id);
    if (previous) previous.created ||= item.created;
    else a.resources.push(item);
  }
  a.workerCreated ||= b.workerCreated;
  return a;
}
async function workerSettings(ctx) {
  return ctx.api.request(`${ctx.prefix}/workers/scripts/${ctx.name}/settings`, { missing: true });
}
function textBindings(settings) {
  return Object.fromEntries((settings?.bindings || []).filter((binding) => binding.type === 'plain_text').map((binding) => [binding.name, binding.text]));
}
function origin(value) {
  if (!value || value.includes('.example.com')) return null;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password) throw new Error('APP_ORIGINはパスのないHTTPSオリジンで指定してください。');
  return value;
}
async function appOrigin(ctx, existing) {
  const supplied = origin(ctx.env.APP_ORIGIN) || origin(existing.APP_ORIGIN) || origin(ctx.config.vars?.APP_ORIGIN);
  if (supplied) return supplied;
  const subdomain = await ctx.api.request(`${ctx.prefix}/workers/subdomain`, { missing: true });
  if (!subdomain?.subdomain) throw new Error('Cloudflareでworkers.devのサブドメインを設定するか、APP_ORIGINを指定してください。');
  return `https://${ctx.name}.${subdomain.subdomain}.workers.dev`;
}
async function claimWorker(ctx, state) {
  const form = new FormData();
  form.set('metadata', new Blob([JSON.stringify({ main_module: 'bootstrap.js', compatibility_date: ctx.config.compatibility_date, bindings: [{ type: 'plain_text', name: marker, text: state.id }] })], { type: 'application/json' }));
  form.set('bootstrap.js', new Blob(['export default { fetch() { return new Response("Deployment in progress", {status:503}); } };'], { type: 'application/javascript+module' }), 'bootstrap.js');
  await ctx.api.request(`${ctx.prefix}/workers/scripts/${ctx.name}`, { method: 'PUT', body: form });
}
export async function prepareDeployment(ctx) {
  const settings = await workerSettings(ctx);
  const existing = textBindings(settings);
  const url = await appOrigin(ctx, existing);
  const found = await findDatabase(ctx);
  let database = found.database;
  const saved = await localState(ctx.statePath);
  if (saved) validateState(saved, ctx.account, ctx.name);
  const remote = database ? await readState(ctx, database.uuid) : null;
  let state = sameDeployment(remote, saved);
  if (existing[marker] && state?.id !== existing[marker]) throw new Error('Workerの所有情報とデプロイ状態が一致しません。');
  if (state && database?.uuid !== state.databaseId) throw new Error('D1とデプロイ状態が一致しません。');
  const created = !database;
  if (!database) database = await ctx.api.request(`${ctx.prefix}/d1/database`, { method: 'POST', body: { name: found.binding.database_name } });
  state ||= { version: 1, project, id: randomUUID(), accountId: ctx.account, workerName: ctx.name, workerCreated: !settings, databaseId: database.uuid, resources: [] };
  if (!settings) state.workerCreated = true;
  resource(state, 'd1', database, created);
  await saveState(ctx, state);
  if (!settings) await claimWorker(ctx, state);
  const names = [...new Set([...(ctx.config.queues?.producers || []).map((queue) => queue.queue), ...(ctx.config.queues?.consumers || []).flatMap((queue) => [queue.queue, queue.dead_letter_queue])].filter(Boolean))];
  const queues = await ctx.api.list(`${ctx.prefix}/queues`);
  for (const name of names) {
    let queue = queues.find((item) => item.queue_name === name);
    const created = !queue;
    if (!queue) queue = await ctx.api.request(`${ctx.prefix}/queues`, { method: 'POST', body: { queue_name: name } });
    resource(state, 'queue', queue, created);
    await saveState(ctx, state);
  }
  const config = structuredClone(ctx.config);
  const configPath = join(dirname(ctx.statePath), `${ctx.name}.wrangler.json`);
  delete config.$schema;
  config.name = ctx.name;
  config.account_id = ctx.account;
  config.keep_vars = true;
  config.main = resolve(ctx.root, config.main);
  if (config.tsconfig) config.tsconfig = relative(dirname(configPath), resolve(ctx.root, config.tsconfig));
  config.assets.directory = resolve(ctx.root, config.assets.directory);
  config.d1_databases = config.d1_databases.map((binding) => ({ ...binding, ...(binding.binding === 'DB' ? { database_id: database.uuid } : {}), migrations_dir: resolve(ctx.root, binding.migrations_dir || 'migrations') }));
  config.vars = Object.fromEntries(runtimeKeys.map((key) => [key, ctx.env[key] || existing[key] || config.vars?.[key]]).filter(([, value]) => value !== undefined && value !== ''));
  config.vars.APP_ORIGIN = url;
  config.vars[marker] = state.id;
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return { state, configPath, url };
}
async function setSecrets(ctx) {
  const secrets = await ctx.api.request(`${ctx.prefix}/workers/scripts/${ctx.name}/secrets`);
  const values = Object.fromEntries(Object.entries(secretKeys).filter(([key]) => ctx.env[key]).map(([key, target]) => [target, ctx.env[key]]));
  if (!values.AI_CALLBACK_SECRET && !secrets.some((secret) => secret.name === 'AI_CALLBACK_SECRET')) values.AI_CALLBACK_SECRET = randomBytes(32).toString('hex');
  for (const [name, text] of Object.entries(values)) {
    if (name === 'AI_CALLBACK_SECRET' && text.length < 32) throw new Error('AI_CALLBACK_SECRETは32文字以上で設定してください。');
    await ctx.api.request(`${ctx.prefix}/workers/scripts/${ctx.name}/secrets`, { method: 'PUT', body: { name, text, type: 'secret_text' } });
  }
}
export async function runCommand(command, args, { cwd = appRoot, env = process.env } = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}
export async function deploy(ctx, run = runCommand) {
  if (ctx.env.AI_CALLBACK_SECRET && ctx.env.AI_CALLBACK_SECRET.length < 32) throw new Error('AI_CALLBACK_SECRETは32文字以上で設定してください。');
  await run('npm', ['run', 'build'], { cwd: ctx.root, env: ctx.env });
  const prepared = await prepareDeployment(ctx);
  const require = createRequire(import.meta.url);
  const wrangler = join(dirname(require.resolve('wrangler/package.json')), 'bin/wrangler.js');
  const env = { ...ctx.env, CLOUDFLARE_ACCOUNT_ID: ctx.account, WRANGLER_SEND_METRICS: 'false' };
  // Wranglerはtsconfigを実行ディレクトリ基準へ正規化するため、生成設定の場所で実行する。
  const cwd = dirname(prepared.configPath);
  await run(process.execPath, [wrangler, 'd1', 'migrations', 'apply', 'DB', '--remote', '--config', prepared.configPath], { cwd, env });
  await run(process.execPath, [wrangler, 'deploy', '--config', prepared.configPath], { cwd, env });
  await setSecrets(ctx);
  return prepared;
}
export async function loadDeployment(ctx) {
  const saved = await localState(ctx.statePath);
  if (saved) return validateState(saved, ctx.account, ctx.name);
  const { database } = await findDatabase(ctx);
  return database ? readState(ctx, database.uuid) : null;
}
export async function destroy(ctx, { confirm } = {}) {
  const state = await loadDeployment(ctx);
  if (!state) return { destroyed: false, plan: [], message: '記録されたデプロイはありません。状態ファイルがある場合は--stateで指定してください。' };
  const settings = await workerSettings(ctx);
  const owned = state.resources.filter((resource) => resource.created);
  if (owned.some((resource) => resource.kind === 'd1' && resource.id === state.databaseId)) {
    const database = await ctx.api.request(`${ctx.prefix}/d1/database/${state.databaseId}`, { missing: true });
    if (database && await hasStateTable(ctx, state.databaseId)) {
      const other = await ctx.api.query(ctx.account, state.databaseId, `SELECT worker_name FROM ${table} WHERE worker_name <> ?`, [ctx.name]);
      if (other.length) throw new Error('D1は別のデプロイにも使用されています。削除しません。');
    }
  }
  if (settings && state.workerCreated && textBindings(settings)[marker] !== state.id) throw new Error('Workerが別のデプロイへ変更されています。削除しません。');
  if (settings && !state.workerCreated && (settings.bindings || []).some((binding) => owned.some((resource) => resource.id === binding.id || resource.name === binding.queue_name))) throw new Error('既存Workerが作成済みリソースを使用しています。bindingを切り離してから削除してください。');
  const consumers = [];
  for (const resource of state.resources) {
    const path = `${ctx.prefix}/${resource.kind === 'd1' ? 'd1/database' : 'queues'}/${resource.id}`;
    const current = await ctx.api.request(path, { missing: true });
    if (!current) continue;
    if ((resource.kind === 'd1' ? current.name : current.queue_name) !== resource.name) throw new Error('リソース名と保存したIDが一致しません。');
    if (resource.kind !== 'queue') continue;
    const attached = await ctx.api.list(`${path}/consumers`);
    const ours = attached.filter((consumer) => consumer.script_name === ctx.name && (!consumer.environment_name || consumer.environment_name === 'production'));
    if (resource.created && attached.length !== ours.length) throw new Error(`Queue ${resource.name} は別のconsumerにも使用されています。`);
    if (state.workerCreated) consumers.push(...ours.map((consumer) => ({ queue: resource.id, id: consumer.consumer_id })));
  }
  const plan = [...(state.workerCreated ? [{ kind: 'worker', name: ctx.name }] : []), ...consumers.map((consumer) => ({ kind: 'consumer', name: consumer.id })), ...owned.filter((resource) => resource.kind === 'queue'), ...owned.filter((resource) => resource.kind === 'd1')];
  if (!confirm) return { destroyed: false, plan };
  if (confirm !== ctx.name) throw new Error(`削除の実行には --confirm ${ctx.name} を指定してください。`);
  for (const consumer of consumers) await ctx.api.request(`${ctx.prefix}/queues/${consumer.queue}/consumers/${consumer.id}`, { method: 'DELETE', missing: true });
  if (state.workerCreated && settings) await ctx.api.request(`${ctx.prefix}/workers/scripts/${ctx.name}`, { method: 'DELETE', missing: true });
  for (const resource of owned.filter((resource) => resource.kind === 'queue')) await ctx.api.request(`${ctx.prefix}/queues/${resource.id}`, { method: 'DELETE', missing: true });
  // 状態を保持するD1は最後に削除する。途中失敗後も同じ記録から再実行できる。
  if (owned.some((resource) => resource.kind === 'd1' && resource.id === state.databaseId)) {
    for (const resource of owned.filter((resource) => resource.kind === 'd1')) await ctx.api.request(`${ctx.prefix}/d1/database/${resource.id}`, { method: 'DELETE', missing: true });
  } else {
    const database = await ctx.api.request(`${ctx.prefix}/d1/database/${state.databaseId}`, { missing: true });
    if (database && await hasStateTable(ctx, state.databaseId)) {
      await ctx.api.query(ctx.account, state.databaseId, `DELETE FROM ${table} WHERE worker_name = ?`, [ctx.name]);
      const rows = await ctx.api.query(ctx.account, state.databaseId, `SELECT COUNT(*) AS count FROM ${table}`);
      if (rows[0]?.count === 0) await ctx.api.query(ctx.account, state.databaseId, `DROP TABLE ${table}`);
    }
  }
  await mkdir(dirname(ctx.statePath), { recursive: true });
  await writeFile(ctx.statePath, `${JSON.stringify({ ...state, destroyed: true }, null, 2)}\n`, { mode: 0o600 });
  return { destroyed: true, plan };
}
