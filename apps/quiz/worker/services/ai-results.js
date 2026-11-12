import { HttpError, fail, uuid, validateSet, validateGrades } from '../contracts.js';
import { categoryOf } from '../../shared/quiz-types.js';
import { verifyCallback } from '../auth.js';
import { readJson, now } from '../http.js';
import { parseSet, getSet } from '../store.js';
import { failJob, requestPullRequestSync } from './ai-jobs.js';

export async function receiveAiResult(request, env) {
  const body = await readJson(request);
  if (!uuid(body.requestId)) fail('リクエスト ID が正しくありません。');
  await verifyCallback(request, body.requestId, env.AI_CALLBACK_SECRET);
  const job = await env.DB.prepare('SELECT * FROM ai_jobs WHERE id = ?').bind(body.requestId).first();
  if (!job) throw new HttpError(404, '実行リクエストが見つかりません。');
  if (['completed', 'failed'].includes(job.status)) return { received: true };
  if (body.operation !== job.operation || !['completed', 'failed'].includes(body.status)) fail('実行結果の操作・状態が正しくありません。');
  if (body.status === 'failed') { await failJob(env, job, 'AI の処理に失敗しました。'); return { received: true }; }
  let output;
  try {
    if (job.operation === 'questions.generate') {
      const context = JSON.parse(job.context_json);
      output = { ...body.output, ...context, title: body.output?.title || context.title, format: 'spec-understanding-quiz', version: 1, status: 'draft' };
      validateSet(output);
      const requested = JSON.parse(job.input_json);
      if (output.questions.length !== requested.questionCount || (requested.questionCategories || []).some((category) => !output.questions.some((q) => categoryOf(q) === category))) fail('指定した問題数・カテゴリではありません。');
    } else {
      const attempt = await env.DB.prepare('SELECT * FROM attempts WHERE id = ?').bind(job.target_id).first();
      const set = parseSet(await getSet(env, attempt.set_id));
      const grades = validateGrades(body.output, set);
      const results = JSON.parse(attempt.results_json).map((r) => grades.find((g) => g.questionId === r.questionId) || r);
      const settings = { profile: job.profile, promptVersion: JSON.parse(job.input_json).promptVersion || 1, requestedMaxOutputTokens: 8000, model: typeof body.model === 'string' ? body.model.slice(0, 200) : 'unspecified', usage: body.usage || null, jobId: job.id, gradedAt: now() };
      output = { results, settings };
    }
  } catch { await failJob(env, job, 'AI の出力形式・採点基準・出典を確認できませんでした。'); return { received: true }; }
  const statements = [env.DB.prepare("UPDATE ai_jobs SET status = 'completed', output_json = ?, input_json = NULL, updated_at = ? WHERE id = ? AND status NOT IN ('completed', 'failed')")
    .bind(JSON.stringify(output), now(), job.id)];
  if (job.operation === 'answers.grade') {
    // 同じ callback の並行到着でも採点履歴は一件。問題セットの版と実行設定を保存する。
    statements.push(env.DB.prepare("INSERT OR IGNORE INTO grading_history (job_id, attempt_id, result_json, configuration_json, created_at) SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM ai_jobs WHERE id = ? AND status = 'completed' AND output_json = ?)")
      .bind(job.id, job.target_id, JSON.stringify(output.results), JSON.stringify({ ...output.settings, context: JSON.parse(job.context_json) }), now(), job.id, JSON.stringify(output)));
    statements.push(env.DB.prepare("UPDATE attempts SET results_json = ?, grading_json = ?, status = 'graded', updated_at = ? WHERE id = ? AND status <> 'graded' AND EXISTS (SELECT 1 FROM ai_jobs WHERE id = ? AND status = 'completed' AND output_json = ?)")
      .bind(JSON.stringify(output.results), JSON.stringify(output.settings), now(), job.target_id, job.id, JSON.stringify(output)));
  }
  await env.DB.batch(statements);
  if (job.operation === 'answers.grade') await requestPullRequestSync(env, JSON.parse(job.context_json).setId);
  return { received: true };
}
