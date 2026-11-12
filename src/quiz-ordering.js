function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}

// 問題・回答ごとに固定したシャッフル。再読み込みしても候補が飛び回らない。
function shuffled(items, seed) {
  let state = 2166136261;
  for (const c of seed) state = Math.imul(state ^ c.charCodeAt(0), 16777619) >>> 0;
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function orderingInput(question, { answer, seed, onChange }) {
  const root = node('div', undefined, 'quiz-ordering');
  const key = `quiz-order:${seed}`;
  let order = answer || [];
  if (!answer) {
    try {
      const draft = JSON.parse(sessionStorage.getItem(key) || '[]');
      if (Array.isArray(draft) && new Set(draft).size === draft.length && draft.every((id) => question.items.some((item) => item.id === id))) order = draft;
    } catch { /* 保存できない環境でも回答を続ける */ }
  } else { try { sessionStorage.removeItem(key); } catch { /* 任意の下書き保存 */ } }
  const input = node('input'); input.type = 'hidden'; input.name = question.id;
  const status = node('p', undefined, 'help'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const selected = node('ol', undefined, 'quiz-order-selected'); selected.setAttribute('aria-label', '組み立てた順序');
  const candidates = node('div', undefined, 'quiz-order-candidates'); candidates.setAttribute('role', 'group'); candidates.setAttribute('aria-label', '追加する候補');
  if (!answer) root.append(node('p', '候補を順にタップして並べてください。上下ボタンで順序を直せます。', 'help'));
  root.append(status, selected, candidates, input);
  const items = shuffled(question.items, seed);
  function change(next, focus) {
    order = next;
    try { sessionStorage.setItem(key, JSON.stringify(order)); } catch { /* 任意の下書き保存 */ }
    render();
    root.querySelector(`[data-control="${focus}"]`)?.focus({ preventScroll: true });
    onChange();
  }
  function control(text, label, id, action, disabled = false) {
    const button = node('button', text, 'btn secondary'); button.type = 'button'; button.setAttribute('aria-label', label);
    button.dataset.control = id; button.disabled = disabled; button.addEventListener('click', action);
    return button;
  }
  function render() {
    input.value = JSON.stringify(order);
    status.textContent = answer ? 'あなたの並び順' : `${order.length} / ${question.items.length}項目を配置${order.length === question.items.length ? ' · 採点できます' : ''}`;
    selected.replaceChildren(); candidates.replaceChildren();
    order.forEach((id, i) => {
      const item = question.items.find((v) => v.id === id);
      const li = node('li'); li.append(node('p', item.text));
      if (!answer) {
        const actions = node('div', undefined, 'quiz-order-actions');
        const move = (delta) => { const next = [...order]; [next[i], next[i + delta]] = [next[i + delta], next[i]]; change(next, `remove-${id}`); };
        actions.append(
          control('↑', `${i + 1}番目の項目を上へ`, `up-${id}`, () => move(-1), i === 0),
          control('↓', `${i + 1}番目の項目を下へ`, `down-${id}`, () => move(1), i === order.length - 1),
          control('外す', `${i + 1}番目の項目を候補に戻す`, `remove-${id}`, () => change(order.filter((v) => v !== id), `add-${id}`)),
        );
        li.append(actions);
      }
      selected.append(li);
    });
    if (!answer) for (const item of items.filter((v) => !order.includes(v.id))) {
      const button = control(item.text, `${item.text}を次に追加`, `add-${item.id}`, () => change([...order, item.id], `remove-${item.id}`));
      candidates.append(button);
    }
  }
  render();
  return root;
}
