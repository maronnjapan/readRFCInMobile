import { HttpError, uuid } from '../contracts.js';
import { getSet, parseSet, getAttempt, attemptView, listQuestionSets, listAttempts } from '../store.js';
import { isImmediate, needsGrading } from '../../shared/quiz-types.js';

export function attemptScreen(data, requested) {
  const immediate = data.set.questions.filter(isImmediate);
  const written = data.set.questions.filter(needsGrading);
  const sequence = [...immediate, ...written];
  const answered = (q) => Object.hasOwn(data.answers || {}, q.id);
  const next = sequence.find((q) => !answered(q));
  const selected = sequence.find((q) => q.id === requested && (answered(q) || q.id === next?.id));
  const question = selected || (!data.completed ? next : null);
  return { data, immediate, sequence, question, written, view: question ? isImmediate(question) ? 'instant' : 'written' : 'results' };
}

export async function loadPage(env, user, params) {
  const attemptId = params.get('attempt');
  if (attemptId) {
    if (!uuid(attemptId)) throw new HttpError(404, '回答が見つかりません。');
    const data = await attemptView(env, await getAttempt(env, attemptId, user));
    return { kind: 'attempt', ...attemptScreen(data, params.get('question')) };
  }
  const setId = params.get('set');
  if (setId) {
    if (!/^[a-f0-9]{64}$/.test(setId)) throw new HttpError(404, '問題セットが見つかりません。');
    const set = parseSet(await getSet(env, setId));
    return { kind: 'setup', set, attempts: await listAttempts(env, setId, user) };
  }
  const spec = params.get('spec');
  return { kind: 'list', spec, sets: await listQuestionSets(env, spec) };
}
