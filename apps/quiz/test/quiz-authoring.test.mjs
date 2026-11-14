import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildContext } from '../tools/authoring/context.mjs';
import { questionFilePath } from '../shared/question-paths.js';

test('authoring reads a fixed spec and public PR base/head code from a separate repository', async () => {
  const root = await mkdtemp(join(tmpdir(), 'quiz-authoring-'));
  const configRoot = join(root, 'apps/quiz');
  const exec = promisify(execFile);
  const git = (...args) => exec('git', args, { cwd: root });
  try {
    await mkdir(join(root, 'specs'));
    await mkdir(join(configRoot, 'specs'), { recursive: true });
    await writeFile(join(root, '.gitignore'), '.authoring-work/\n');
    await writeFile(join(configRoot, 'specs/index.json'), JSON.stringify([{ id: 'jwt', title: 'JWT audience', status: 'proposed', path: 'specs/jwt.txt', mapping: 'mapping.json' }]));
    await writeFile(join(root, 'specs/jwt.txt'), 'The server MUST validate the audience.\n');
    await writeFile(join(configRoot, 'mapping.json'), JSON.stringify({ searchTerms: ['audience'] }));
    await writeFile(join(configRoot, 'code-sources.yaml'), 'sources:\n  - id: product\n    repository: example/product\n    branch: main\n    specIds: [jwt]\n    paths: [src/, test/]\n');
    await git('init', '--quiet'); await git('config', 'user.name', 'Quiz test'); await git('config', 'user.email', 'quiz@example.com');
    await git('add', '.'); await git('commit', '--quiet', '-m', 'Add specification');
    await writeFile(join(root, 'specs/jwt.txt'), 'UNCOMMITTED CONTENT MUST NOT BE USED');
    const calls = [];
    const head = 'a'.repeat(40), base = 'b'.repeat(40);
    const github = async (path) => {
      calls.push(path);
      if (path === '/repos/example/product') return { private: false };
      if (path.endsWith('/pulls/7')) return { head: { sha: head, repo: { private: false } }, base: { sha: base } };
      if (path.includes('/compare/')) return { merge_base_commit: { sha: base } };
      if (path.includes('/pulls/7/files')) return [{ filename: 'src/auth.js', status: 'modified', patch: '@@ -1 +1 @@\n-old()\n+validateAudience()' }];
      if (path.includes('/git/trees/')) return { truncated: false, tree: ['src/auth.js', 'test/auth.test.js', 'private/secret.txt'].map((path) => ({ path, type: 'blob' })) };
      if (path.includes('/contents/')) {
        const content = path.includes(`ref=${base}`) ? 'oldAudienceValidation();' : 'throw new Error("untrusted code must never be executed");\nvalidateAudience(jwt);';
        return { encoding: 'base64', size: content.length, content: Buffer.from(content).toString('base64') };
      }
      throw new Error(`Unexpected GitHub request ${path}`);
    };
    const payload = await buildContext({ root, configRoot, specId: 'jwt', codeSource: 'product', prNumber: 7, questionRepository: 'example/specifications', github });
    assert.equal(payload.context.spec.repository, 'example/specifications');
    assert.equal(payload.context.spec.status, 'proposed');
    assert.equal(payload.context.pullRequest.headSha, head);
    assert.ok(payload.context.references.some((r) => r.kind === 'spec' && r.excerpt.includes('MUST validate')));
    assert.equal(payload.context.references.some((r) => r.excerpt.includes('UNCOMMITTED')), false);
    assert.ok(payload.context.references.some((r) => r.kind === 'diff' && r.commit === head));
    assert.ok(payload.context.references.some((r) => r.kind === 'code' && r.commit === base));
    assert.ok(payload.context.references.some((r) => r.path.startsWith('test/')));
    assert.equal(calls.some((p) => p.includes('private/')), false);
    assert.ok((await readFile(join(configRoot, '.authoring-work/example_product', head, 'src/auth.js'), 'utf8')).includes('untrusted code'));
    assert.match((await git('check-ignore', 'apps/quiz/.authoring-work/example_product')).stdout, /authoring-work/);
    await assert.rejects(buildContext({ root, configRoot, specId: 'jwt', codeSource: 'product', questionRepository: 'example/specifications', github: async () => ({ private: true }) }), /公開コード/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

async function authoringFixture(t, { files, discussion = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'quiz-pr-context-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const configRoot = join(root, 'apps/quiz');
  await mkdir(join(configRoot, 'specs'), { recursive: true });
  await writeFile(join(configRoot, 'specs/index.json'), JSON.stringify([{ id: 'oauth', title: 'OAuth', status: 'adopted', path: 'spec.txt', mapping: 'mapping.json' }]));
  await writeFile(join(configRoot, 'mapping.json'), JSON.stringify({ searchTerms: ['client_credentials'] }));
  await writeFile(join(configRoot, 'code-sources.yaml'), JSON.stringify({ sources: [{ id: 'product', repository: 'example/product', branch: 'main', specIds: ['oauth'], paths: ['src/', 'test/'] }] }));
  await writeFile(join(root, 'spec.txt'), Array.from({ length: 1500 }, (_, i) => i > 1300 && i < 1310 ? 'client_credentials MUST authenticate the confidential client.' : `Specification paragraph ${i}: unrelated requirements and background.`).join('\n'));
  const run = promisify(execFile);
  for (const args of [['init', '--quiet'], ['config', 'user.name', 'Quiz test'], ['config', 'user.email', 'quiz@example.com'], ['add', '.'], ['commit', '--quiet', '-m', 'Specification']]) await run('git', args, { cwd: root });
  const head = 'a'.repeat(40), base = 'b'.repeat(40), calls = [];
  files ||= [{ filename: 'src/auth.js', status: 'modified', patch: '@@ -1 +1 @@\n-old()\n+authenticate()' }];
  const github = async (path) => {
    calls.push(path);
    if (path === '/repos/example/product') return { private: false };
    if (path.endsWith('/pulls/7')) return { title: 'Authenticate the client', body: 'Validate credentials before issuing the token.', comments: discussion ? 1 : 0, review_comments: discussion ? 1 : 0,
      changed_files: files.length, head: { sha: head, repo: { private: false } }, base: { sha: base } };
    if (path.includes('/compare/')) return { merge_base_commit: { sha: base } };
    if (path.includes('/pulls/7/files')) return files;
    if (path.includes('/issues/7/comments')) return [{ id: 1, body: 'Also cover invalid client credentials.' }];
    if (path.includes('/pulls/7/comments')) return [{ id: 2, body: 'Review: reject missing credentials.' }];
    if (path.includes('/git/trees/')) return { truncated: false, tree: files.filter((f) => f.status !== 'removed').map((f) => ({ type: 'blob', path: f.filename })) };
    if (path.includes('/contents/')) {
      if (path.includes(`ref=${head}`) && files.some((f) => f.status === 'removed' && path.includes(f.filename))) throw new Error('A removed file must not be read at HEAD');
      const content = path.includes(`ref=${base}`) ? 'old();' : 'authenticate();';
      return { encoding: 'base64', size: content.length, content: Buffer.from(content).toString('base64') };
    }
    throw new Error(`Unexpected request: ${path}`);
  };
  return { root, configRoot, head, base, calls, github, codeSource: 'product', prNumber: 7, questionRepository: 'example/specifications' };
}

test('PR-only authoring captures the description and review snapshot without inventing a specification', async (t) => {
  const fixture = await authoringFixture(t, { discussion: true });
  const { context, material } = await buildContext(fixture);
  assert.equal(context.spec, null);
  assert.equal(context.pullRequest.headSha, fixture.head);
  const snapshot = context.references.find((r) => r.kind === 'pull_request');
  assert.match(snapshot.excerpt, /Validate credentials/);
  assert.match(snapshot.excerpt, /Review: reject missing/);
  assert.match(snapshot.excerpt, /Also cover invalid/);
  assert.match(snapshot.excerpt, /selectedFiles/);
  assert.match(material, /仕様は指定されていません/);
  assert.match(questionFilePath(context), new RegExp(`/pr/example/product/7/${context.id}.json$`));
});

test('PR preparation includes every changed file without eight-file parts or a forty-reference cap', async (t) => {
  const files = Array.from({ length: 43 }, (_, i) => ({ filename: `src/file-${String(i).padStart(2, '0')}.js`, status: 'modified', patch: '@@ -1 +1 @@\n-old()\n+newCode()' }));
  const fixture = await authoringFixture(t, { files });
  const payload = await buildContext(fixture);
  assert.deepEqual(payload.context.references.filter((r) => r.kind === 'diff').map((r) => r.path), files.map((f) => f.filename));
  assert.ok(payload.context.references.length > 40);
  assert.equal(payload.files.filter((f) => f.kind === 'code').length, 86);
  assert.equal(payload.format, 'quiz-authoring-materials');
});

test('focus paths select a subject without restricting it to configured directories', async (t) => {
  const fixture = await authoringFixture(t);
  const all = await buildContext(fixture);
  const focused = await buildContext({ ...fixture, focusPaths: ['src/auth.js'] });
  assert.notEqual(all.context.id, focused.context.id);
  await assert.rejects(buildContext({ ...fixture, focusPaths: ['../secrets'] }), /対象パス/);
  await assert.rejects(buildContext({ ...fixture, focusPaths: ['private/'] }), /変更がありません/);
  await assert.rejects(buildContext({ ...fixture, focusPaths: ['src/missing.js'] }), /変更がありません/);
  const outside = await authoringFixture(t, { files: [{ filename: 'new-directory/feature.js', status: 'added', patch: '@@ -0,0 +1 @@\n+feature()' }] });
  assert.ok((await buildContext(outside)).context.references.some((r) => r.path === 'new-directory/feature.js'));
});

test('removed and renamed files retain their full before versions, including formerly excluded paths', async (t) => {
  const fixture = await authoringFixture(t, { files: [
    { filename: 'src/removed.js', status: 'removed', patch: '@@ -1 +0,0 @@\n-old()' },
    { filename: 'src/moved.js', previous_filename: 'private/moved.js', status: 'renamed', patch: '@@ -1 +1 @@\n-old()\n+newCode()' },
  ] });
  const { context } = await buildContext(fixture);
  assert.equal(context.references.filter((r) => r.kind === 'diff').length, 2);
  assert.ok(context.references.some((r) => r.path === 'src/removed.js' && r.commit === fixture.base));
  assert.equal(fixture.calls.some((p) => p.includes('contents/private/')), true);
});

test('an unregistered repository can supply PR materials and specification selection is independent of source mappings', async (t) => {
  const fixture = await authoringFixture(t);
  const payload = await buildContext({ ...fixture, codeSource: 'another/project', specId: 'oauth',
    github: (path) => fixture.github(path.replace('/repos/another/project', '/repos/example/product')) });
  assert.equal(payload.context.pullRequest.repository, 'another/project');
  assert.ok(payload.files.some((f) => f.kind === 'spec'));
});

test('material files preserve full code, PR text and all discussion pages independently of AI excerpts', async (t) => {
  const fixture = await authoringFixture(t, { discussion: true });
  const text = 'full source line\n'.repeat(2000);
  const payload = await buildContext({ ...fixture, github: async (path) => {
    if (path.includes('/contents/')) return { encoding: 'base64', content: Buffer.from(text).toString('base64') };
    if (path.includes('/issues/7/comments')) return path.endsWith('page=1') ? Array.from({ length: 100 }, (_, i) => ({ id: i, body: 'Discussion'.repeat(100) })) : [{ id: 101, body: 'Last page retained' }];
    return fixture.github(path);
  } });
  assert.equal(payload.files.find((f) => f.kind === 'code').content, text);
  assert.match(payload.files.find((f) => f.kind === 'pull_request').content, /Last page retained/);
  assert.ok(payload.context.references.find((r) => r.kind === 'code').excerpt.length <= 3000);
  assert.ok(fixture.calls.every((p) => !p.includes('/api/authoring')));
});

test('specification lookup finds relevant passages beyond the former 40000-character prefix', async (t) => {
  const fixture = await authoringFixture(t);
  const { context } = await buildContext({ ...fixture, specId: 'oauth' });
  const selected = context.references.filter((r) => r.kind === 'spec');
  assert.ok(selected.some((r) => r.startLine > 1000 && r.excerpt.includes('client_credentials MUST')));
  assert.ok(selected.some((r) => r.startLine === 1));
  assert.ok(selected.every((r) => r.commit === context.spec.commit));
  assert.ok(context.references.length <= 40);
});

test('PR material uses the merge base and rejects a head update during collection', async (t) => {
  const fixture = await authoringFixture(t);
  const mergeBase = 'c'.repeat(40);
  const payload = await buildContext({ ...fixture, github: (path) => path.includes('/compare/') ? { merge_base_commit: { sha: mergeBase } } : fixture.github(path) });
  assert.equal(payload.context.pullRequest.baseSha, mergeBase);
  assert.ok(fixture.calls.some((p) => p.includes(`/contents/src/auth.js?ref=${mergeBase}`)));
  let reads = 0;
  await assert.rejects(buildContext({ ...fixture, github: async (path) => {
    const result = await fixture.github(path);
    if (path.endsWith('/pulls/7') && ++reads > 1) result.head.sha = 'd'.repeat(40);
    return result;
  } }), /取得中に PR が更新/);
});
