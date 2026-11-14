import { fail, validateSet } from '../contracts.js';
import { publicQuestionFile, githubConfigured } from '../github.js';
import { questionKind } from '../../shared/question-paths.js';
import { questionSetId } from '../../shared/question-revisions.js';
import { fileSetRow, registerSet } from '../question-files.js';
import { requestPullRequestSync } from './ai-jobs.js';

export async function publishQuestionSet(env, { repository, commit, path }) {
  const artifact = await publicQuestionFile(env, repository, commit, path);
  validateSet(artifact, { published: true });
  if ((questionKind(path) === 'pr') !== Boolean(artifact.pullRequest)) fail('問題ファイルの配置と PR の情報が一致しません。');
  const revision = { repository, commit, path };
  const id = await questionSetId(revision);
  await registerSet(env, fileSetRow(artifact, revision, id));
  await requestPullRequestSync(env, id);
  return { id, url: `${env.APP_ORIGIN}/quiz?set=${id}`, prIntegration: !artifact.pullRequest ? 'not_requested' : githubConfigured(env) ? 'queued' : 'not_configured' };
}
