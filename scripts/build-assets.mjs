import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
// Worker のソース、設定、テスト、秘密情報を静的ファイルとして公開しない。
for (const path of ['index.html', 'quiz.html', 'styles.css', 'quiz.css', 'manifest.webmanifest', 'sw.js', 'src', 'icons', 'vendor', 'rfcs', 'pdfs']) {
  await cp(new URL(path, root), new URL(path, output), { recursive: true });
}
console.log(`Static assets: ${fileURLToPath(output)}`);
