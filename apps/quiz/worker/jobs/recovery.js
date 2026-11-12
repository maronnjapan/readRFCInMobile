import { now } from '../http.js';
import { githubConfigured } from '../github.js';
import { enqueueJob, failJob, requestPullRequestSync } from '../services/ai-jobs.js';

export function recoverJobs(_event, env, ctx) {
  ctx.waitUntil((async () => {
    await env.DB.prepare("UPDATE ai_jobs SET status = 'queued' WHERE status = 'dispatching' AND updated_at < ?").bind(now() - 120).run();
    const stale = await env.DB.prepare("SELECT * FROM ai_jobs WHERE status IN ('queued', 'dispatching', 'submitted') AND created_at < ? LIMIT 100").bind(now() - 1800).all();
    for (const job of stale.results) await failJob(env, job, 'AI の処理が制限時間内に完了しませんでした。');
    const queued = await env.DB.prepare("SELECT id FROM ai_jobs WHERE status = 'queued' AND updated_at < ? LIMIT 100").bind(now() - 60).all();
    for (const job of queued.results) await enqueueJob(env, job.id);
    if (githubConfigured(env)) {
      const sets = await env.DB.prepare('SELECT id FROM question_sets WHERE pr_sync_needed = 1 LIMIT 100').all();
      for (const set of sets.results) await requestPullRequestSync(env, set.id);
    }
  })());
}
