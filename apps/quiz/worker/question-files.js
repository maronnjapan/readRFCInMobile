import catalog from '../.wrangler/question-catalog.json' with { type: 'json' };
import { validateSet, HttpError } from './contracts.js';
import { publicQuestionFile } from './github.js';

export function fileSetRow(artifact, revision, id) {
  const validated = validateSet(artifact, { published: true });
  return { id, logical_id: artifact.id, title: artifact.title, spec_id: artifact.spec?.id || '',
    revision_json: JSON.stringify(revision), public_json: JSON.stringify(validated.public),
    solutions_json: JSON.stringify(validated.solutions), materials_json: JSON.stringify(validated.materials),
    pr_json: artifact.pullRequest ? JSON.stringify(validated.public.pullRequest) : null };
}

const bundled = catalog.map(({ artifact, revision, id }) => fileSetRow(artifact, revision, id));
export const bundledSets = (env) => bundled.filter((row) => JSON.parse(row.revision_json).repository === env.QUESTION_REPOSITORY);

// 固定 SHA の取得結果だけを短期キャッシュし、問題本文は DB に保存しない。
const files = new Map();
export async function loadFileSet(env, registry) {
  const revision = JSON.parse(registry.revision_json);
  const key = `${registry.id}:${env.QUESTION_REPOSITORY}:${env.QUESTION_DEFAULT_BRANCH || 'main'}`;
  let cached = files.get(key);
  if (!cached || cached.expires < Date.now()) {
    const artifact = await publicQuestionFile(env, revision.repository, revision.commit, revision.path);
    cached = { row: fileSetRow(artifact, revision, registry.id), expires: Date.now() + 300000 };
    if (files.size >= 100) files.delete(files.keys().next().value);
    files.set(key, cached);
  }
  return cached.row;
}

export async function registerSet(env, row) {
  if (!env.DB) throw new HttpError(503, '回答保存サービスの設定が必要です。');
  // 既存スキーマとの互換性のため列は維持し、出題に必要な版と一覧用メタデータだけ保存する。
  await env.DB.prepare('INSERT OR IGNORE INTO question_sets (id, logical_id, title, spec_id, revision_json, public_json, solutions_json, materials_json, pr_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(row.id, row.logical_id, row.title, row.spec_id, row.revision_json,
      JSON.stringify({ spec: JSON.parse(row.public_json).spec }), '{}', '{}', row.pr_json, Math.floor(Date.now() / 1000)).run();
}
