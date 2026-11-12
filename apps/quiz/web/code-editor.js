import { basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting } from '@codemirror/language';
import { javascript, scopeCompletionSource } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { classHighlighter, highlightCode } from '@lezer/highlight';

const languageSupport = (language) => language === 'python' ? python() : javascript({ typescript: language === 'typescript' });
// 組み込みオブジェクトのプロパティも補完する。入力コードを評価しない。
const javascriptScope = { Array, Object, String, Number, Boolean, JSON, Math, Map, Set, URL, URLSearchParams, Promise, Error, TypeError, RegExp };
const theme = EditorView.theme({
  '&': { backgroundColor: 'var(--code-bg)', color: 'var(--code-fg)' },
  '.cm-content': { caretColor: 'var(--fg)', fontFamily: 'var(--mono)', minHeight: '18rem' },
  '.cm-scroller': { overflow: 'auto', maxHeight: '36rem', fontFamily: 'var(--mono)', lineHeight: '1.6' },
  '.cm-gutters': { backgroundColor: 'var(--bg-elev)', color: 'var(--muted)', borderColor: 'var(--line)' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--accent-soft)' },
  '.cm-tooltip': { backgroundColor: 'var(--bg-elev)', color: 'var(--fg)', borderColor: 'var(--line)' },
  '.cm-cursor': { borderLeftColor: 'var(--fg)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--accent-soft)' },
});

export function initializeCode() {
  for (const preview of document.querySelectorAll('[data-code-preview]')) {
    const code = preview.querySelector('code');
    const source = code.textContent;
    code.replaceChildren();
    highlightCode(source, languageSupport(preview.dataset.language).language.parser.parse(source), classHighlighter,
      (text, classes) => {
        if (!classes) { code.append(document.createTextNode(text)); return; }
        const span = document.createElement('span');
        span.className = classes;
        span.textContent = text;
        code.append(span);
      }, () => code.append(document.createTextNode('\n')));
  }
  const smallScreen = matchMedia('(max-width: 767px)');
  for (const container of document.querySelectorAll('[data-code-input]')) {
    const textarea = container.querySelector('textarea');
    const mount = container.querySelector('.quiz-code-mount');
    let view;
    const initialize = () => {
      if (smallScreen.matches || view) return;
      const language = languageSupport(container.dataset.language);
      let source = textarea.value;
      try { source = sessionStorage.getItem(container.dataset.draftKey) ?? source; } catch {}
      if (source.length > textarea.maxLength) source = textarea.value;
      const persist = () => {
        textarea.value = view.state.doc.toString();
        try { sessionStorage.setItem(container.dataset.draftKey, textarea.value); } catch {}
      };
      view = new EditorView({
        parent: mount,
        state: EditorState.create({ doc: source, extensions: [
          basicSetup, language, syntaxHighlighting(classHighlighter), theme,
          ...(container.dataset.language === 'python' ? [] : [language.language.data.of({ autocomplete: scopeCompletionSource(javascriptScope) })]),
          keymap.of([indentWithTab]), EditorState.tabSize.of(2),
          EditorView.contentAttributes.of({ 'aria-labelledby': `label-${textarea.name}`, 'aria-describedby': textarea.getAttribute('aria-describedby'), 'aria-required': 'true', spellcheck: 'false' }),
          EditorState.transactionFilter.of((transaction) => transaction.newDoc.length <= textarea.maxLength ? transaction : []),
          EditorView.updateListener.of((update) => { if (update.docChanged) persist(); }),
        ] }),
      });
      textarea.value = source;
      // 非表示のrequired入力にブラウザがフォーカスしないよう、送信時の検証へ移す。
      textarea.required = false;
      textarea.hidden = true;
      const label = document.getElementById(`label-${textarea.name}`);
      label.removeAttribute('for');
      label.addEventListener('click', () => view.focus());
    };
    initialize();
    smallScreen.addEventListener('change', initialize);
  }
}
