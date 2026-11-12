import { cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { buildReaderAssets } from '../../../scripts/build-assets.mjs';

const app = new URL('../', import.meta.url);
const output = new URL('dist/', app);

// 本文へ戻れるよう、公開用リーダーと問題画面を同じオリジンに配置する。
await buildReaderAssets(output);
await cp(new URL('web/quiz.css', app), new URL('quiz.css', output));
await build({
  entryPoints: [fileURLToPath(new URL('web/client.jsx', app))],
  outfile: fileURLToPath(new URL('src/quiz-page.js', output)),
  bundle: true, format: 'esm', target: 'es2022',
  tsconfigRaw: { compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'hono/jsx/dom' } },
});
// worker/・questions/・採点基準・設定・秘密情報は配信しない。
