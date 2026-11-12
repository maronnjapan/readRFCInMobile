import { buildAiInput } from '../prompts.js';
import { now } from '../http.js';
import { callbackToken } from '../auth.js';
import { syncPullRequest } from '../github.js';
import { executorClient } from '../ai-executor.js';
import { failJob } from '../services/ai-jobs.js';

export async function dispatchJobs(batch, env) {
  for (const message of batch.messages) {
    const body = message.body;
    if (body.kind === 'pr-sync') {
      try { await syncPullRequest(env, body.setId); message.ack(); } catch { message.retry({ delaySeconds: 60 }); }
      continue;
    }
    const job = await env.DB.prepare('SELECT * FROM ai_jobs WHERE id = ?').bind(body.id || '').first();
    if (!job || ['completed', 'failed', 'submitted'].includes(job.status)) { message.ack(); continue; }
    if (batch.queue.endsWith('-dead')) { await failJob(env, job, 'AI 実行 API に接続できませんでした。'); message.ack(); continue; }
    const claim = await env.DB.prepare("UPDATE ai_jobs SET status = 'dispatching', updated_at = ? WHERE id = ? AND status = 'queued'").bind(now(), job.id).run();
    if (!claim.meta.changes) { message.ack(); continue; }
    try {
      const stored = JSON.parse(job.input_json);
      if (!stored.executorInput) {
        stored.executorInput = buildAiInput(job.operation, stored);
        await env.DB.prepare("UPDATE ai_jobs SET input_json = ? WHERE id = ? AND status = 'dispatching'")
          .bind(JSON.stringify(stored), job.id).run();
      }
      const token = await callbackToken(job.id, env.AI_CALLBACK_SECRET);
      const response = await executorClient(env).submit({ requestId: job.id, operation: job.operation, profile: job.profile, input: stored.executorInput,
        maxOutputTokens: 8000, callback: { url: `${env.APP_ORIGIN}/api/ai/results`, token } });
      if (!response.ok) throw new Error('AI executor rejected request');
      await env.DB.prepare("UPDATE ai_jobs SET status = 'submitted', updated_at = ? WHERE id = ? AND status = 'dispatching'").bind(now(), job.id).run();
      console.log('quiz_ai_submitted', { id: job.id, operation: job.operation, profile: job.profile });
      message.ack();
    } catch {
      await env.DB.prepare("UPDATE ai_jobs SET status = 'queued', updated_at = ? WHERE id = ? AND status = 'dispatching'").bind(now(), job.id).run();
      message.retry({ delaySeconds: 60 });
    }
  }
}
