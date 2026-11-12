const endpoint = 'https://api.cloudflare.com/client/v4';

export class CloudflareApi {
  constructor(token, fetcher = fetch) {
    if (!token) throw new Error('CLOUDFLARE_API_TOKEN が必要です。');
    this.token = token;
    this.fetcher = fetcher;
  }
  async request(path, { method = 'GET', body, missing = false } = {}) {
    const multipart = body instanceof FormData;
    const response = await this.fetcher(`${endpoint}${path}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${this.token}`, ...(!multipart && body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: multipart ? body : JSON.stringify(body) } : {}),
    });
    if (missing && response.status === 404) return null;
    let data;
    try { data = await response.json(); } catch { throw new Error(`Cloudflare API ${method} ${path}: HTTP ${response.status}`); }
    if (!response.ok || !data.success) {
      const codes = (data.errors || []).map((error) => error.code).join(', ');
      throw new Error(`Cloudflare API ${method} ${path}: HTTP ${response.status}${codes ? ` (code ${codes})` : ''}`);
    }
    return data.result;
  }
  async list(path, pageSize = 100) {
    const all = [];
    for (let page = 1; ; page++) {
      const rows = await this.request(`${path}${path.includes('?') ? '&' : '?'}per_page=${pageSize}&page=${page}`);
      if (!Array.isArray(rows)) throw new Error(`Cloudflare API: 一覧形式ではありません (${path})。`);
      all.push(...rows);
      if (rows.length < pageSize) return all;
    }
  }
  async query(account, database, sql, params = []) {
    const result = await this.request(`/accounts/${account}/d1/database/${database}/query`, { method: 'POST', body: { sql, params } });
    if (!Array.isArray(result) || result.some((entry) => entry.success === false)) throw new Error('D1のデプロイ状態を読み書きできませんでした。');
    return result[0]?.results || [];
  }
}
