import { QUESTION_CATEGORIES, categoryOf, isImmediate } from '../shared/quiz-types.js';
import { Document } from './document.jsx';
import { Question, References, correct } from './components/question.jsx';

const states = { proposed: '提案中', adopted: '採用済み', draft: '草案', obsolete: '廃止済み' };
const attemptUrl = (id, question) => `/quiz?${new URLSearchParams({ attempt: id, ...(question ? { question } : {}) })}`;
const backLink = (set) => /^rfc-(\d+)$/.test(set.spec?.id || '') ? `/?rfc=${set.spec.id.slice(4)}` : set.pullRequest ? `https://github.com/${set.pullRequest.repository}/pull/${set.pullRequest.number}` : '/';
const backLabel = (set) => backLink(set).startsWith('https://github.com/') ? 'PRに戻る' : '本文に戻る';
const sourceLabel = (set) => set.spec ? `${set.spec.id} · ${states[set.spec.status]}` : `${set.pullRequest.repository} · PR #${set.pullRequest.number}`;
function Source({ set }) {
  return <p class="quiz-source" id="source-title">{sourceLabel(set)} · 問題の版 {set.revision.commit.slice(0, 8)}</p>;
}
function Retention() {
  return <p class="help" id="retention">ログインなしで回答できます。匿名の回答はこのブラウザで続きから開けます（Cookieを削除すると開けなくなります）。記述式・実装のAI採点を利用するときだけ、許可されたアカウントでログインしてください。AI採点には誤りが含まれることがあります。実装コードは実行せず、ケースと採点基準に照らして評価します。</p>;
}

function StartForm({ set, readingOnly = false }) {
  const implementation = set.questions.some((q) => q.implementation);
  return <form method="post" action="/quiz/attempts" data-mutation>
    <input type="hidden" name="setId" value={set.id} />
    {!readingOnly && <button class={`btn${implementation ? ' quiz-start-code' : ''}`} id="start" name="implementationMode" value="code" type="submit">{implementation ? 'コードを書いて回答を始める' : '回答を始める'}</button>}
    {implementation && <button class={`btn${readingOnly ? '' : ' quiz-start-reading'}`} name="implementationMode" value="reading" type="submit">コード読解・選択式で始める</button>}
  </form>;
}

export function QuizPage({ page }) {
  if (page.kind === 'attempt') return <AttemptPage page={page} />;
  if (page.kind === 'setup') {
    const { set, attempts } = page;
    const categories = [...new Set(set.questions.map((q) => QUESTION_CATEGORIES[categoryOf(q)]))].join('・');
    return <Document title={set.title} back={backLink(set)} backLabel={backLabel(set)}><Source set={set} /><section id="setup">
      <p id="set-description">全{set.questions.length}問（{categories}）。ログインなしで回答できます。すべて1問ずつ出題し、選択式・並べ替えは即時採点、記述式・実装は1問ごとに回答を保存できます。AI採点の利用時だけログインが必要です。</p>
      {set.questions.some((q) => q.implementation) && <p class="help">実装問題はPCでコードを書いて回答します。スマホ画面ではコードを読んで関数や処理を選ぶ問題になります。開始時の回答形式で続きから再開できます。</p>}
      <div id="previous-attempts">{attempts.map((attempt) => <p><a href={attemptUrl(attempt.id)}>{attempt.status === 'graded' ? '採点結果を見る' : '前の回答を開く'}{set.questions.some((q) => q.implementation) ? ` · ${attempt.implementation_mode === 'reading' ? 'コード読解' : 'コード実装'}` : ''} ({new Date(attempt.created_at * 1000).toLocaleDateString('ja-JP')})</a></p>)}</div>
      <StartForm set={set} />
    </section></Document>;
  }
  return <Document><p class="quiz-source" id="source-title">{page.spec || '仕様そのものと、PR の変更内容を確認できます。'}</p><section id="set-list"><h2>問題を選ぶ</h2><ul class="cardlist" id="sets">
    {page.sets.map((set) => <li><a href={`/quiz?set=${set.id}`}>{set.title}<span class="when">{sourceLabel(set)}{set.spec && set.pullRequest ? ` · PR #${set.pullRequest.number}` : ''}</span></a></li>)}
    {!page.sets.length && <li>公開済みの問題はまだありません。</li>}
  </ul></section></Document>;
}

