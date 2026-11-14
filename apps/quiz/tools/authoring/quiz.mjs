import { readFile, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { buildContext } from './context.mjs';
import { validateSet, validateCategories, sha, filePath } from '../../worker/contracts.js';
import { QUESTION_CATEGORIES } from '../../shared/quiz-types.js';
import { questionKind, questionFilePath, materialFilePath } from '../../shared/question-paths.js';

const appRoot = fileURLToPath(new URL('../../', import.meta.url));
const root = fileURLToPath(new URL('../../../../', import.meta.url));
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
    method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(30000), redirect: 'error',
    headers: { 'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID, 'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET,
      Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(`出題 API の処理に失敗しました (${response.status})。${typeof detail.message === 'string' ? detail.message : ''}`);
  }
  return response.json();
}

try {
  if (command === 'generate' || command === 'prepare') {
    if (options['publish-pr'] !== undefined) throw new Error('作問と公開は別の操作です。問題ファイルを確認して publish してください。');
    let payload;
    if (options.materials || options['materials-commit'] || options['materials-path']) {
      if (command !== 'generate') throw new Error('保存済み資料は generate --materials PATH で指定してください。');
      if (options.materials) payload = JSON.parse(await readFile(resolve(root, options.materials), 'utf8'));
      else {
        if (!sha(options['materials-commit']) || !filePath(options['materials-path']) || !options['materials-path'].startsWith('apps/quiz/materials/')) throw new Error('資料の固定コミットと apps/quiz/materials/ 内のパスが必要です。');
        payload = JSON.parse(execFileSync('git', ['show', `${options['materials-commit']}:${options['materials-path']}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
      }
      if (payload?.format !== 'quiz-authoring-materials' || payload.version !== 1) throw new Error('prepare で保存した作問資料が必要です。');
    } else {
      payload = await buildContext({ root, configRoot: appRoot, specId: options.spec, codeSource: options.source, prNumber: options.pr, codeRef: options.ref,
        specRef: options['spec-ref'] || 'HEAD', focusPaths: (options.paths || '').split(/[,\n]/).map((p) => p.trim()).filter(Boolean),
        questionRepository: process.env.QUESTION_REPOSITORY || 'maronnjapan/readRFCInMobile' });
    }
    const questionCount = Number(options.count || payload.questionCount || Object.keys(QUESTION_CATEGORIES).length);
    if (!Number.isSafeInteger(questionCount) || questionCount < 1 || (command === 'generate' && !payload.context.pullRequest && (questionCount < 2 || questionCount > 10))) throw new Error('問題数は正の整数で指定してください。仕様のみの AI 作問は2〜10問です。');
    const questionCategories = validateCategories(options.categories ? options.categories.split(',').map((v) => v.trim()) : payload.questionCategories || Object.keys(QUESTION_CATEGORIES), command === 'prepare' ? Number.MAX_SAFE_INTEGER : questionCount);
    Object.assign(payload, { questionCount, questionCategories });
    if (command === 'prepare') {
      const path = materialFilePath(payload.context);
      const target = resolve(root, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
      console.log(`作問資料を保存: ${path}（AI は実行しません）`);
      console.log(payload.material);
      if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `path=${path}\n`);
      if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `作問資料: \`${path}\`\n\nこの資料から別途問題 JSON を作成し、check・公開してください。\n`);
      process.exit(0);
    }
    const generation = { context: payload.context, material: payload.material, questionCount, questionCategories };
    if (Buffer.byteLength(JSON.stringify(generation)) > 290000) throw new Error('任意の AI 作問 API の入力上限を超えています。参照箇所を選ぶか、保存した全文資料から別途作問してください。');
    const submitted = await service('authoring/requests', generation);
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
    const path = questionFilePath(artifact);
    const target = resolve(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(artifact, null, 2)}\n`);
    console.log(`候補を保存: ${path} (draft)。正解・採点基準・出典・不整合をレビューしてください。`);
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `path=${path}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `作問候補: \`${path}\`\n\n${payload.material}\n\n`);
  } else if (command === 'publish') {
    if (!sha(options.commit) || !filePath(options.path) || !questionKind(options.path)) throw new Error('固定コミットと問題ファイルのパスが必要です。');
    const result = await service('question-sets/import', { repository: process.env.QUESTION_REPOSITORY || 'maronnjapan/readRFCInMobile', commit: options.commit, path: options.path });
    console.log(`出題 URL: ${result.url}`);
    console.log(`PR 連携: ${result.prIntegration}`);
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `url=${result.url}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `[問題に回答する](${result.url})\n\nPR 連携: ${result.prIntegration}\n`);
  } else if (command === 'check') {
    if (!filePath(options.path)) throw new Error('--path が必要です。');
    validateSet(JSON.parse(await readFile(resolve(root, options.path), 'utf8')));
    console.log('問題形式・採点基準・出典: OK');
  } else throw new Error('prepare [--spec ID] [--source ID|owner/repository] [--pr N] [--paths PATH,...] / generate [--materials PATH | --materials-commit SHA --materials-path PATH] [--count N] [--categories CATEGORY,...] / check --path PATH / publish --commit SHA --path PATH');
} catch (error) { console.error(error.message); process.exitCode = 1; }
