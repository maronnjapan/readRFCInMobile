import { gradingInstructions, gradingPromptVersion } from '../prompts.js';
import { HttpError, fail, validateAnswers, initialResults, validateImplementationMode } from '../contracts.js';
import { isImmediate, needsGrading, sameAnswer } from '../../shared/quiz-types.js';
import { now } from '../http.js';
import { parseAttemptSet, getSet, getAttempt, instantProgress, attemptView } from '../store.js';
import { createAiJob, enforceAiLimit, requestPullRequestSync } from './ai-jobs.js';
import { registerSet } from '../question-files.js';

export async function startAttempt(env, user, setId, implementationMode = 'code') {
  validateImplementationMode(implementationMode);
  const set = await getSet(env, setId);
  await registerSet(env, set);
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO attempts (id, set_id, owner, anonymous_owner, implementation_mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, set.id, user.id, user.anonymousId || null, implementationMode, now(), now()).run();
  return attemptView(env, await getAttempt(env, id, user));
}

async function completeAnswers(env, row, setRow, submitted) {
  const set = parseAttemptSet(setRow, row);
  const answers = validateAnswers(submitted, set);
  const encoded = JSON.stringify(answers);
  const results = initialResults(set, JSON.parse(setRow.solutions_json), answers);
  const status = set.questions.some(needsGrading) ? 'saved' : 'graded';
  await env.DB.prepare("UPDATE attempts SET answers_json = ?, results_json = ?, status = ?, updated_at = ? WHERE id = ? AND answers_json IS NULL")
    .bind(encoded, JSON.stringify(results), status, now(), row.id).run();
  const saved = await getAttempt(env, row.id, { id: row.owner });
  if (saved.answers_json !== encoded) throw new HttpError(409, '回答は送信済みです。新しい回答を開始してください。');
  await requestPullRequestSync(env, row.set_id);
  return attemptView(env, saved);
}

