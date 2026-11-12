import { useLayoutEffect, useRef, useState } from 'hono/jsx';

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

function initialOrder(question, key, answer) {
  if (answer) return answer;
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || '[]');
    if (Array.isArray(value) && new Set(value).size === value.length && value.every((id) => question.items.some((item) => item.id === id))) return value;
  } catch { /* 下書き保存が使えない環境でも回答可能 */ }
  return [];
}

export function OrderingEditor({ question, answer, seed, onChange, fallback = true }) {
  const key = `quiz-order:${seed}`;
  const [order, setOrder] = useState(() => initialOrder(question, key, answer));
  const root = useRef(null);
  const focus = useRef(null);
  useLayoutEffect(() => {
    try {
      if (answer) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, JSON.stringify(order));
    } catch { /* 任意の下書き保存 */ }
    onChange?.(order.length === question.items.length);
  }, [order]);
  useLayoutEffect(() => {
    if (focus.current) root.current?.querySelector(`[data-control="${focus.current}"]`)?.focus({ preventScroll: true });
  }, [order]);
  function change(next, control) {
    try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* 任意の下書き保存 */ }
    focus.current = control;
    setOrder(next);
  }
  function move(index, delta) {
    const next = [...order];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    change(next, `remove-${order[index]}`);
  }
  return <div class="quiz-ordering" ref={root}>
    {!answer && <p class="help quiz-order-script">候補を順にタップして並べてください。上下ボタンで順序を直せます。</p>}
    <p class={`help${answer ? '' : ' quiz-order-script'}`} role="status" aria-live="polite">{answer ? 'あなたの並び順' : `${order.length} / ${question.items.length}項目を配置${order.length === question.items.length ? ' · 採点できます' : ''}`}</p>
    <ol class="quiz-order-selected" aria-label="組み立てた順序">
      {order.map((id, index) => <li key={id}>
        <p>{question.items.find((item) => item.id === id).text}</p>
        {!answer && <div class="quiz-order-actions">
          <button class="btn secondary" type="button" data-control={`up-${id}`} aria-label={`${index + 1}番目の項目を上へ`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
          <button class="btn secondary" type="button" data-control={`down-${id}`} aria-label={`${index + 1}番目の項目を下へ`} disabled={index === order.length - 1} onClick={() => move(index, 1)}>↓</button>
          <button class="btn secondary" type="button" data-control={`remove-${id}`} aria-label={`${index + 1}番目の項目を候補に戻す`} onClick={() => change(order.filter((value) => value !== id), `add-${id}`)}>外す</button>
        </div>}
      </li>)}
    </ol>
    {!answer && <div class="quiz-order-candidates" role="group" aria-label="追加する候補">
      {shuffled(question.items, seed).filter((item) => !order.includes(item.id)).map((item) => <button key={item.id} type="button" class="btn secondary" data-control={`add-${item.id}`} aria-label={`${item.text}を次に追加`} onClick={() => change([...order, item.id], `remove-${item.id}`)}>{item.text}</button>)}
    </div>}
    <input type="hidden" name={question.id} value={JSON.stringify(order)} />
    {fallback && !answer && <noscript><p>上から順に、各位置に置く項目を選んでください。</p>{question.items.map((_, index) => <label>位置 {index + 1}<select name="order" required><option value="">選んでください</option>{question.items.map((item) => <option value={item.id}>{item.text}</option>)}</select></label>)}</noscript>}
  </div>;
}
