import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { validateSet } from '../worker/contracts.js';
import { questionSetId } from '../shared/question-revisions.js';

const app = new URL('../', import.meta.url);
const repositoryRoot = new URL('../../', app);

// GitHub にコミットした問題を Worker の非公開バンドルに含める。dist には出力しない。
export async function buildQuestionCatalog() {
  const config = JSON.parse(await readFile(new URL('wrangler.jsonc', app), 'utf8'));
  const entries = [];
  for (const file of (await readdir(new URL('questions/', app), { recursive: true })).sort()) {
    if (!/^(spec|pr)\/.+\.json$/.test(file)) continue;
    const artifact = JSON.parse(await readFile(new URL(`questions/${file}`, app), 'utf8'));
    if (artifact.status !== 'published') continue;
    validateSet(artifact, { published: true });
    if ((file.startsWith('pr/')) !== Boolean(artifact.pullRequest)) throw new Error(`問題ファイルの配置と PR の情報が一致しません: ${file}`);
    const path = `apps/quiz/questions/${file}`;
    const commit = execFileSync('git', ['log', '-1', '--format=%H', '--', path], { cwd: repositoryRoot, encoding: 'utf8' }).trim();
    if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error(`公開前に問題ファイルをコミットしてください: ${path}`);
    const revision = { repository: process.env.QUESTION_REPOSITORY || config.vars.QUESTION_REPOSITORY, commit, path };
    entries.push({ id: await questionSetId(revision), revision, artifact });
  }
  await mkdir(new URL('.wrangler/', app), { recursive: true });
  await writeFile(new URL('.wrangler/question-catalog.json', app), JSON.stringify(entries));
  return entries;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await buildQuestionCatalog();
