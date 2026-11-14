import { basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, ViewPlugin } from '@codemirror/view';
import { autocompletion } from '@codemirror/autocomplete';
import { indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { classHighlighter, highlightCode } from '@lezer/highlight';
import { typeScriptCompletion } from './typescript-completion.js';

const languageSupport = (language) => language === 'python' ? python() : javascript({ typescript: language === 'typescript' });
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
      const completion = container.dataset.language === 'python' ? null : typeScriptCompletion(container.dataset.language, () => {
        const status = container.parentElement.querySelector('[data-completion-status]');
        status.hidden = false;
        status.textContent = '型に基づく補完を読み込めませんでした。再読み込みで再試行できます。';
      });
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
          ...(completion ? [autocompletion({ override: [completion.source] }), ViewPlugin.define(() => ({ destroy: completion.destroy }))] : []),
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
