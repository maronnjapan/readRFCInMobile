import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { parse } from 'yaml';
import { repository, sha, filePath, validateContext } from '../../worker/contracts.js';
import { QUESTION_CATEGORIES } from '../../src/quiz-types.js';

const exec = promisify(execFile);
const reject = (message) => { throw new Error(message); };
const git = async (root, args) => (await exec('git', args, { cwd: root, maxBuffer: 2 * 1024 * 1024 })).stdout.trimEnd();
export function inScope(path, paths) {
  return filePath(path) && paths.some((p) => p.endsWith('/') ? path.startsWith(p) : path === p);
}
export function excerpt(content, terms = [], maximum = 6000) {
  const lines = content.split('\n');
  const match = terms.length ? lines.findIndex((line) => terms.some((t) => line.toLowerCase().includes(t.toLowerCase()))) : 0;
  const start = Math.max(0, match - 15);
  const value = lines.slice(start, start + 160).join('\n').slice(0, maximum);
  return { excerpt: value || '(empty file)', startLine: start + 1, endLine: start + Math.max(1, value.split('\n').length) };
}
export function githubClient(token = process.env.GITHUB_TOKEN) {
  return async (path) => {
    const response = await fetch(`https://api.github.com${path}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'spec-quiz-authoring', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) reject(`GitHub の資料を取得できません (${response.status}): ${path}`);
    return response.json();
  };
}

export async function buildContext({ root, specId, codeSource, prNumber, codeRef, specRef = 'HEAD', questionRepository, github = githubClient() }) {
  if (!repository(questionRepository)) reject('QUESTION_REPOSITORY が正しくありません。');
  const specs = JSON.parse(await readFile(join(root, 'specs/index.json'), 'utf8'));
  const spec = specs.find((s) => s.id === specId);
  if (!spec || !filePath(spec.path)) reject('specs/index.json に対象仕様がありません。');
  const specCommit = await git(root, ['rev-parse', '--verify', '--end-of-options', `${specRef}^{commit}`]);
  if (!sha(specCommit)) reject('仕様のコミットを確定できません。');
  const specText = await git(root, ['show', `${specCommit}:${spec.path}`]);
  const references = [];
  const lines = specText.split('\n');
  let budget = 40000;
  for (let start = 0; start < lines.length && budget > 0; start += 160) {
    const value = lines.slice(start, start + 160).join('\n').slice(0, Math.min(8000, budget));
    if (!value.trim()) continue;
    references.push({ id: `spec-${references.length + 1}`, kind: 'spec', repository: questionRepository, commit: specCommit, path: spec.path,
      startLine: start + 1, endLine: start + value.split('\n').length, reason: `${spec.id} の仕様本文`, excerpt: value });
    budget -= value.length;
  }
  const context = { id: spec.id, title: spec.title, spec: { id: spec.id, status: spec.status, repository: questionRepository, commit: specCommit, path: spec.path }, references };
  if (codeSource || prNumber) {
    const config = parse(await readFile(join(root, 'code-sources.yaml'), 'utf8'));
    const mapping = spec.mapping ? JSON.parse(await readFile(join(root, spec.mapping), 'utf8')) : {};
    const source = config.sources?.find((s) => s.id === (codeSource || mapping.codeSource));
    if (!source || !repository(source.repository) || !source.specIds?.includes(spec.id) || !Array.isArray(source.paths) || !source.paths.length
        || source.paths.some((p) => !filePath(p.replace(/\/$/, '')))) reject('参照先リポジトリ・仕様 ID・対象パスの設定が必要です。');
    const repo = source.repository;
    if ((await github(`/repos/${repo}`)).private !== false) reject('公開コードだけを参照できます。');
    let commit;
    let changed = [];
    if (prNumber) {
      const n = Number(prNumber);
      if (!Number.isInteger(n) || n < 1) reject('PR 番号が正しくありません。');
      const pr = await github(`/repos/${repo}/pulls/${n}`);
      if (pr.head?.repo?.private !== false || !sha(pr.head?.sha) || !sha(pr.base?.sha)) reject('公開 PR の版を確定できません。');
      commit = pr.head.sha;
      context.pullRequest = { repository: repo, number: n, baseSha: pr.base.sha, headSha: pr.head.sha };
      context.id = `${spec.id}-pr-${n}`;
      for (let page = 1; page <= 3; page++) {
        const files = await github(`/repos/${repo}/pulls/${n}/files?per_page=100&page=${page}`);
        changed.push(...files.filter((f) => inScope(f.filename, source.paths)));
        if (files.length < 100) break;
        if (page === 3) reject('PR が大きすぎます。対象範囲を分割してください。');
      }
    } else commit = (await github(`/repos/${repo}/commits/${encodeURIComponent(codeRef || source.branch)}`)).sha;
    if (!sha(commit)) reject('コードのコミットを確定できません。');
    const terms = (mapping.searchTerms || []).filter((t) => typeof t === 'string' && t.length < 100);
    const cache = join(root, '.authoring-work', repo.replace('/', '_'));
    async function codeFile(path, ref) {
      if (!inScope(path, source.paths) || !sha(ref)) reject('参照対象外のコードです。');
      const data = await github(`/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${ref}`);
      if (data.encoding !== 'base64' || data.size > 200000) reject(`テキストとして取得できません: ${path}`);
      const content = Buffer.from(data.content, 'base64').toString('utf8');
      if (content.includes('\0')) reject(`バイナリは取得対象外です: ${path}`);
      const target = join(cache, ref, path);
      await mkdir(join(target, '..'), { recursive: true });
      await writeFile(target, content);
      return content;
    }
    const tree = await github(`/repos/${repo}/git/trees/${commit}?recursive=1`);
    if (tree.truncated) reject('コード一覧が省略されました。参照先を小さく分けてください。');
    const candidates = tree.tree.filter((f) => f.type === 'blob' && inScope(f.path, source.paths) && /\.(?:[cm]?js|[cm]?ts|tsx|jsx|py|go|rs|java|ya?ml|json|md)$/.test(f.path));
    candidates.sort((a, b) => Number(changed.some((f) => f.filename === b.path)) - Number(changed.some((f) => f.filename === a.path))
      || Number(/test|spec/i.test(b.path)) - Number(/test|spec/i.test(a.path)) || a.path.localeCompare(b.path));
    for (const f of candidates.slice(0, 10)) {
      const content = await codeFile(f.path, commit);
      references.push({ id: `code-${references.length}`, kind: 'code', repository: repo, commit, path: f.path,
        ...excerpt(content, terms, 3500), reason: `対象パスと検索語 (${terms.join(', ') || '指定なし'}) から周辺コード・テストを確認` });
    }
    for (const f of changed.slice(0, 6)) {
      if (!f.patch) reject(`差分が省略されています: ${f.filename}`);
      const start = Number(/@@ -\d+(?:,\d+)? \+(\d+)/.exec(f.patch)?.[1] || 1);
      references.push({ id: `diff-${references.length}`, kind: 'diff', repository: repo, commit, path: f.filename,
        startLine: Math.max(1, start), endLine: Math.max(1, start), reason: `PR #${context.pullRequest.number} の変更差分`, excerpt: f.patch.slice(0, 5000) });
      if (f.status !== 'added') {
        const path = f.previous_filename || f.filename;
        references.push({ id: `before-${references.length}`, kind: 'code', repository: repo, commit: context.pullRequest.baseSha, path,
          ...excerpt(await codeFile(path, context.pullRequest.baseSha), terms, 3000), reason: `PR #${context.pullRequest.number} の変更前のコード` });
      }
    }
  }
  validateContext(context);
  return { context, material: 'references の excerpt が取得・検索した資料本文です。範囲外のコードや省略された箇所は確認済みとして扱わないでください。', questionCount: 6, questionCategories: Object.keys(QUESTION_CATEGORIES) };
}
