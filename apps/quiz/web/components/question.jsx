import { QUESTION_CATEGORIES, ANSWER_TYPES, categoryOf, isImmediate } from '../../shared/quiz-types.js';
import { OrderingEditor } from './ordering.jsx';
import { Implementation } from './implementation.jsx';

export const correct = (result) => result.correct ?? result.score === result.maxScore;

export function References({ set, ids }) {
  return <details><summary>出典を確認</summary>{ids.map((id) => {
    const ref = set.references.find((item) => item.id === id);
    if (!ref) return null;
    const rfc = ref.kind === 'spec' && /^rfcs\/rfc(\d{1,5})\.txt$/.exec(ref.path);
    const href = rfc
      ? `/?rfc=${Number(rfc[1])}#L${ref.startLine}-L${ref.endLine}`
      : ref.kind === 'diff' && set.pullRequest
      ? `https://github.com/${ref.repository}/compare/${set.pullRequest.baseSha}...${set.pullRequest.headSha}`
      : `https://github.com/${ref.repository}/blob/${ref.commit}/${ref.path.split('/').map(encodeURIComponent).join('/')}#L${ref.startLine}-L${ref.endLine}`;
    return <p><a href={href} target="_blank" rel="noopener">{rfc ? `RFC ${Number(rfc[1])} の該当箇所` : `${ref.path}:${ref.startLine}–${ref.endLine}`}</a><span> — {ref.reason}</span></p>;
  })}</details>;
}

function Feedback({ data, question, result }) {
  if (!result) return null;
  if (result.status !== 'graded') return <div class="quiz-feedback" tabindex="-1"><p>{data.status === 'grading_failed' ? '採点を完了できませんでした。回答は保存済みです。' : '記述式・実装は採点待ちです。'}</p></div>;
  const outcome = isImmediate(question) ? correct(result) ? '正解 · ' : question.type === 'choice' ? `不正解（正解: ${String.fromCharCode(65 + result.answer)}）· ` : '不正解 · ' : '';
  return <div class="quiz-feedback" tabindex="-1">
    <strong>{outcome}{result.score} / {result.maxScore}点</strong><p>{result.reason}</p>
    {question.type === 'ordering' && !correct(result) && <><p>正しい順序の例</p><ol>{result.answer.map((id) => <li>{question.items.find((item) => item.id === id).text}</li>)}</ol></>}
  </div>;
}

export function Question({ data, question: q }) {
  const saved = isImmediate(q) ? Object.hasOwn(data.answers || {}, q.id) : data.completed;
  const result = data.results?.find((item) => item.questionId === q.id);
  const number = data.set.questions.findIndex((item) => item.id === q.id) + 1;
  return <fieldset disabled={saved}>
    <legend>問題 {number} · {QUESTION_CATEGORIES[categoryOf(q)]} · {q.implementationMode === 'reading' ? 'コード読解・選択式' : ANSWER_TYPES[q.type]} · {q.points}点</legend>
    {q.term && <p class="quiz-term">{q.term}</p>}
    {q.scenario && <p class="quiz-scenario">{q.scenario}</p>}
    <p class="quiz-question" tabindex="-1">{q.prompt}</p>
    {q.implementation && <Implementation data={data} question={q} saved={saved} />}
    {q.type === 'choice' && q.options.map((option, index) => <label class={`quiz-choice${q.implementation ? ' quiz-code-choice' : ''}${result?.answer === index ? ' is-correct' : ''}`}>
      <input type="radio" name={q.id} value={index} required checked={data.answers?.[q.id] === index} />
      <span>{String.fromCharCode(65 + index)}. {option}</span>
    </label>)}
    {q.type === 'ordering' && <div id="ordering-editor"><OrderingEditor question={q} answer={data.answers?.[q.id]} seed={`${data.id}:${q.id}`} /></div>}
    {q.type === 'written' && <>
      {q.answerHint && <p class="help" id={`hint-${q.id}`}>{q.answerHint}</p>}
      <label for={`answer-${q.id}`}>あなたの回答</label>
      <textarea id={`answer-${q.id}`} name={q.id} rows="5" maxlength="8000" required aria-describedby={q.answerHint ? `hint-${q.id}` : undefined}>{data.answers?.[q.id] || ''}</textarea>
    </>}
    <Feedback data={data} question={q} result={result} />
    <References set={data.set} ids={[...new Set([...q.referenceIds, ...(result?.referenceIds || [])])]} />
  </fieldset>;
}
