export const account = 'a'.repeat(32);
const copy = (value) => structuredClone(value);

export class DeploymentApi {
  databases = new Map();
  queues = new Map();
  workers = new Map();
  calls = [];
  sequence = 0;
  accounts = [{ id: account }];
  nextId() { return (++this.sequence).toString(16).padStart(32, '0'); }
  addDatabase(name) {
    const value = { uuid: `00000000-0000-4000-8000-${(++this.sequence).toString().padStart(12, '0')}`, name, state: new Map(), table: false, applicationRows: ['keep existing answers'] };
    this.databases.set(value.uuid, value);
    return value;
  }
  addQueue(name) {
    const value = { queue_id: this.nextId(), queue_name: name, consumers: [] };
    this.queues.set(value.queue_id, value);
    return value;
  }
  async list(path, pageSize) {
    this.calls.push({ path, method: 'LIST', pageSize });
    if (path === '/accounts') return copy(this.accounts);
    const suffix = path.replace(`/accounts/${account}`, '');
    if (suffix === '/d1/database') return [...this.databases.values()].map(({ uuid, name }) => ({ uuid, name }));
    if (suffix === '/queues') return [...this.queues.values()].map(({ queue_id, queue_name }) => ({ queue_id, queue_name }));
    const match = /^\/queues\/([^/]+)\/consumers$/.exec(suffix);
    if (match) return copy(this.queues.get(match[1])?.consumers || []);
    throw new Error(`Unexpected list: ${path}`);
  }
  async request(path, { method = 'GET', body, missing = false } = {}) {
    this.calls.push({ path, method });
    const suffix = path.replace(`/accounts/${account}`, '');
    if (suffix === '/workers/subdomain') return { subdomain: 'quiz-test' };
    if (suffix === '/d1/database' && method === 'POST') {
      const value = this.addDatabase(body.name);
      return { uuid: value.uuid, name: value.name };
    }
    if (suffix === '/queues' && method === 'POST') {
      const value = this.addQueue(body.queue_name);
      return { queue_id: value.queue_id, queue_name: value.queue_name };
    }
    let match = /^\/(d1\/database|queues)\/([^/]+)$/.exec(suffix);
    if (match) {
      const map = match[1] === 'queues' ? this.queues : this.databases;
      const value = map.get(match[2]);
      if (!value && !missing) throw new Error('Missing resource');
      if (method === 'DELETE') { map.delete(match[2]); return null; }
      return value ? copy(value) : null;
    }
    match = /^\/queues\/([^/]+)\/consumers\/([^/]+)$/.exec(suffix);
    if (match && method === 'DELETE') {
      const queue = this.queues.get(match[1]);
      if (queue) queue.consumers = queue.consumers.filter((consumer) => consumer.consumer_id !== match[2]);
      return null;
    }
    match = /^\/workers\/scripts\/([^/]+)(?:\/(settings|secrets))?$/.exec(suffix);
    if (match) {
      const name = match[1];
      let worker = this.workers.get(name);
      if (method === 'PUT' && !match[2]) {
        const metadata = JSON.parse(await body.get('metadata').text());
        worker = { bindings: metadata.bindings, secrets: new Map() };
        this.workers.set(name, worker);
        return { id: name };
      }
      if (!worker) { if (missing) return null; throw new Error('Missing worker'); }
      if (match[2] === 'settings') return { bindings: copy(worker.bindings) };
      if (match[2] === 'secrets') {
        if (method === 'PUT') { worker.secrets.set(body.name, body.text); return { name: body.name }; }
        return [...worker.secrets.keys()].map((name) => ({ name, type: 'secret_text' }));
      }
      if (method === 'DELETE') { this.workers.delete(name); return null; }
    }
    throw new Error(`Unexpected request: ${method} ${suffix}`);
  }
  async query(_account, database, sql, params = []) {
    const db = this.databases.get(database);
    if (!db) throw new Error('Missing D1');
    if (sql.startsWith('SELECT name FROM sqlite_master')) return db.table ? [{ name: '_quiz_deployment_state' }] : [];
    if (sql.startsWith('CREATE TABLE')) { db.table = true; return []; }
    if (!db.table) throw new Error('no such table: _quiz_deployment_state');
    if (sql.startsWith('INSERT OR REPLACE')) { db.state.set(params[0], params[1]); return []; }
    if (sql.startsWith('SELECT state_json')) return db.state.has(params[0]) ? [{ state_json: db.state.get(params[0]) }] : [];
    if (sql.startsWith('SELECT worker_name')) return [...db.state.keys()].filter((name) => name !== params[0]).map((worker_name) => ({ worker_name }));
    if (sql.startsWith('DELETE FROM')) { db.state.delete(params[0]); return []; }
    if (sql.startsWith('SELECT COUNT')) return [{ count: db.state.size }];
    if (sql.startsWith('DROP TABLE')) { db.table = false; return []; }
    throw new Error(`Unexpected SQL: ${sql}`);
  }
  publish(config) {
    const worker = this.workers.get(config.name) || { secrets: new Map() };
    worker.bindings = Object.entries(config.vars).map(([name, text]) => ({ type: 'plain_text', name, text }));
    worker.bindings.push(...config.d1_databases.map((binding) => ({ type: 'd1', name: binding.binding, id: binding.database_id })));
    worker.bindings.push(...config.queues.producers.map((binding) => ({ type: 'queue', name: binding.binding, queue_name: binding.queue })));
    this.workers.set(config.name, worker);
    for (const binding of config.queues.consumers) {
      const queue = [...this.queues.values()].find((queue) => queue.queue_name === binding.queue);
      if (!queue.consumers.some((consumer) => consumer.script_name === config.name)) queue.consumers.push({ consumer_id: this.nextId(), script_name: config.name });
    }
  }
}
