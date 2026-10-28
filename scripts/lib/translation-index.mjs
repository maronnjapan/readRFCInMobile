// rfcs/<lang>/・pdfs/<lang>/ に置いた翻訳ファイル (日本語訳など) を、index.json に載せるために読む。
// rfc-store.mjs・pdf-store.mjs・translation-store.mjs から使う。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseTranslation, translatedTitle } from '../../src/translation.js';

// 言語ごとのフォルダ (ja, en, zh-Hant など)
export function translationLangs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^[a-z]{2,3}(?:-[A-Za-z0-9]+)?$/.test(d.name))
    .map((d) => d.name)
    .sort();
}

// <dir>/<lang>/<file> に翻訳ファイルがあれば、その言語で訳した題名を返す ({ ja: "訳した題名" }。題名が未訳なら空文字)
export function translationTitles(dir, file, title) {
  const out = {};
  for (const lang of translationLangs(dir)) {
    const path = join(dir, lang, file);
    if (!existsSync(path)) continue;
    try {
      out[lang] = translatedTitle({ meta: { title } }, parseTranslation(JSON.parse(readFileSync(path, 'utf8')))).trim();
    } catch {
      /* 壊れた翻訳ファイルは一覧に載せない (node scripts/translation.mjs check で分かる) */
    }
  }
  return out;
}
