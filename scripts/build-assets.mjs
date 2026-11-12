import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
export async function buildReaderAssets(output = new URL('dist/', root)) {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const path of ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js', 'src', 'icons', 'vendor', 'rfcs', 'pdfs']) {
    await cp(new URL(path, root), new URL(path, output), { recursive: true });
  }
  console.log(`Reader assets: ${fileURLToPath(output)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await buildReaderAssets();
