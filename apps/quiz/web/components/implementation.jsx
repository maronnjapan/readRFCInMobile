import { CODE_LANGUAGES } from '../../shared/quiz-types.js';

export function Implementation({ data, question: q, saved }) {
  const code = q.implementation;
  const reading = q.implementationMode === 'reading';
  return <div class="quiz-implementation">
    <p class="help">{CODE_LANGUAGES[code.language]} · {reading ? 'コードを読んで、使う関数や処理を選んでください。コードの入力は不要です。' : 'ケースと制約を満たす関数を実装してください。コードとケースをAIが照合して採点します。'}</p>
    <details open={!reading}><summary>満たすケース・入出力例</summary><ol class="quiz-cases">{code.cases.map((c) => <li>
      <strong>{c.name}</strong><dl><dt>入力</dt><dd><pre>{c.input}</pre></dd><dt>期待する結果</dt><dd><pre>{c.expected}</pre></dd></dl>
    </li>)}</ol></details>
    {reading ? <pre class="quiz-code-preview" data-code-preview data-language={code.language}><code>{code.mobile.code}</code></pre>
      : saved ? <pre class="quiz-code-preview" data-code-preview data-language={code.language}><code>{data.answers?.[q.id] || code.starterCode}</code></pre>
      : <div class="quiz-code-desktop">
        {q.answerHint && <p class="help" id={`hint-${q.id}`}>{q.answerHint}</p>}
        <label id={`label-${q.id}`} for={`answer-${q.id}`}>あなたのコード（{CODE_LANGUAGES[code.language]}）</label>
        <p class="help" id={`editor-help-${q.id}`}>補完: Ctrl+Space · 字下げ: Tab · フォーカスを移す: Esc → Tab。下書きはこのタブに保存します。</p>
        <div class="quiz-code-input" data-code-input data-language={code.language} data-draft-key={`quiz-code:${data.id}:${q.id}`}>
          <textarea id={`answer-${q.id}`} name={q.id} rows="14" maxlength="16000" required spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby={`editor-help-${q.id}${q.answerHint ? ` hint-${q.id}` : ''}`}>{data.answers?.[q.id] ?? code.starterCode}</textarea>
          <div class="quiz-code-mount" aria-labelledby={`label-${q.id}`}></div>
        </div>
      </div>}
  </div>;
}
