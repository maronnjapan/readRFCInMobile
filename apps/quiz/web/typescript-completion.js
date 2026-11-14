import { pickedCompletion } from '@codemirror/autocomplete';
import { localCompletionSource } from '@codemirror/lang-javascript';

const completionTypes = { method: 'method', function: 'function', property: 'property', getter: 'property', setter: 'property',
  const: 'constant', let: 'variable', var: 'variable', parameter: 'variable', class: 'class', interface: 'interface',
  type: 'type', enum: 'enum', 'enum member': 'constant', module: 'namespace', keyword: 'keyword', alias: 'variable' };

export function typeScriptCompletion(language, onError) {
  let worker, sequence = 0, failed = false;
  const pending = new Map();
  const stop = () => {
    worker?.terminate();
    worker = undefined;
    for (const finish of pending.values()) finish(null);
    pending.clear();
  };
  const fail = () => {
    failed = true;
    stop();
    onError();
  };
  function request(payload, context) {
    if (failed) return Promise.resolve(null);
    try {
      if (!worker) {
        worker = new Worker('/src/typescript-worker.js', { type: 'module' });
        worker.onmessage = ({ data }) => data.error ? fail() : pending.get(data.id)?.(data.result);
        worker.onerror = (event) => { event.preventDefault(); fail(); };
      }
      return new Promise((resolve) => {
        const id = ++sequence;
        const timer = setTimeout(fail, 15000);
        const finish = (result) => { clearTimeout(timer); pending.delete(id); resolve(result); };
        pending.set(id, finish);
        context?.addEventListener('abort', () => finish(null), { onDocChange: true });
        worker.postMessage({ ...payload, language, id });
      });
    } catch { fail(); return Promise.resolve(null); }
  }
  return {
    destroy: stop,
    async source(context) {
      const word = context.matchBefore(/[\w$\u00a1-\uffff]+$/);
      if (!context.explicit && !word && context.state.sliceDoc(Math.max(0, context.pos - 1), context.pos) !== '.') return null;
      const code = context.state.doc.toString(), position = context.pos;
      const result = await request({ code, position }, context);
      if (context.aborted) return null;
      if (failed) return localCompletionSource(context);
      if (!result) return null;
      return { from: result.from, to: result.to, validFor: /^[\w$\u00a1-\uffff]*$/,
        options: result.entries.map((entry) => ({
          label: entry.name, type: completionTypes[entry.kind] || 'variable', boost: entry.isRecommended ? 10 : 0,
          apply: (view, completion, from, to) => {
            const start = entry.replacementSpan ? from + entry.replacementSpan.start - result.from : from;
            const end = entry.replacementSpan ? to + entry.replacementSpan.start + entry.replacementSpan.length - result.to : to;
            const insert = entry.insertText ?? entry.name;
            view.dispatch({ changes: { from: start, to: end, insert }, selection: { anchor: start + insert.length }, annotations: pickedCompletion.of(completion), userEvent: 'input.complete' });
          },
          info: async () => {
            const details = await request({ kind: 'details', code, position, name: entry.name, entrySource: entry.source, data: entry.data });
            if (!details) return null;
            const content = document.createElement('div');
            const signature = document.createElement('pre');
            signature.textContent = details.signature;
            content.append(signature);
            if (details.documentation) { const text = document.createElement('p'); text.textContent = details.documentation; content.append(text); }
            return content;
          },
        })) };
    },
  };
}
