import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildQuestionCatalog } from '../scripts/build-question-catalog.mjs';
import { questionFilePath } from '../shared/question-paths.js';
import { startQuizWorker, pullRequestFixture } from '../test-support/quiz-worker.mjs';

const exec = promisify(execFile);
const sourceApp = fileURLToPath(new URL('../', import.meta.url));
const repository = 'maronnjapan/readRFCInMobile';

async function temporaryRoot(t) {
  const root = await mkdtemp(join(tmpdir(), 'file-first-pr-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('prepare CLI saves reusable full materials without an AI API or Access credentials', async (t) => {
  const root = await temporaryRoot(t);
  const app = join(root, 'apps/quiz');
  for (const path of ['tools/authoring/quiz.mjs', 'tools/authoring/context.mjs', 'worker/contracts.js', 'shared/quiz-types.js', 'shared/question-paths.js']) {
    await mkdir(dirname(join(app, path)), { recursive: true });
    await writeFile(join(app, path), await readFile(join(sourceApp, path)));
  }
  await writeFile(join(root, 'package.json'), '{"type":"module"}');
  await symlink(fileURLToPath(new URL('../../../node_modules/', import.meta.url)), join(root, 'node_modules'), 'dir');
  await mkdir(join(app, 'specs'));
  await writeFile(join(app, 'specs/index.json'), '[]');
  await writeFile(join(app, 'code-sources.yaml'), 'sources: []');
  const preload = join(root, 'github-only.mjs');
  await writeFile(preload, `
    const head = 'a'.repeat(40), base = 'b'.repeat(40);
    const changed = Array.from({length: 11}, (_, i) => ({filename: 'unrestricted/file-' + i + '.js', status: 'modified', patch: '@@ -1 +1 @@\\n-old()\\n+newCode()'}));
    globalThis.fetch = async (url) => {
      const {hostname, pathname} = new URL(url);
      if (hostname !== 'api.github.com') throw new Error('AI or application API must not be called by prepare');
      let data;
      if (pathname === '/repos/another/project') data = {private: false};
      else if (pathname.endsWith('/pulls/7')) data = {title: 'Prepared only', head: {sha: head, repo: {private: false}}, base: {sha: base}};
      else if (pathname.includes('/compare/')) data = {merge_base_commit: {sha: base}};
      else if (pathname.endsWith('/files')) data = changed;
      else if (pathname.includes('/git/trees/')) data = {tree: changed.map(f => ({type: 'blob', path: f.filename}))};
      else if (pathname.includes('/contents/')) data = {encoding: 'base64', content: Buffer.from('full source\\n'.repeat(4000)).toString('base64')};
      else throw new Error('Unexpected request: ' + url);
      return Response.json(data);
    };
  `);
  const output = join(root, 'outputs');
  await exec(process.execPath, ['--import', preload, join(app, 'tools/authoring/quiz.mjs'), 'prepare', '--source', 'another/project', '--pr', '7', '--count', '100'], {
    cwd: root, env: { ...process.env, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: '', QUIZ_API_URL: '', CF_ACCESS_CLIENT_ID: '', CF_ACCESS_CLIENT_SECRET: '', QUESTION_REPOSITORY: repository },
  });
  const path = (await readFile(output, 'utf8')).trim().slice('path='.length);
  assert.match(path, /^apps\/quiz\/materials\/pr\/another\/project\/7\//);
  const payload = JSON.parse(await readFile(join(root, path), 'utf8'));
  assert.equal(payload.format, 'quiz-authoring-materials');
  assert.equal(payload.questionCount, 100);
  assert.equal(payload.context.references.filter((r) => r.kind === 'diff').length, 11);
  assert.equal(payload.files.filter((f) => f.kind === 'code').length, 22);
  assert.equal(payload.files.find((f) => f.kind === 'code').content, 'full source\n'.repeat(4000));
});

test('a committed manual PR file is answerable and returns its URL without AI generation or an import', async (t) => {
  const root = await temporaryRoot(t);
  const appRoot = join(root, 'apps/quiz');
  const artifact = pullRequestFixture();
  artifact.pullRequest.repository = 'another/project';
  for (const reference of artifact.references) reference.repository = 'another/project';
  const path = questionFilePath(artifact);
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), JSON.stringify(artifact));
  await writeFile(join(appRoot, 'wrangler.jsonc'), JSON.stringify({ vars: { QUESTION_REPOSITORY: repository } }));
  const git = async (...args) => (await exec('git', args, { cwd: root })).stdout.trim();
  for (const args of [['init', '--quiet'], ['config', 'user.name', 'Quiz test'], ['config', 'user.email', 'quiz@example.com'], ['add', '.'], ['commit', '--quiet', '-m', 'Add a manually authored PR quiz']]) await git(...args);
  const catalog = await buildQuestionCatalog({ app: pathToFileURL(`${appRoot}/`) });
  assert.equal(catalog.length, 1);
  const app = await startQuizWorker({ github: true, questionCatalog: catalog });
  t.after(() => app.mf.dispose());
  const anonymous = app.anonymousClient();
  const listed = await (await anonymous('/api/question-sets')).json();
  assert.equal(listed.sets[0].id, catalog[0].id);
  const set = await (await anonymous(`/api/question-sets/${catalog[0].id}`)).json();
  assert.equal(set.revision.commit, await git('rev-parse', 'HEAD'));
  assert.equal(set.solutions, undefined);
  await (await app.mf.getWorker()).scheduled();
  for (let i = 0; i < 100 && !app.githubWrites.some((w) => w.path.endsWith('/comments')); i++) await new Promise((r) => setTimeout(r, 30));
  const comment = app.githubWrites.find((w) => w.path.endsWith('/comments'));
  assert.equal(comment.path, '/repos/another/project/issues/194/comments');
  assert.ok(comment.body.body.includes(`https://reader.test/quiz?set=${set.id}`));
  const started = await (await anonymous(`/api/question-sets/${set.id}/attempts`, { method: 'POST', body: {} })).json();
  const choice = set.questions[0];
  const answered = await anonymous(`/api/attempts/${started.id}/instant-answers`, { method: 'POST', body: { questionId: choice.id, answer: artifact.solutions[choice.id].answer } });
  assert.equal(answered.status, 200);
  assert.equal((await answered.json()).results[0].score, choice.points);
  assert.equal(app.executions.size, 0);
  assert.equal((await anonymous(`/api/attempts/${started.id}/grading-requests`, { method: 'POST', body: {} })).status, 401);
});
