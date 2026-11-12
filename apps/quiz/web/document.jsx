import { html } from 'hono/html';

const themeScript = `try{const s=JSON.parse(localStorage.getItem('rfcreader:settings')||'{}');if(s.theme&&s.theme!=='system')document.documentElement.dataset.theme=s.theme;if(s.fs)document.documentElement.style.setProperty('--fs',s.fs+'px')}catch{}`;
export function jsonData(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
}
export function Document({ children, title = '理解度を確認', back = '/', ordering, grading = false, implementation = false }) {
  return html`<!doctype html>${<html lang="ja"><head>
    <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="color-scheme" content="light dark" /><meta name="referrer" content="same-origin" />
    <title>{title} - RFC Reader</title><link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/styles.css" /><link rel="stylesheet" href="/quiz.css" />
    <script dangerouslySetInnerHTML={{ __html: themeScript }} />
    <noscript><style>{'.quiz-order-candidates,.quiz-order-actions,.quiz-order-script{display:none}'}</style></noscript>
  </head><body>
    <header class="topbar"><a class="quiz-back" id="back-link" href={back}>← 本文に戻る</a><span class="bar-title">RFC Reader</span></header>
    <main class={`quiz-page${implementation ? ' quiz-page-code' : ''}`} data-grading={grading ? 'true' : undefined}>
      <h1 id="quiz-title">{title}</h1>
      <p class="quiz-error" id="error" role="alert" hidden></p>
      {children}
    </main>
    {ordering && <script type="application/json" id="ordering-data" dangerouslySetInnerHTML={{ __html: jsonData(ordering) }} />}
    <script type="module" src="/src/quiz-page.js" />
  </body></html>}`;
}

export function ErrorPage({ message }) {
  return <Document><p class="quiz-error" role="alert">{message}</p><p><a href="/quiz">問題一覧へ戻る</a></p></Document>;
}