export async function saveInstantAnswers(env, user, id, body) {
  const row = await getAttempt(env, id, user);
  const setRow = await getSet(env, row.set_id);
  const set = parseAttemptSet(setRow, row);
  const question = set.questions.find((q) => q.id === body?.questionId && isImmediate(q));
  if (!question) fail('選択式または並べ替えの問題を指定してください。');
  const answer = validateAnswers({ [question.id]: body.answer }, { questions: [question] })[question.id];
  if (row.answers_json) {
    if (!sameAnswer(JSON.parse(row.answers_json)[question.id], answer)) throw new HttpError(409, 'この問題は回答済みです。');
    return attemptView(env, row);
  }
  const immediate = set.questions.filter(isImmediate);
  const progress = await instantProgress(env, row, set);
  if (!Object.hasOwn(progress.answers, question.id)) {
    const next = immediate.find((q) => !Object.hasOwn(progress.answers, q.id));
    if (next?.id !== question.id) throw new HttpError(409, '表示中の問題から順番に回答してください。');
    const result = initialResults({ questions: [question] }, JSON.parse(setRow.solutions_json), { [question.id]: answer })[0];
    const insert = env.DB.prepare('INSERT OR IGNORE INTO instant_answers (attempt_id, question_id, answer_json, result_json, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, question.id, JSON.stringify(answer), JSON.stringify(result), now());
    const proposed = { ...progress.answers, [question.id]: answer };
    if (!set.questions.some(needsGrading) && immediate.every((q) => Object.hasOwn(proposed, q.id))) {
      const answers = validateAnswers(proposed, set);
      const results = initialResults(set, JSON.parse(setRow.solutions_json), answers);
      // 最後の1問と全体の完了状態を一緒に保存する。競合で負けた回答では完了させない。
      await env.DB.batch([insert,
        env.DB.prepare("UPDATE attempts SET answers_json = ?, results_json = ?, status = 'graded', updated_at = ? WHERE id = ? AND answers_json IS NULL AND (SELECT COUNT(*) FROM instant_answers WHERE attempt_id = ?) = ? AND EXISTS (SELECT 1 FROM instant_answers WHERE attempt_id = ? AND question_id = ? AND answer_json = ?)")
          .bind(JSON.stringify(answers), JSON.stringify(results), now(), id, id, immediate.length, id, question.id, JSON.stringify(answer)),
      ]);
    } else await insert.run();
  }
  const saved = await instantProgress(env, row, set);
  if (!sameAnswer(saved.answers[question.id], answer)) throw new HttpError(409, 'この問題は回答済みです。');
  if (!set.questions.some(needsGrading) && immediate.every((q) => Object.hasOwn(saved.answers, q.id))) {
    return completeAnswers(env, row, setRow, saved.answers);
  }
  await env.DB.prepare('UPDATE attempts SET updated_at = ? WHERE id = ? AND answers_json IS NULL').bind(now(), id).run();
  return attemptView(env, await getAttempt(env, id, user));
}

export async function saveWrittenAnswers(env, user, id, submitted) {
  let row = await getAttempt(env, id, user);
  const setRow = await getSet(env, row.set_id);
  const set = parseAttemptSet(setRow, row);
  if (!submitted || typeof submitted !== 'object' || Array.isArray(submitted) || !Object.keys(submitted).length) fail('回答を指定してください。');
  const submittedQuestions = set.questions.filter((q) => Object.hasOwn(submitted, q.id));
  validateAnswers(submitted, { questions: submittedQuestions });
  const immediate = await instantProgress(env, row, set);
  for (let retry = 0; retry < 3; retry++) {
    const saved = row.answers_json ? JSON.parse(row.answers_json) : { ...immediate.answers, ...JSON.parse(row.written_answers_json) };
    for (const question of set.questions.filter(isImmediate)) {
      if (!Object.hasOwn(saved, question.id)) throw new HttpError(409, '先に選択式・並べ替えの問題を1問ずつ回答してください。');
    }
    for (const question of submittedQuestions) {
      if (Object.hasOwn(saved, question.id) && !sameAnswer(saved[question.id], submitted[question.id])) throw new HttpError(409, '保存済みの回答は変更できません。');
    }
    if (row.answers_json) return attemptView(env, row);
    const proposed = { ...saved, ...submitted };
    let missing = false;
    for (const question of set.questions.filter(needsGrading)) {
      if (!Object.hasOwn(proposed, question.id)) missing = true;
      else if (missing) throw new HttpError(409, '表示中の問題から順番に回答してください。');
    }
    // 途中保存にも全体の文字数制限を適用する。
    const answeredQuestions = set.questions.filter((q) => Object.hasOwn(proposed, q.id));
    const answers = validateAnswers(proposed, { questions: answeredQuestions });
    const completed = answeredQuestions.length === set.questions.length;
    const status = completed ? (set.questions.some(needsGrading) ? 'saved' : 'graded') : 'answering';
    const written = Object.fromEntries(set.questions.filter((q) => needsGrading(q) && Object.hasOwn(answers, q.id)).map((q) => [q.id, answers[q.id]]));
    const results = completed ? initialResults(set, JSON.parse(setRow.solutions_json), answers) : null;
    // 比較して更新することで、別タブからの保存による上書き・回答の消失を防ぐ。
    const update = await env.DB.prepare('UPDATE attempts SET written_answers_json = ?, answers_json = ?, results_json = ?, status = ?, updated_at = ? WHERE id = ? AND answers_json IS NULL AND written_answers_json = ?')
      .bind(JSON.stringify(written), completed ? JSON.stringify(answers) : null, results ? JSON.stringify(results) : null,
        status, now(), id, row.written_answers_json).run();
    row = await getAttempt(env, id, user);
    if (update.meta.changes) {
      if (completed) await requestPullRequestSync(env, row.set_id);
      return attemptView(env, row);
    }
  }
  throw new HttpError(409, '別の画面で回答が保存されました。再読み込みして続けてください。');
}

export async function requestWrittenGrading(env, user, id) {
  if (!user.authenticated) throw new HttpError(401, '記述式・実装の AI 採点にはログインが必要です。');
  const attempt = await getAttempt(env, id, user);
  if (attempt.owner !== user.id && !attempt.owner.startsWith('guest:')) throw new HttpError(403, 'この回答の AI 採点を依頼する権限がありません。');
  if (!attempt.answers_json) throw new HttpError(409, '先に回答を保存してください。');
  if (attempt.status === 'graded') return attemptView(env, attempt);
  const row = await getSet(env, attempt.set_id);
  const set = parseAttemptSet(row, attempt);
  const solutions = JSON.parse(row.solutions_json);
  const existing = await env.DB.prepare("SELECT id FROM ai_jobs WHERE target_id = ? AND operation = 'answers.grade' AND status IN ('queued', 'dispatching', 'submitted')").bind(id).first();
  if (existing) return { id: existing.id, status: 'queued' };
  await enforceAiLimit(env, user);
  if (attempt.owner !== user.id) {
    await env.DB.prepare('UPDATE attempts SET owner = ? WHERE id = ? AND owner = ?').bind(user.id, id, attempt.owner).run();
    const claimed = await getAttempt(env, id, user);
    if (claimed.owner !== user.id) throw new HttpError(403, 'この回答の AI 採点を依頼する権限がありません。');
  }
  const jobId = await createAiJob(env, { operation: 'answers.grade', target: id, owner: user.id, context: { setId: set.id, revision: set.revision },
    input: { instructions: gradingInstructions, promptVersion: gradingPromptVersion, revision: set.revision, references: set.references, sourceMaterials: JSON.parse(row.materials_json),
      questions: set.questions.filter(needsGrading).map((q) => ({ ...q, solution: solutions[q.id], answer: JSON.parse(attempt.answers_json)[q.id] })) },
    profile: env.GRADING_PROFILE || 'quiz-written-v1' });
  await env.DB.prepare("UPDATE attempts SET status = 'grading', updated_at = ? WHERE id = ? AND status IN ('saved', 'grading_failed')").bind(now(), id).run();
  return { id: jobId, status: 'queued' };
}
