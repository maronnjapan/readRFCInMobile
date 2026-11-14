import { cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { buildReaderAssets } from '../../../scripts/build-assets.mjs';
import { buildQuestionCatalog } from './build-question-catalog.mjs';
import { builtinModules } from 'node:module';
import { loadTypeScriptLibraries } from './typescript-libs.mjs';

const app = new URL('../', import.meta.url);
const output = new URL('dist/', app);
await buildQuestionCatalog();

// 本文へ戻れるよう、公開用リーダーと問題画面を同じオリジンに配置する。
await buildReaderAssets(output);
await cp(new URL('web/quiz.css', app), new URL('quiz.css', output));
// 型解析はエディタから切り離し、必要なときにWeb Workerで読み込む。
await build({
  entryPoints: { 'typescript-worker': fileURLToPath(new URL('web/typescript-worker.js', app)) },
  outdir: fileURLToPath(new URL('src/', output)), bundle: true, minify: true, format: 'esm', platform: 'browser', target: 'es2022',
  external: builtinModules.flatMap((name) => [name, `node:${name}`]),
  plugins: [{ name: 'typescript-libraries', setup(builder) {
    builder.onResolve({ filter: /^quiz:typescript-libs$/ }, () => ({ path: 'libraries', namespace: 'typescript-libraries' }));
    builder.onLoad({ filter: /.*/, namespace: 'typescript-libraries' }, async () => ({ contents: JSON.stringify(await loadTypeScriptLibraries()), loader: 'json' }));
  } }],
});
await build({
  entryPoints: { 'quiz-page': fileURLToPath(new URL('web/client.jsx', app)) },
  outdir: fileURLToPath(new URL('src/', output)),
  bundle: true, minify: true, splitting: true, chunkNames: 'chunks/[name]-[hash]', format: 'esm', target: 'es2022',
  tsconfigRaw: { compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'hono/jsx/dom' } },
});
// worker/・questions/・採点基準・設定・秘密情報は配信しない。
