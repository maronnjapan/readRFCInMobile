const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
let attemptId = params.get('attempt');
let setId = params.get('set');
let current;
let timer;
let stopped = false;
let pollingSince = 0;
let busy = false;
const stateLabels = { proposed: '提案中', adopted: '採用済み', draft: '草案', obsolete: '廃止済み' };

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}
function error(message = '') { $('error').textContent = message; $('error').hidden = !message; }
async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(new URL(`api/${path}`, location.href), {
    method, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(30000),
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('問題の出題はただいま利用できません。'); }
  if (!response.ok) throw new Error(data.message || '通信できませんでした。');
  return data;
}
function setHeading(set) {
  $('quiz-title').textContent = set.title;
  $('source-title').textContent = `${set.spec.id} · ${stateLabels[set.spec.status]} · 問題の版 ${set.revision.commit.slice(0, 8)}`;
  const rfc = /^rfc-(\d+)$/.exec(set.spec.id);
  $('back-link').href = rfc ? `./?rfc=${rfc[1]}` : './';
}
function references(set, ids) {
  const details = element('details');
  details.append(element('summary', '出典を確認'));
  for (const id of ids) {
    const ref = set.references.find((r) => r.id === id);
    if (!ref) continue;
    const link = element('a', `${ref.path}:${ref.startLine}–${ref.endLine}`);
    link.href = ref.kind === 'diff' && set.pullRequest
      ? `https://github.com/${ref.repository}/compare/${set.pullRequest.baseSha}...${set.pullRequest.headSha}`
      : `https://github.com/${ref.repository}/blob/${ref.commit}/${ref.path.split('/').map(encodeURIComponent).join('/')}#L${ref.startLine}-L${ref.endLine}`;
    link.target = '_blank'; link.rel = 'noopener';
    const p = element('p'); p.append(link, element('span', ` — ${ref.reason}`)); details.append(p);
  }
  return details;
}
function present(data) {
  const wasGraded = current?.status === 'graded';
  current = data;
  setId = data.set.id;
  setHeading(data.set);
  error('');
  $('setup').hidden = true;
  $('set-list').hidden = true;
  $('retention').hidden = false;
  $('answer-form').hidden = false;
  const saved = Boolean(data.answers);
  const list = $('questions'); list.replaceChildren();
  data.set.questions.forEach((q, i) => {
    const fieldset = element('fieldset'); fieldset.disabled = saved;
    fieldset.append(element('legend', `問題 ${i + 1} · ${q.type === 'choice' ? '選択式' : '記述式'} · ${q.points}点`), element('p', q.prompt, 'quiz-question'));
    if (q.type === 'choice') {
      q.options.forEach((option, index) => {
        const label = element('label', undefined, 'quiz-choice');
        const input = element('input'); input.type = 'radio'; input.name = q.id; input.value = String(index); input.required = true;
        input.checked = data.answers?.[q.id] === index;
        const result = data.results?.find((r) => r.questionId === q.id);
        if (result?.answer === index) label.classList.add('is-correct');
        label.append(input, element('span', `${String.fromCharCode(65 + index)}. ${option}`)); fieldset.append(label);
      });
    } else {
      const label = element('label', 'あなたの回答');
      label.htmlFor = `answer-${q.id}`;
      const input = element('textarea'); input.id = label.htmlFor; input.name = q.id; input.rows = 5; input.maxLength = 8000; input.required = true;
      input.value = data.answers?.[q.id] || '';
      fieldset.append(label, input);
    }
    const result = data.results?.find((r) => r.questionId === q.id);
    if (result) {
      const feedback = element('div', undefined, 'quiz-feedback');
      if (result.status === 'graded') {
        feedback.append(element('strong', `${result.score} / ${result.maxScore}点`), element('p', result.reason));
      } else feedback.append(element('p', data.status === 'grading_failed' ? '採点を完了できませんでした。回答は保存済みです。' : '記述式は採点待ちです。'));
      fieldset.append(feedback);
    }
    fieldset.append(references(data.set, [...new Set([...q.referenceIds, ...(result?.referenceIds || [])])]));
    list.append(fieldset);
  });
  if (data.set.inconsistencies?.length) {
    const notice = element('aside', undefined, 'status');
    notice.append(element('strong', '仕様と実装の不整合'));
    data.set.inconsistencies.forEach((v) => notice.append(element('p', v.description), references(data.set, v.referenceIds)));
    list.append(notice);
  }
  $('submit-answer').hidden = saved;
  $('pending').hidden = data.status !== 'grading';
  $('request-grade').hidden = !['saved', 'grading_failed'].includes(data.status);
  $('refresh').hidden = data.status !== 'grading';
  $('score').hidden = !data.results;
  if (data.results) {
    const points = data.results.reduce((sum, r) => sum + (r.score || 0), 0);
    const maximum = data.set.questions.reduce((sum, q) => sum + q.points, 0);
    $('score').textContent = data.status === 'graded' ? `${points} / ${maximum}点` : `${points}点獲得 · 記述式は採点待ち`;
    if (data.status === 'graded' && !wasGraded) $('score').focus();
  }
}
async function poll() {
  clearTimeout(timer);
  if (stopped || !attemptId) return;
  try {
    const data = await api(`attempts/${attemptId}`);
    if (stopped) return;
    present(data);
    if (data.status === 'grading' && Date.now() - pollingSince < 300000) timer = setTimeout(poll, 2000);
  } catch (e) { error(e.message); $('refresh').hidden = false; }
}
async function grade() {
  if (busy) return;
  busy = true; $('request-grade').disabled = true; error('');
  try {
    await api(`attempts/${attemptId}/grading-requests`, { method: 'POST', body: {} });
    pollingSince = Date.now(); await poll();
  } catch (e) { error(`回答は保存済みです。${e.message}`); }
  finally { busy = false; $('request-grade').disabled = false; }
}
$('request-grade').addEventListener('click', grade);
$('refresh').addEventListener('click', () => { pollingSince = Date.now(); poll(); });
$('start').addEventListener('click', async () => {
  $('start').disabled = true;
  try {
    const data = await api(`question-sets/${setId}/attempts`, { method: 'POST', body: {} });
    attemptId = data.id; history.replaceState(null, '', `?attempt=${attemptId}`); present(data);
  } catch (e) { error(e.message); } finally { $('start').disabled = false; }
});
$('answer-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || current.answers) return;
  busy = true; $('submit-answer').disabled = true;
  try {
    const form = new FormData(event.currentTarget);
    if (current.set.questions.some((q) => form.get(q.id) === null)) throw new Error('すべての問題に回答してください。');
    const answers = Object.fromEntries(current.set.questions.map((q) => [q.id, q.type === 'choice' ? Number(form.get(q.id)) : form.get(q.id)]));
    const data = await api(`attempts/${attemptId}/answers`, { method: 'POST', body: { answers } });
    present(data);
    busy = false;
    if (data.status === 'saved') await grade();
  } catch (e) { error(e.message); }
  finally { busy = false; $('submit-answer').disabled = false; }
});
window.addEventListener('pagehide', () => { stopped = true; clearTimeout(timer); });
window.addEventListener('pageshow', (e) => { stopped = false; if (e.persisted && current?.status === 'grading') { pollingSince = Date.now(); poll(); } });