function AttemptPage({ page }) {
  const { data, immediate, sequence, question, written, view } = page;
  const results = view === 'results';
  const shown = question ? [question] : written;
  const saved = question ? Object.hasOwn(data.answers || {}, question.id) : data.completed;
  const instant = question && isImmediate(question);
  const ordering = question?.type === 'ordering' ? { question, answer: data.answers?.[question.id], seed: `${data.id}:${question.id}` } : null;
  const next = question ? sequence[sequence.indexOf(question) + 1] : null;
  const points = (data.results || []).reduce((sum, result) => sum + (result.score || 0), 0);
  const maximum = data.set.questions.reduce((sum, q) => sum + q.points, 0);
  const codeAttempt = data.set.questions.some((q) => q.type === 'implementation');
  return <Document title={data.set.title} back={backLink(data.set)} backLabel={backLabel(data.set)} ordering={ordering} grading={data.status === 'grading'} implementation={codeAttempt}>
    <Source set={data.set} />
    {data.set.questions.some((q) => q.implementation) && <p class="help">回答形式: {data.implementationMode === 'reading' ? 'コード読解・選択式' : 'PCでコード実装'}</p>}
    {codeAttempt && !data.completed && <aside class="quiz-mobile-resume"><p>この回答はPC向けの実装形式で開始しています。スマホではコード読解・選択式の新しい回答を開始できます。</p><StartForm set={data.set} readingOnly /></aside>}
    {data.status === 'grading' && <p id="pending" role="status"><span class="spinner" aria-hidden="true"></span>記述式・実装を採点しています。回答は保存済みです。</p>}
    <div class="quiz-actions">
      {['saved', 'grading_failed'].includes(data.status) && (page.canGrade
        ? <form id="grading-form" method="post" action={`/quiz/attempts/${data.id}/grading-requests`} data-mutation><button class="btn secondary" id="request-grade" type="submit">記述式・実装のAI採点を依頼</button></form>
        : page.gradingAvailable
          ? <a class="btn secondary" id="login-to-grade" href={`/quiz/ai-grading?attempt=${data.id}`}>ログインして記述式・実装をAI採点</a>
          : <p class="help" id="grading-unavailable">回答は保存済みです。記述式・実装のAI採点は現在利用できません。</p>)}
      <form method="get" action="/quiz" hidden={data.status !== 'grading'}><input type="hidden" name="attempt" value={data.id} /><button class="btn secondary" id="refresh" type="submit">採点状況を確認</button></form>
    </div>
    {results && <h2 id="score" tabindex="-1">{data.status === 'graded' ? `${points} / ${maximum}点` : `${points}点獲得 · 記述式・実装は採点待ち`}</h2>}
    {results && immediate.length > 0 && <section id="choice-summary" aria-labelledby="choice-summary-title"><h2 id="choice-summary-title">選択式・並べ替えの結果</h2><ul id="choice-results">{immediate.map((q, index) => {
      const result = data.results?.find((item) => item.questionId === q.id);
      return result && <li><a class="linkbtn" href={attemptUrl(data.id, q.id)}>{QUESTION_CATEGORIES[categoryOf(q)]} {index + 1}: {correct(result) ? '正解' : '不正解'}（{result.score} / {q.points}点）を確認</a></li>;
    })}</ul></section>}
    {question && <p class="help" id="question-progress">{instant ? `即時採点 ${immediate.indexOf(question) + 1} / ${immediate.length}` : `記述式・実装 ${written.indexOf(question) + 1} / ${written.length}`}</p>}
    <form id="answer-form" class={question?.type === 'implementation' && !saved ? 'quiz-code-form' : undefined} method="post" action={`/quiz/attempts/${data.id}/${instant ? 'instant-answers' : 'answers'}`} data-mutation hidden={!shown.length}>
      {instant && <input type="hidden" name="questionId" value={question.id} />}
      <div id="questions">{shown.map((q) => <Question data={data} question={q} />)}</div>
      <button class="btn" id="submit-answer" type="submit" hidden={saved || !shown.length}>{instant ? '採点する' : 'この問題の回答を保存'}</button>
    </form>
    {question && saved && <form method="get" action="/quiz"><input type="hidden" name="attempt" value={data.id} />{next && <input type="hidden" name="question" value={next.id} />}<button class="btn" id="next-question" type="submit">{next ? '次の問題へ' : '結果を見る'}</button></form>}
    {results && data.set.inconsistencies?.length > 0 && <aside class="status"><strong>仕様と実装の不整合</strong>{data.set.inconsistencies.map((item) => <><p>{item.description}</p><References set={data.set} ids={item.referenceIds} /></>)}</aside>}
    <Retention />
  </Document>;
}
