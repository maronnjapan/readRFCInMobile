import { fail, validateSet } from '../contracts.js';
import { publicQuestionFile, githubConfigured } from '../github.js';
import { questionKind } from '../../shared/question-paths.js';
import { now } from '../http.js';
import { requestPullRequestSync } from './ai-jobs.js';

export async function publishQuestionSet(env, { repository, commit, path }) {
  const artifact = await publicQuestionFile(env, repository, commit, path);
  const validated = validateSet(artifact, { published: true });
  if ((questionKind(path) === 'pr') !== Boolean(artifact.pullRequest)) fail('問題ファイルの配置と PR の情報が一致しません。');
  if (artifact.pullRequest && !(env.CODE_REPOSITORIES || '').split(',').map((s) => s.trim()).includes(artifact.pullRequest.repository)) fail('PR のリポジトリが許可されていません。');
  const revision = { repository, commit, path };
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${repository}@${commit}:${path}`));
  const id = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  await env.DB.prepare('INSERT OR IGNORE INTO question_sets (id, logical_id, title, spec_id, revision_json, public_json, solutions_json, materials_json, pr_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, artifact.id, artifact.title, artifact.spec.id, JSON.stringify(revision), JSON.stringify(validated.public), JSON.stringify(validated.solutions), JSON.stringify(validated.materials), artifact.pullRequest ? JSON.stringify(validated.public.pullRequest) : null, now()).run();
  await requestPullRequestSync(env, id);
  return { id, url: `${env.APP_ORIGIN}/quiz?set=${id}`, prIntegration: githubConfigured(env) ? 'queued' : 'not_configured' };
}
