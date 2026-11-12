import { HttpError, fail, text, uuid, validateContext, validateSet, validateAnswers, initialResults, validateGrades, generationInstructions, gradingInstructions } from './contracts.js';
import { identity, isAuthor, requireAuthor, callbackToken, verifyCallback } from './auth.js';
import { publicQuestionFile, githubConfigured, syncPullRequest } from './github.js';
import { executorClient } from './ai-executor.js';

const now = () => Math.floor(Date.now() / 1000);
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
async function readJson(request) {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) throw new HttpError(415, 'JSON で送信してください。');
  if (Number(request.headers.get('content-length')) > 300000) throw new HttpError(413, '入力が大きすぎます。');
  const reader = request.body?.getReader();
  if (!reader) fail('本文が必要です。');
  const decoder = new TextDecoder();
  let body = '', length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 300000) { await reader.cancel(); throw new HttpError(413, '入力が大きすぎます。'); }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();
  try { return JSON.parse(body); } catch { fail('JSON が正しくありません。'); }
}
const parseSet = (row) => ({ id: row.id, revision: JSON.parse(row.revision_json), ...JSON.parse(row.public_json) });
const getSet = async (env, id) => {
  const row = await env.DB.prepare('SELECT * FROM question_sets WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, '問題セットが見つかりません。');
  return row;
};
async function getAttempt(env, id, user) {
  const row = await env.DB.prepare('SELECT * FROM attempts WHERE id = ? AND owner = ?').bind(id, user.id).first();
  if (!row) throw new HttpError(404, '回答が見つかりません。');
  return row;
}
async function attemptView(env, row) {
  const set = parseSet(await getSet(env, row.set_id));
  return { id: row.id, status: row.status, set, answers: row.answers_json ? JSON.parse(row.answers_json) : null,
    results: row.results_json ? JSON.parse(row.results_json) : null, grading: row.grading_json ? JSON.parse(row.grading_json) : null };
}
async function limited(env, user) {
  const { success } = await env.AI_RATE_LIMITER.limit({ key: user.id });
  if (!success) throw new HttpError(429, 'AI の利用上限に達しました。しばらく待ってください。');
}
async function enqueue(env, id) {
  // D1 の queued 行が outbox。Queue への送信に失敗しても Cron が再送する。
  try { await env.AI_JOBS.send({ kind: 'ai', id }); } catch { /* Cron で回復 */ }
}
async function prSync(env, setId) {
  if (!githubConfigured(env)) return;
  await env.DB.prepare('UPDATE question_sets SET pr_sync_needed = 1 WHERE id = ? AND pr_json IS NOT NULL').bind(setId).run();
  try { await env.AI_JOBS.send({ kind: 'pr-sync', setId }); } catch { /* Cron で回復 */ }
}
async function newJob(env, { operation, target, owner, input, context, profile }) {
  const id = crypto.randomUUID();
  const result = await env.DB.prepare('INSERT OR IGNORE INTO ai_jobs (id, operation, target_id, owner, profile, input_json, context_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, operation, target, owner, profile, JSON.stringify(input), JSON.stringify(context), now(), now()).run();
  const saved = result.meta.changes ? id : (await env.DB.prepare("SELECT id FROM ai_jobs WHERE operation = ? AND target_id = ? AND status IN ('queued', 'dispatching', 'submitted')").bind(operation, target).first()).id;
  await enqueue(env, saved);
  return saved;
}

async function importSet(request, env) {
  const { repository, commit, path } = await readJson(request);
  const artifact = await publicQuestionFile(env, repository, commit, path);
  const validated = validateSet(artifact, { published: true });
  if (path.startsWith('questions/pr/') !== Boolean(artifact.pullRequest)) fail('問題ファイルの配置と PR の情報が一致しません。');
  if (artifact.pullRequest && !(env.CODE_REPOSITORIES || '').split(',').map((s) => s.trim()).includes(artifact.pullRequest.repository)) fail('PR のリポジトリが許可されていません。');
  const revision = { repository, commit, path };
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${repository}@${commit}:${path}`));
  const id = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  await env.DB.prepare('INSERT OR IGNORE INTO question_sets (id, logical_id, title, spec_id, revision_json, public_json, solutions_json, materials_json, pr_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, artifact.id, artifact.title, artifact.spec.id, JSON.stringify(revision), JSON.stringify(validated.public), JSON.stringify(validated.solutions), JSON.stringify(validated.materials), artifact.pullRequest ? JSON.stringify(validated.public.pullRequest) : null, now()).run();
  await prSync(env, id);
  return json({ id, url: `${env.APP_ORIGIN}/quiz?set=${id}`, prIntegration: githubConfigured(env) ? 'queued' : 'not_configured' });
}

async function authorRequest(request, env, user) {
  const body = await readJson(request);
  const context = validateContext(body.context);
  if (!text(body.material, 100000) || !Number.isInteger(body.questionCount) || body.questionCount < 2 || body.questionCount > 10) fail('資料と問題数（2〜10問）が必要です。');
  await limited(env, user);
  const id = await newJob(env, { operation: 'questions.generate', target: context.id, owner: user.id,
    input: { instructions: generationInstructions, questionCount: body.questionCount, context, material: body.material }, context,
    profile: env.AUTHORING_PROFILE || 'quiz-generate-v1' });
  return json({ id, status: 'queued' }, 202);
}

async function saveAnswers(request, env, user, id) {
  const row = await getAttempt(env, id, user);
  const setRow = await getSet(env, row.set_id);
  const set = parseSet(setRow);
  const answers = validateAnswers((await readJson(request))?.answers, set);
  const encoded = JSON.stringify(answers);
  const results = initialResults(set, JSON.parse(setRow.solutions_json), answers);
  const status = set.questions.some((q) => q.type === 'written') ? 'saved' : 'graded';
  await env.DB.prepare("UPDATE attempts SET answers_json = ?, results_json = ?, status = ?, updated_at = ? WHERE id = ? AND answers_json IS NULL")
    .bind(encoded, JSON.stringify(results), status, now(), id).run();
  const saved = await getAttempt(env, id, user);
  if (saved.answers_json !== encoded) throw new HttpError(409, '回答は送信済みです。新しい回答を開始してください。');
  await prSync(env, row.set_id);
  return json(await attemptView(env, saved));
}

async function requestGrade(env, user, id) {
  const attempt = await getAttempt(env, id, user);
  if (!attempt.answers_json) throw new HttpError(409, '先に回答を保存してください。');
  if (attempt.status === 'graded') return json(await attemptView(env, attempt));
  const row = await getSet(env, attempt.set_id);
  const set = parseSet(row);
  const solutions = JSON.parse(row.solutions_json);
  const existing = await env.DB.prepare("SELECT id FROM ai_jobs WHERE target_id = ? AND operation = 'answers.grade' AND status IN ('queued', 'dispatching', 'submitted')").bind(id).first();
  if (existing) return json({ id: existing.id, status: 'queued' }, 202);
  await limited(env, user);
  const jobId = await newJob(env, { operation: 'answers.grade', target: id, owner: user.id, context: { setId: set.id, revision: set.revision },
    input: { instructions: gradingInstructions, revision: set.revision, references: set.references, sourceMaterials: JSON.parse(row.materials_json),
      questions: set.questions.filter((q) => q.type === 'written').map((q) => ({ ...q, solution: solutions[q.id], answer: JSON.parse(attempt.answers_json)[q.id] })) },
    profile: env.GRADING_PROFILE || 'quiz-written-v1' });
  await env.DB.prepare("UPDATE attempts SET status = 'grading', updated_at = ? WHERE id = ? AND status IN ('saved', 'grading_failed')").bind(now(), id).run();
  return json({ id: jobId, status: 'queued' }, 202);
}

async function failJob(env, job, message) {
  await env.DB.batch([
    env.DB.prepare("UPDATE ai_jobs SET status = 'failed', error = ?, input_json = NULL, updated_at = ? WHERE id = ? AND status NOT IN ('completed', 'failed')").bind(message, now(), job.id),
    ...(job.operation === 'answers.grade' ? [env.DB.prepare("UPDATE attempts SET status = 'grading_failed', updated_at = ? WHERE id = ? AND status <> 'graded' AND EXISTS (SELECT 1 FROM ai_jobs WHERE id = ? AND status = 'failed')").bind(now(), job.target_id, job.id)] : []),
  ]);
}

async function receiveResult(request, env) {
  const body = await readJson(request);
  if (!uuid(body.requestId)) fail('リクエスト ID が正しくありません。');
  await verifyCallback(request, body.requestId, env.AI_CALLBACK_SECRET);
  const job = await env.DB.prepare('SELECT * FROM ai_jobs WHERE id = ?').bind(body.requestId).first();
  if (!job) throw new HttpError(404, '実行リクエストが見つかりません。');
  if (['completed', 'failed'].includes(job.status)) return json({ received: true });
  if (body.operation !== job.operation || !['completed', 'failed'].includes(body.status)) fail('実行結果の操作・状態が正しくありません。');
  if (body.status === 'failed') { await failJob(env, job, 'AI の処理に失敗しました。'); return json({ received: true }); }
  let output;
  try {
    if (job.operation === 'questions.generate') {
      const context = JSON.parse(job.context_json);
      output = { ...body.output, ...context, title: body.output?.title || context.title, format: 'spec-understanding-quiz', version: 1, status: 'draft' };
      validateSet(output);
      const requested = JSON.parse(job.input_json).questionCount;
      if (output.questions.length !== requested || !output.questions.some((q) => q.type === 'choice') || !output.questions.some((q) => q.type === 'written')) fail('指定した問題数・形式ではありません。');
    } else {
      const attempt = await env.DB.prepare('SELECT * FROM attempts WHERE id = ?').bind(job.target_id).first();
      const set = parseSet(await getSet(env, attempt.set_id));
      const grades = validateGrades(body.output, set);
      const results = JSON.parse(attempt.results_json).map((r) => grades.find((g) => g.questionId === r.questionId) || r);
      const settings = { profile: job.profile, promptVersion: 1, requestedMaxOutputTokens: 8000, model: typeof body.model === 'string' ? body.model.slice(0, 200) : 'unspecified', usage: body.usage || null, jobId: job.id, gradedAt: now() };
      output = { results, settings };
    }
  } catch { await failJob(env, job, 'AI の出力形式・採点基準・出典を確認できませんでした。'); return json({ received: true }); }
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
  if (job.operation === 'answers.grade') await prSync(env, JSON.parse(job.context_json).setId);
  return json({ received: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      if (!env.DB) throw new HttpError(503, '出題サービスの設定が必要です。');
      if (url.pathname === '/api/ai/results' && request.method === 'POST') return await receiveResult(request, env);
      const user = await identity(request, env);
      if (request.method === 'POST') {
        if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) throw new HttpError(403, '同じサイトから送信してください。');
        if (request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, '同じサイトから送信してください。');
      }
      const path = url.pathname;
      if (path === '/api/quiz/config' && request.method === 'GET') return json({ available: true, canAuthor: isAuthor(user, env), user: user.email || user.id });
      if (path === '/api/question-sets' && request.method === 'GET') {
        const spec = url.searchParams.get('spec');
        const rows = await (spec ? env.DB.prepare('SELECT * FROM question_sets WHERE spec_id = ? ORDER BY created_at DESC LIMIT 100').bind(spec)
          : env.DB.prepare('SELECT * FROM question_sets ORDER BY created_at DESC LIMIT 100')).all();
        return json({ sets: rows.results.map((r) => ({ id: r.id, title: r.title, spec: JSON.parse(r.public_json).spec, pullRequest: JSON.parse(r.pr_json || 'null'), revision: JSON.parse(r.revision_json) })) });
      }
      if (path === '/api/question-sets/import' && request.method === 'POST') { requireAuthor(user, env); return await importSet(request, env); }
      if (path === '/api/authoring/requests' && request.method === 'POST') { requireAuthor(user, env); return await authorRequest(request, env, user); }
      const authorJob = /^\/api\/authoring\/requests\/([a-f0-9-]{36})$/.exec(path);
      if (authorJob && request.method === 'GET') {
        requireAuthor(user, env);
        const job = await env.DB.prepare("SELECT * FROM ai_jobs WHERE id = ? AND operation = 'questions.generate'").bind(authorJob[1]).first();
        if (!job) throw new HttpError(404, '作問ジョブが見つかりません。');
        return json({ id: job.id, status: job.status, error: job.error, artifact: job.status === 'completed' ? JSON.parse(job.output_json) : null });
      }
      const setMatch = /^\/api\/question-sets\/([a-f0-9]{64})(\/attempts)?$/.exec(path);
      if (setMatch) {
        const row = await getSet(env, setMatch[1]);
        if (!setMatch[2] && request.method === 'GET') return json(parseSet(row));
        if (setMatch[2] && request.method === 'GET') {
          const rows = await env.DB.prepare('SELECT id, status, created_at FROM attempts WHERE set_id = ? AND owner = ? ORDER BY created_at DESC LIMIT 20').bind(row.id, user.id).all();
          return json({ attempts: rows.results });
        }
        if (setMatch[2] && request.method === 'POST') {
          const id = crypto.randomUUID();
          await env.DB.prepare('INSERT INTO attempts (id, set_id, owner, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(id, row.id, user.id, now(), now()).run();
          return json(await attemptView(env, await getAttempt(env, id, user)), 201);
        }
      }
      const attempt = /^\/api\/attempts\/([a-f0-9-]{36})(\/(?:answers|grading-requests))?$/.exec(path);
      if (attempt && uuid(attempt[1])) {
        if (!attempt[2] && request.method === 'GET') return json(await attemptView(env, await getAttempt(env, attempt[1], user)));
        if (attempt[2] === '/answers' && request.method === 'POST') return await saveAnswers(request, env, user, attempt[1]);
        if (attempt[2] === '/grading-requests' && request.method === 'POST') return await requestGrade(env, user, attempt[1]);
      }
      return json({ message: 'エンドポイントまたはメソッドが見つかりません。' }, 404);
    } catch (error) {
      if (!(error instanceof HttpError)) console.error('quiz_api_error', { path: url.pathname, name: error.name });
      return json({ message: error instanceof HttpError ? error.message : '処理できませんでした。もう一度お試しください。' }, error instanceof HttpError ? error.status : 500);
    }
  },
  async queue(batch, env) {
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
        const token = await callbackToken(job.id, env.AI_CALLBACK_SECRET);
        const response = await executorClient(env).submit({ requestId: job.id, operation: job.operation, profile: job.profile, input: JSON.parse(job.input_json),
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
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil((async () => {
      await env.DB.prepare("UPDATE ai_jobs SET status = 'queued' WHERE status = 'dispatching' AND updated_at < ?").bind(now() - 120).run();
      const stale = await env.DB.prepare("SELECT * FROM ai_jobs WHERE status IN ('queued', 'dispatching', 'submitted') AND created_at < ? LIMIT 100").bind(now() - 1800).all();
      for (const job of stale.results) await failJob(env, job, 'AI の処理が制限時間内に完了しませんでした。');
      const queued = await env.DB.prepare("SELECT id FROM ai_jobs WHERE status = 'queued' AND updated_at < ? LIMIT 100").bind(now() - 60).all();
      for (const job of queued.results) await enqueue(env, job.id);
      if (githubConfigured(env)) {
        const sets = await env.DB.prepare('SELECT id FROM question_sets WHERE pr_sync_needed = 1 LIMIT 100').all();
        for (const set of sets.results) await prSync(env, set.id);
      }
    })());
  },
};
