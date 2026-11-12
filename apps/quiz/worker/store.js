import { HttpError } from './contracts.js';

export const parseSet = (row) => ({ id: row.id, revision: JSON.parse(row.revision_json), ...JSON.parse(row.public_json) });
export const getSet = async (env, id) => {
  const row = await env.DB.prepare('SELECT * FROM question_sets WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, '問題セットが見つかりません。');
  return row;
};
export async function listQuestionSets(env, spec) {
  const query = spec
    ? env.DB.prepare('SELECT * FROM question_sets WHERE spec_id = ? ORDER BY created_at DESC LIMIT 100').bind(spec)
    : env.DB.prepare('SELECT * FROM question_sets ORDER BY created_at DESC LIMIT 100');
  const rows = await query.all();
  return rows.results.map((row) => ({ id: row.id, title: row.title, spec: JSON.parse(row.public_json).spec,
    pullRequest: JSON.parse(row.pr_json || 'null'), revision: JSON.parse(row.revision_json) }));
}
export async function listAttempts(env, setId, owner) {
  const rows = await env.DB.prepare('SELECT id, status, created_at FROM attempts WHERE set_id = ? AND owner = ? ORDER BY created_at DESC LIMIT 20')
    .bind(setId, owner).all();
  return rows.results;
}
export async function getAttempt(env, id, user) {
  const row = await env.DB.prepare('SELECT * FROM attempts WHERE id = ? AND owner = ?').bind(id, user.id).first();
  if (!row) throw new HttpError(404, '回答が見つかりません。');
  return row;
}
export async function instantProgress(env, row, set) {
  // マイグレーション後、旧 Worker の切り替えまでに保存された選択式も引き継ぐ。
  await env.DB.prepare('INSERT OR IGNORE INTO instant_answers (attempt_id, question_id, answer_json, result_json, created_at) SELECT attempt_id, question_id, CAST(answer AS TEXT), result_json, created_at FROM choice_answers WHERE attempt_id = ?').bind(row.id).run();
  const rows = await env.DB.prepare('SELECT question_id, answer_json, result_json FROM instant_answers WHERE attempt_id = ?').bind(row.id).all();
  return {
    answers: Object.fromEntries(rows.results.map((r) => [r.question_id, JSON.parse(r.answer_json)])),
    results: set.questions.flatMap((q) => {
      const saved = rows.results.find((r) => r.question_id === q.id);
      return saved ? [JSON.parse(saved.result_json)] : [];
    }),
  };
}
export async function attemptView(env, row) {
  const set = parseSet(await getSet(env, row.set_id));
  const progress = row.answers_json ? null : await instantProgress(env, row, set);
  return { id: row.id, status: row.status, completed: Boolean(row.answers_json), set,
    answers: row.answers_json ? JSON.parse(row.answers_json) : progress.results.length ? progress.answers : null,
    results: row.results_json ? JSON.parse(row.results_json) : progress.results.length ? progress.results : null,
    grading: row.grading_json ? JSON.parse(row.grading_json) : null };
}
