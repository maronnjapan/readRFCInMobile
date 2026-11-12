import { HttpError } from '../contracts.js';
import { now } from '../http.js';
import { githubConfigured } from '../github.js';
import { buildAiInput } from '../prompts.js';

export async function enforceAiLimit(env, user) {
  const { success } = await env.AI_RATE_LIMITER.limit({ key: user.id });
  if (!success) throw new HttpError(429, 'AI の利用上限に達しました。しばらく待ってください。');
}
export async function enqueueJob(env, id) {
  // D1 の queued 行が outbox。Queue への送信に失敗しても Cron が再送する。
  try { await env.AI_JOBS.send({ kind: 'ai', id }); } catch { /* Cron で回復 */ }
}
export async function requestPullRequestSync(env, setId) {
  if (!githubConfigured(env)) return;
  await env.DB.prepare('UPDATE question_sets SET pr_sync_needed = 1 WHERE id = ? AND pr_json IS NOT NULL').bind(setId).run();
  try { await env.AI_JOBS.send({ kind: 'pr-sync', setId }); } catch { /* Cron で回復 */ }
}
export async function createAiJob(env, { operation, target, owner, input, context, profile }) {
  const id = crypto.randomUUID();
  const prepared = { executorInput: buildAiInput(operation, input),
    questionCount: input.questionCount, questionCategories: input.questionCategories, promptVersion: input.promptVersion };
  const result = await env.DB.prepare('INSERT OR IGNORE INTO ai_jobs (id, operation, target_id, owner, profile, input_json, context_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, operation, target, owner, profile, JSON.stringify(prepared), JSON.stringify(context), now(), now()).run();
  const saved = result.meta.changes ? id : (await env.DB.prepare("SELECT id FROM ai_jobs WHERE operation = ? AND target_id = ? AND status IN ('queued', 'dispatching', 'submitted')").bind(operation, target).first()).id;
  await enqueueJob(env, saved);
  return saved;
}

export async function failJob(env, job, message) {
  await env.DB.batch([
    env.DB.prepare("UPDATE ai_jobs SET status = 'failed', error = ?, input_json = NULL, updated_at = ? WHERE id = ? AND status NOT IN ('completed', 'failed')").bind(message, now(), job.id),
    ...(job.operation === 'answers.grade' ? [env.DB.prepare("UPDATE attempts SET status = 'grading_failed', updated_at = ? WHERE id = ? AND status <> 'graded' AND EXISTS (SELECT 1 FROM ai_jobs WHERE id = ? AND status = 'failed')").bind(now(), job.target_id, job.id)] : []),
  ]);
}
