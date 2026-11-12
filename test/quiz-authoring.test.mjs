import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildContext } from '../tools/authoring/context.mjs';

test('authoring reads a fixed spec and public PR base/head code from a separate repository', async () => {
  const root = await mkdtemp(join(tmpdir(), 'quiz-authoring-'));
  const exec = promisify(execFile);
  const git = (...args) => exec('git', args, { cwd: root });
  try {
    await mkdir(join(root, 'specs'));
    await writeFile(join(root, '.gitignore'), '.authoring-work/\n');
    await writeFile(join(root, 'specs/index.json'), JSON.stringify([{ id: 'jwt', title: 'JWT audience', status: 'proposed', path: 'specs/jwt.txt', mapping: 'mapping.json' }]));
    await writeFile(join(root, 'specs/jwt.txt'), 'The server MUST validate the audience.\n');
    await writeFile(join(root, 'mapping.json'), JSON.stringify({ searchTerms: ['audience'] }));
    await writeFile(join(root, 'code-sources.yaml'), 'sources:\n  - id: product\n    repository: example/product\n    branch: main\n    specIds: [jwt]\n    paths: [src/, test/]\n');
    await git('init', '--quiet'); await git('config', 'user.name', 'Quiz test'); await git('config', 'user.email', 'quiz@example.com');
    await git('add', '.'); await git('commit', '--quiet', '-m', 'Add specification');
    await writeFile(join(root, 'specs/jwt.txt'), 'UNCOMMITTED CONTENT MUST NOT BE USED');
    const calls = [];
    const head = 'a'.repeat(40), base = 'b'.repeat(40);
    const github = async (path) => {
      calls.push(path);
      if (path === '/repos/example/product') return { private: false };
      if (path.endsWith('/pulls/7')) return { head: { sha: head, repo: { private: false } }, base: { sha: base } };
      if (path.includes('/pulls/7/files')) return [{ filename: 'src/auth.js', status: 'modified', patch: '@@ -1 +1 @@\n-old()\n+validateAudience()' }];
      if (path.includes('/git/trees/')) return { truncated: false, tree: ['src/auth.js', 'test/auth.test.js', 'private/secret.txt'].map((path) => ({ path, type: 'blob' })) };
      if (path.includes('/contents/')) {
        const content = path.includes(`ref=${base}`) ? 'oldAudienceValidation();' : 'throw new Error("untrusted code must never be executed");\nvalidateAudience(jwt);';
        return { encoding: 'base64', size: content.length, content: Buffer.from(content).toString('base64') };
      }
      throw new Error(`Unexpected GitHub request ${path}`);
    };
    const payload = await buildContext({ root, specId: 'jwt', codeSource: 'product', prNumber: 7, questionRepository: 'example/specifications', github });
    assert.equal(payload.context.spec.repository, 'example/specifications');
    assert.equal(payload.context.spec.status, 'proposed');
    assert.equal(payload.context.pullRequest.headSha, head);
    assert.ok(payload.context.references.some((r) => r.kind === 'spec' && r.excerpt.includes('MUST validate')));
    assert.equal(payload.context.references.some((r) => r.excerpt.includes('UNCOMMITTED')), false);
    assert.ok(payload.context.references.some((r) => r.kind === 'diff' && r.commit === head));
    assert.ok(payload.context.references.some((r) => r.kind === 'code' && r.commit === base));
    assert.ok(payload.context.references.some((r) => r.path.startsWith('test/')));
    assert.equal(calls.some((p) => p.includes('private/')), false);
    assert.ok((await readFile(join(root, '.authoring-work/example_product', head, 'src/auth.js'), 'utf8')).includes('untrusted code'));
    assert.match((await git('check-ignore', '.authoring-work/example_product')).stdout, /authoring-work/);
    await assert.rejects(buildContext({ root, specId: 'jwt', codeSource: 'product', questionRepository: 'example/specifications', github: async () => ({ private: true }) }), /公開コード/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
