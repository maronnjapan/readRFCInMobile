import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// 補完は配信元のファイルだけで動かし、CDNへ回答コードを送らない。
export async function loadTypeScriptLibraries() {
  const require = createRequire(import.meta.url);
  const directory = dirname(require.resolve('typescript'));
  const files = {};
  async function standard(name) {
    const path = `/lib/${name}`;
    if (Object.hasOwn(files, path)) return;
    const source = files[path] = await readFile(join(directory, name), 'utf8');
    for (const match of source.matchAll(/<reference lib="([^"]+)"/g)) await standard(`lib.${match[1]}.d.ts`);
  }
  await standard('lib.es2022.full.d.ts');
  async function declarations(directory, prefix) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name), name = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) await declarations(path, name);
      else if (entry.name.endsWith('.d.ts') || entry.name === 'package.json') files[name] = await readFile(path, 'utf8');
    }
  }
  for (const name of ['@types/node', 'undici-types']) {
    await declarations(dirname(require.resolve(`${name}/package.json`)), `/node_modules/${name}`);
  }
  return files;
}
