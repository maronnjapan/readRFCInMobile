import { HttpError, repository, sha, filePath } from './contracts.js';

const api = 'https://api.github.com';
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'spec-understanding-quiz', 'X-GitHub-Api-Version': '2022-11-28' };
const pathUrl = (path) => path.split('/').map(encodeURIComponent).join('/');

export async function publicQuestionFile(env, repo, commit, path) {
  if (!repository(repo) || repo !== env.QUESTION_REPOSITORY || !sha(commit) || !filePath(path) || !/^questions\/(spec|pr)\/.+\.json$/.test(path)) throw new HttpError(400, '許可された問題リポジトリの固定コミットを指定してください。');
  const info = await fetch(`${api}/repos/${repo}`, { headers, signal: AbortSignal.timeout(10000) });
  if (!info.ok || (await info.json()).private !== false) throw new HttpError(400, '公開された問題リポジトリだけを取り込めます。');
  if (path.startsWith('questions/spec/')) {
    const comparison = await fetch(`${api}/repos/${repo}/compare/${commit}...${encodeURIComponent(env.QUESTION_DEFAULT_BRANCH || 'main')}`, { headers, signal: AbortSignal.timeout(10000) });
    if (!comparison.ok || !['ahead', 'identical'].includes((await comparison.json()).status)) throw new HttpError(400, '仕様の定番問題は標準ブランチに取り込んでから公開してください。');
  }
  const response = await fetch(`https://raw.githubusercontent.com/${repo}/${commit}/${pathUrl(path)}`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new HttpError(400, '問題ファイルを取得できません。');
  const body = await response.text();
  if (body.length > 250000) throw new HttpError(413, '問題ファイルが大きすぎます。');
  try { return JSON.parse(body); } catch { throw new HttpError(400, '問題ファイルの JSON が正しくありません。'); }
}

const base64url = (s) => btoa(typeof s === 'string' ? s : String.fromCharCode(...s)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
export const githubConfigured = (env) => Boolean(env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY && env.GITHUB_INSTALLATION_ID);

async function installationToken(env, repo) {
  const pem = env.GITHUB_APP_PRIVATE_KEY.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const payload = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ iat: now - 30, exp: now + 300, iss: env.GITHUB_APP_ID }))}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(payload));
  const response = await fetch(`${api}/app/installations/${encodeURIComponent(env.GITHUB_INSTALLATION_ID)}/access_tokens`, {
    method: 'POST', headers: { ...headers, Authorization: `Bearer ${payload}.${base64url(new Uint8Array(signature))}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ repositories: [repo.split('/')[1]], permissions: { checks: 'write', pull_requests: 'write' } }), signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('GitHub installation authentication failed');
  return (await response.json()).token;
}

export async function syncPullRequest(env, setId) {
  if (!githubConfigured(env)) return;
  const row = await env.DB.prepare('SELECT * FROM question_sets WHERE id = ?').bind(setId).first();
  if (!row?.pr_json) return;
  const pr = JSON.parse(row.pr_json);
  const allowed = (env.CODE_REPOSITORIES || '').split(',').map((s) => s.trim());
  if (!allowed.includes(pr.repository)) throw new Error('PR repository is not allowed');
  const token = await installationToken(env, pr.repository);
  async function github(path, method = 'GET', body) {
    const response = await fetch(`${api}/repos/${pr.repository}${path}`, {
      method, headers: { ...headers, Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`GitHub integration returned ${response.status}`);
    return response.json();
  }
  const counts = await env.DB.prepare("SELECT COUNT(*) AS total, SUM(status = 'graded') AS graded FROM attempts WHERE set_id = ? AND answers_json IS NOT NULL").bind(setId).first();
  const link = `${env.APP_ORIGIN}/quiz?set=${encodeURIComponent(setId)}`;
  const summary = `回答 ${counts.total} 件、採点完了 ${counts.graded || 0} 件。参考情報として表示しています。`;
  const name = '仕様理解クイズ';
  let checkId = row.check_id;
  if (!checkId) {
    const checks = await github(`/commits/${pr.headSha}/check-runs?check_name=${encodeURIComponent(name)}&per_page=100`);
    checkId = checks.check_runs?.find((c) => c.external_id === setId)?.id;
  }
  const check = await github(checkId ? `/check-runs/${checkId}` : '/check-runs', checkId ? 'PATCH' : 'POST', {
    name, ...(checkId ? {} : { head_sha: pr.headSha, external_id: setId }), status: 'completed', conclusion: 'neutral', details_url: link,
    output: { title: '仕様・変更内容の理解を確認できます', summary: `${summary}\n\n[問題に回答する](${link})` },
  });
  let commentId = row.comment_id;
  const marker = `<!-- spec-quiz:${setId} -->`;
  if (!commentId) {
    const comments = await github(`/issues/${pr.number}/comments?per_page=100`);
    commentId = comments.find((c) => c.body?.includes(marker))?.id;
  }
  const comment = await github(commentId ? `/issues/comments/${commentId}` : `/issues/${pr.number}/comments`, commentId ? 'PATCH' : 'POST', {
    body: `${marker}\n[仕様・PR の理解度確認に回答する](${link})\n\n対象コミット: \`${pr.headSha}\`\n\n${summary}`,
  });
  await env.DB.prepare('UPDATE question_sets SET check_id = ?, comment_id = ?, pr_sync_needed = 0 WHERE id = ?').bind(check.id, comment.id, setId).run();
}
