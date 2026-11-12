import { readFile, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContext } from './context.mjs';
import { validateSet, validateCategories, sha, filePath } from '../../worker/contracts.js';
import { QUESTION_CATEGORIES } from '../../src/quiz-types.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const command = args.shift();
const options = {};
while (args.length) {
  const key = args.shift();
  if (!key.startsWith('--') || !args.length) throw new Error('引数は --name value の形式です。');
  options[key.slice(2)] = args.shift();
}
async function service(path, body) {
  const base = process.env.QUIZ_API_URL;
  if (!base || !/^https:\/\//.test(base)) throw new Error('QUIZ_API_URL に HTTPS の出題サービス URL を設定してください。');
  if (!process.env.CF_ACCESS_CLIENT_ID || !process.env.CF_ACCESS_CLIENT_SECRET) throw new Error('作問用の Cloudflare Access Service Token が必要です。');
  const response = await fetch(new URL(`/api/${path}`, base), {
    method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(30000),
    headers: { 'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID, 'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET,
      Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(`出題 API の処理に失敗しました (${response.status})。`);
  return response.json();
}

try {
  if (command === 'generate') {
    const questionCount = Number(options.count || 6);
    if (!Number.isInteger(questionCount) || questionCount < 2 || questionCount > 10) throw new Error('--count は2〜10問で指定してください。');
    const questionCategories = validateCategories(options.categories ? options.categories.split(',').map((v) => v.trim()) : Object.keys(QUESTION_CATEGORIES), questionCount);
    const payload = await buildContext({ root, specId: options.spec, codeSource: options.source, prNumber: options.pr, codeRef: options.ref,
      specRef: options['spec-ref'] || 'HEAD', questionRepository: process.env.QUESTION_REPOSITORY || 'maronnjapan/readRFCInMobile' });
    Object.assign(payload, { questionCount, questionCategories });
    if (Buffer.byteLength(JSON.stringify(payload)) > 290000) throw new Error('資料が大きすぎます。参照パスを絞ってください。');
    const submitted = await service('authoring/requests', payload);
    console.log(`作問ジョブ: ${submitted.id}`);
    let artifact;
    for (let i = 0; i < 360; i++) {
      const job = await service(`authoring/requests/${submitted.id}`);
      if (job.status === 'failed') throw new Error(job.error || '作問に失敗しました。');
      if (job.status === 'completed') { artifact = job.artifact; break; }
      await new Promise((r) => setTimeout(r, 5000));
    }
    if (!artifact) throw new Error('作問が時間内に完了しませんでした。ジョブの状態を確認してください。');
    validateSet(artifact);
    const path = artifact.pullRequest ? `questions/pr/${artifact.pullRequest.repository}/${artifact.pullRequest.number}.json` : `questions/spec/${artifact.spec.id}.json`;
    const target = resolve(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(artifact, null, 2)}\n`);
    console.log(`候補を保存: ${path} (draft)。正解・採点基準・出典・不整合をレビューしてください。`);
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `path=${path}\n`);
  } else if (command === 'publish') {
    if (!sha(options.commit) || !filePath(options.path) || !/^questions\/(spec|pr)\/.+\.json$/.test(options.path)) throw new Error('固定コミットと問題ファイルのパスが必要です。');
    const result = await service('question-sets/import', { repository: process.env.QUESTION_REPOSITORY || 'maronnjapan/readRFCInMobile', commit: options.commit, path: options.path });
    console.log(`出題 URL: ${result.url}`);
    console.log(`PR 連携: ${result.prIntegration}`);
  } else if (command === 'check') {
    if (!filePath(options.path)) throw new Error('--path が必要です。');
    validateSet(JSON.parse(await readFile(resolve(root, options.path), 'utf8')));
    console.log('問題形式・採点基準・出典: OK');
  } else throw new Error('generate --spec ID [--count 6] [--categories vocabulary,knowledge,flow,design,debugging,comparison] [--source ID] [--pr N] / check --path PATH / publish --commit SHA --path PATH');
} catch (error) { console.error(error.message); process.exitCode = 1; }