async function initialize() {
  try {
    await api('quiz/config');
    if (attemptId) { pollingSince = Date.now(); await poll(); return; }
    if (setId) {
      const set = await api(`question-sets/${setId}`); setHeading(set);
      $('set-description').textContent = `全${set.questions.length}問。選択式はその場で、記述式は回答を保存してから採点します。`;
      const history = await api(`question-sets/${setId}/attempts`);
      for (const attempt of history.attempts) {
        const link = element('a', `${attempt.status === 'graded' ? '採点結果を見る' : '前の回答を開く'} (${new Date(attempt.created_at * 1000).toLocaleDateString('ja-JP')})`);
        link.href = `?attempt=${attempt.id}`;
        const p = element('p'); p.append(link); $('previous-attempts').append(p);
      }
      $('setup').hidden = false; return;
    }
    const spec = params.get('spec');
    const data = await api(`question-sets${spec ? `?spec=${encodeURIComponent(spec)}` : ''}`);
    $('source-title').textContent = spec || '仕様そのものと、PR の変更内容を確認できます。';
    $('set-list').hidden = false;
    for (const set of data.sets) {
      const li = element('li'), link = element('a', set.title);
      link.href = `?set=${set.id}`;
      link.append(element('span', `${set.spec.id} · ${stateLabels[set.spec.status]}${set.pullRequest ? ` · PR #${set.pullRequest.number}` : ''}`, 'when'));
      li.append(link); $('sets').append(li);
    }
    if (!data.sets.length) $('sets').append(element('li', '公開済みの問題はまだありません。'));
  } catch (e) { error(e.message || '通信できませんでした。'); }
}
initialize();
