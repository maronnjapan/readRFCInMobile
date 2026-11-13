import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { join, basename } from 'node:path';
import { parse } from 'yaml';
import { repository, sha, filePath, validateContext } from '../../worker/contracts.js';
import { QUESTION_CATEGORIES } from '../../shared/quiz-types.js';

const exec = promisify(execFile);
const reject = (message) => { throw new Error(message); };
const git = async (root, args) => (await exec('git', args, { cwd: root, maxBuffer: 2 * 1024 * 1024 })).stdout.trimEnd();
const filesPerPart = 8;
export function inScope(path, paths) {
  return filePath(path) && paths.some((p) => p.endsWith('/') ? path.startsWith(p) : path === p);
}
export function excerpt(content, terms = [], maximum = 6000, line = null) {
  const lines = content.split('\n');
  const match = line === null ? terms.length ? lines.findIndex((s) => terms.some((t) => s.toLowerCase().includes(t.toLowerCase()))) : 0 : line - 1;
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

// 長い仕様も、検索語に関係する本文を先頭の説明とともに読む。行番号は原文のまま。
function specificationReferences(spec, content, commit, repo, terms) {
  const lines = content.split('\n');
  const chunks = [];
  for (let start = 0; start < lines.length; start += 100) {
    const body = lines.slice(start, start + 100).join('\n');
    const lower = body.toLowerCase();
    const score = terms.reduce((n, term) => n + lower.split(term.toLowerCase()).length - 1, 0);
    chunks.push({ start, body, score });
  }
  const ranked = [...chunks].sort((a, b) => b.score - a.score || a.start - b.start);
  const selected = [chunks[0], ...ranked.filter((c) => c.start !== 0)].filter(Boolean).slice(0, 6).sort((a, b) => a.start - b.start);
  return selected.map((chunk, i) => {
    const value = chunk.body.slice(0, 5000);
    return { id: `spec-${i + 1}`, kind: 'spec', repository: repo, commit, path: spec.path,
      startLine: chunk.start + 1, endLine: chunk.start + Math.max(1, value.split('\n').length),
      reason: `${spec.id} の仕様本文（検索語: ${terms.join(', ') || '指定なし'}。抜粋の範囲だけを参照）`, excerpt: value || '(empty file)' };
  });
}

export async function buildContext({ root, configRoot = root, specId, codeSource, prNumber, codeRef, specRef = 'HEAD', focusPaths = [], part = 1, questionRepository, github = githubClient() }) {
  if (!repository(questionRepository)) reject('QUESTION_REPOSITORY が正しくありません。');
  if (!Number.isInteger(part) || part < 1) reject('--part は1以上の整数で指定してください。');
  if (!Array.isArray(focusPaths) || focusPaths.length > 20) reject('対象パスは20件以内で指定してください。');
  const specs = JSON.parse(await readFile(join(configRoot, 'specs/index.json'), 'utf8'));
  const spec = specId ? specs.find((s) => s.id === specId) : null;
  if (specId && (!spec || !filePath(spec.path))) reject('specs/index.json に対象仕様がありません。');
  if (!spec && (!codeSource || !prNumber)) reject('仕様 ID、または参照先と PR 番号が必要です。');
  const specCommit = spec ? await git(root, ['rev-parse', '--verify', '--end-of-options', `${specRef}^{commit}`]) : null;
  if (spec && !sha(specCommit)) reject('仕様のコミットを確定できません。');
  const mapping = spec?.mapping ? JSON.parse(await readFile(join(configRoot, spec.mapping), 'utf8')) : {};
  const terms = (mapping.searchTerms || []).filter((t) => typeof t === 'string' && t.length > 0 && t.length < 100);
  const references = [];
  const context = { id: spec?.id, title: spec?.title, spec: spec ? { id: spec.id, status: spec.status, repository: questionRepository, commit: specCommit, path: spec.path } : null, references };
  let material = 'references の excerpt が取得した資料本文です。抜粋の範囲外は確認済みとして扱わないでください。';
  if (codeSource || prNumber) {
    const config = parse(await readFile(join(configRoot, 'code-sources.yaml'), 'utf8'));
    const source = config.sources?.find((s) => s.id === (codeSource || mapping.codeSource));
    if (!source || !repository(source.repository) || (spec && !source.specIds?.includes(spec.id)) || !Array.isArray(source.paths) || !source.paths.length
        || source.paths.some((p) => !filePath(p.replace(/\/$/, '')))) reject('参照先リポジトリ・仕様 ID・対象パスの設定が必要です。');
    if (focusPaths.some((p) => typeof p !== 'string' || !filePath(p.replace(/\/$/, ''))
        || !source.paths.some((allowed) => allowed.endsWith('/') ? p.startsWith(allowed) : p === allowed))) reject('対象パスは参照先の許可パス内で指定してください。');
    const paths = focusPaths.length ? focusPaths : source.paths;
    const repo = source.repository;
    if ((await github(`/repos/${repo}`)).private !== false) reject('公開コードだけを参照できます。');
    let commit, pr;
    let changed = [];
    let selected = [];
    if (prNumber) {
      const n = Number(prNumber);
      if (!Number.isInteger(n) || n < 1) reject('PR 番号が正しくありません。');
      pr = await github(`/repos/${repo}/pulls/${n}`);
      if (pr.head?.repo?.private !== false || !sha(pr.head?.sha) || !sha(pr.base?.sha)) reject('公開 PR の版を確定できません。');
      commit = pr.head.sha;
      const comparison = await github(`/repos/${repo}/compare/${pr.base.sha}...${commit}`);
      if (!sha(comparison.merge_base_commit?.sha)) reject('PR の差分の起点を確定できません。');
      context.pullRequest = { repository: repo, number: n, baseSha: comparison.merge_base_commit.sha, headSha: commit };
      for (let page = 1; page <= 30; page++) {
        const files = await github(`/repos/${repo}/pulls/${n}/files?per_page=100&page=${page}`);
        changed.push(...files.filter((f) => inScope(f.filename, paths)));
        if (files.length < 100) break;
        if (page === 30) reject('GitHub の変更一覧の上限です。PR を分割してください。');
      }
      changed.sort((a, b) => a.filename.localeCompare(b.filename));
      if (!changed.length) reject('対象パスに PR の変更がありません。');
      const parts = Math.ceil(changed.length / filesPerPart);
      if (part > parts) reject(`--part は1〜${parts}で指定してください。`);
      selected = changed.slice((part - 1) * filesPerPart, part * filesPerPart);
      const scope = { repository: repo, number: n, headSha: commit, baseSha: context.pullRequest.baseSha,
        specification: spec?.id || null, paths, part, parts, changedFiles: pr.changed_files ?? null,
        scopedFiles: changed.length, selectedFiles: selected.map((f) => f.filename) };
      const key = createHash('sha256').update(JSON.stringify({ ...scope, specCommit })).digest('hex').slice(0, 12);
      context.id = `pr-${n}-${commit.slice(0, 12)}-${key}`;
      context.title = `${repo} PR #${n}: ${pr.title || '変更内容'}${parts > 1 ? `（${part}/${parts}）` : ''}`.slice(0, 500);
      material += `\n対象範囲: ${JSON.stringify(scope)}\nPR 全体の理解を確認したとは表現せず、選択したファイルの変更を出題してください。続きは --part ${Math.min(part + 1, parts)}、絞り込みは --paths で指定します。`;
      const discussion = [];
      for (const [count, endpoint, label] of [[pr.comments, `issues/${n}/comments`, 'PR コメント'], [pr.review_comments, `pulls/${n}/comments`, 'レビューコメント']]) {
        if (!(count > 0)) continue;
        const comments = await github(`/repos/${repo}/${endpoint}?per_page=20&page=${Math.ceil(count / 20)}`);
        discussion.push(...comments.map((c) => `${label} ${c.html_url || c.id}:\n${String(c.body || '').slice(0, 700)}`));
      }
      const snapshot = `取得日時: ${new Date().toISOString()}\n対象範囲: ${JSON.stringify(scope)}\n# ${pr.title || `PR #${n}`}\n${String(pr.body || '').slice(0, 6500)}\n\n議論の抜粋（各種コメントの最終ページ、本文は各700文字まで）:\n${discussion.join('\n\n').slice(0, 4500)}`.slice(0, 15000);
      references.push({ id: 'pr-description', kind: 'pull_request', repository: repo, commit, path: `pulls/${n}`,
        startLine: 1, endLine: snapshot.split('\n').length, reason: '取得時点の PR 本文・レビューの抜粋と対象範囲。固定した問題ファイルにスナップショットを保存', excerpt: snapshot });
    } else {
      if (part !== 1) reject('--part は PR の作問で指定してください。');
      commit = (await github(`/repos/${repo}/commits/${encodeURIComponent(codeRef || source.branch)}`)).sha;
    }
    if (!sha(commit)) reject('コードのコミットを確定できません。');
    const cache = join(configRoot, '.authoring-work', repo.replace('/', '_'));
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
    const stem = (path) => basename(path).replace(/\.(?:test|spec)?\.?[cm]?[jt]sx?$/, '');
    const related = pr ? candidates.filter((f) => /(?:test|spec)/i.test(f.path) && selected.some((s) => stem(s.filename) === stem(f.path))
      && !selected.some((s) => s.filename === f.path)).sort((a, b) => a.path.localeCompare(b.path)).slice(0, 2) : [];
    const code = pr ? [...selected.filter((f) => f.status !== 'removed').map((f) => ({ path: f.filename, patch: f.patch })), ...related]
      : candidates.filter((f) => inScope(f.path, paths)).sort((a, b) => Number(/test|spec/i.test(b.path)) - Number(/test|spec/i.test(a.path)) || a.path.localeCompare(b.path)).slice(0, 10);
    for (const f of code) {
      const start = Number(/@@ -\d+(?:,\d+)? \+(\d+)/.exec(f.patch || '')?.[1] || 0);
      references.push({ id: `code-${references.length}`, kind: 'code', repository: repo, commit, path: f.path,
        ...excerpt(await codeFile(f.path, commit), terms, 3000, start || null), reason: '対象ファイルの変更箇所の周辺、または対応するテストの抜粋' });
    }
    for (const f of selected) {
      if (!f.patch) reject(`差分が省略されています。対象を分けて確認してください: ${f.filename}`);
      const start = Math.max(1, Number(/@@ -\d+(?:,\d+)? \+(\d+)/.exec(f.patch)?.[1] || 1));
      references.push({ id: `diff-${references.length}`, kind: 'diff', repository: repo, commit, path: f.filename,
        startLine: start, endLine: start, reason: `PR #${context.pullRequest.number} の変更差分${f.patch.length > 4500 ? '（先頭4500文字の抜粋）' : ''}`, excerpt: f.patch.slice(0, 4500) });
      const path = f.previous_filename || f.filename;
      if (f.status !== 'added' && inScope(path, source.paths)) {
        references.push({ id: `before-${references.length}`, kind: 'code', repository: repo, commit: context.pullRequest.baseSha, path,
          ...excerpt(await codeFile(path, context.pullRequest.baseSha), terms, 2500), reason: `PR #${prNumber} の変更前のコード（共通祖先）` });
      }
    }
    if (pr && !spec) material += '\n仕様は指定されていません。コード・PR の意図や動作を問い、仕様への適合を確認済みとは述べないでください。';
    for (const f of selected) {
      const term = basename(f.filename).replace(/\.(test|spec)?\.?[cm]?[jt]sx?$/, '').replaceAll('-', '_');
      if (term.length >= 4 && !terms.includes(term)) terms.push(term);
    }
    if (pr) {
      const current = await github(`/repos/${repo}/pulls/${Number(prNumber)}`);
      if (current.head?.sha !== commit || current.base?.sha !== pr.base.sha) reject('資料の取得中に PR が更新されました。再実行して版を揃えてください。');
    }
  }
  if (spec) {
    const content = await git(root, ['show', `${specCommit}:${spec.path}`]);
    references.unshift(...specificationReferences(spec, content, specCommit, questionRepository, terms));
  }
  validateContext(context);
  return { context, material, questionCount: Object.keys(QUESTION_CATEGORIES).length, questionCategories: Object.keys(QUESTION_CATEGORIES) };
}
