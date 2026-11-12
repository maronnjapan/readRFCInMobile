import { render } from 'hono/jsx/dom';
import { OrderingEditor } from './components/ordering.jsx';

const error = document.getElementById('error');
async function readResponse(response) {
  try { return await response.json(); } catch { throw new Error('問題の出題はただいま利用できません。'); }
}
function showError(message) {
  error.textContent = message;
  error.hidden = !message;
}
const ordering = document.getElementById('ordering-data');
if (ordering) render(<OrderingEditor {...JSON.parse(ordering.textContent)} fallback={false} onChange={(complete) => {
  const button = document.getElementById('submit-answer');
  button.disabled = !complete;
}} />, document.getElementById('ordering-editor'));

if (document.querySelector('[data-code-input], [data-code-preview]')) {
  import('./code-editor.js').then(({ initializeCode }) => initializeCode()).catch(() => {
    showError('コードエディタを読み込めませんでした。PCでは入力欄で回答できます。再読み込みでエディタを再試行できます。');
  });
}

let busy = false;
for (const form of document.querySelectorAll('form[data-mutation]')) form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy) return;
  for (const input of form.querySelectorAll('[data-code-input] textarea')) {
    if (!input.value.trim() || input.value.length > input.maxLength) {
      showError('コードは1〜16000文字で入力してください。');
      input.closest('[data-code-input]').querySelector('.cm-content')?.focus();
      return;
    }
  }
  const body = new URLSearchParams(new FormData(form, event.submitter));
  const controls = [...form.querySelectorAll('button, fieldset')].map((control) => [control, control.disabled]);
  busy = true;
  showError('');
  controls.forEach(([control]) => { control.disabled = true; });
  try {
    const response = await fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, body, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(30000) });
    const result = await readResponse(response);
    if (!response.ok) throw new Error(result.message || '通信できませんでした。');
    for (const input of form.querySelectorAll('[data-code-input]')) {
      try { sessionStorage.removeItem(input.dataset.draftKey); } catch {}
    }
    location.assign(result.location);
  } catch (cause) {
    showError(cause.message || '通信できませんでした。');
    controls.forEach(([control, disabled]) => { control.disabled = disabled; });
    busy = false;
  }
});

const params = new URLSearchParams(location.search);
if (params.has('grade') || params.has('focus')) {
  if (params.get('focus') === 'feedback') document.querySelector('.quiz-feedback')?.focus();
  params.delete('grade'); params.delete('focus');
  history.replaceState(null, '', `/quiz?${params}`);
}
const pending = document.querySelector('[data-grading="true"]');
let timer;
let started = Date.now();
let stopped = false;
async function poll() {
  clearTimeout(timer);
  if (stopped || !pending) return;
  try {
    const response = await fetch(`/api/attempts/${params.get('attempt')}`, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(30000) });
    const data = await readResponse(response);
    if (!response.ok) throw new Error(data.message || '採点状況を確認できませんでした。');
    if (data.status !== 'grading') { location.reload(); return; }
    if (Date.now() - started < 300000) timer = setTimeout(poll, 2000);
  } catch (cause) { showError(cause.message); }
}
document.getElementById('refresh')?.addEventListener('click', (event) => { event.preventDefault(); started = Date.now(); poll(); });
window.addEventListener('pagehide', () => { stopped = true; clearTimeout(timer); });
window.addEventListener('pageshow', (event) => { if (event.persisted) { stopped = false; started = Date.now(); poll(); } });
if (pending) timer = setTimeout(poll, 2000);
