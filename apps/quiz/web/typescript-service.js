import ts from 'typescript';

// 読み書きするのは仮想ファイルだけ。入力されたJavaScriptを実行しない。
export function createTypeScriptService(libraries, language) {
  const filename = language === 'typescript' ? '/answer.ts' : '/answer.js';
  const directories = new Set();
  for (const path of Object.keys(libraries)) {
    for (let end = path.lastIndexOf('/'); end > 0; end = path.lastIndexOf('/', end - 1)) directories.add(path.slice(0, end));
  }
  let code = '', version = 0;
  const readFile = (path) => path === filename ? code : libraries[path];
  const service = ts.createLanguageService({
    getCompilationSettings: () => ({
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
      allowJs: true, checkJs: true, strict: true, noEmit: true, skipLibCheck: true,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'], types: ['node'],
    }),
    getScriptFileNames: () => [filename],
    getScriptVersion: (path) => path === filename ? String(version) : '0',
    getScriptSnapshot: (path) => { const source = readFile(path); return source === undefined ? undefined : ts.ScriptSnapshot.fromString(source); },
    getCurrentDirectory: () => '/',
    getDefaultLibFileName: () => '/lib/lib.es2022.full.d.ts',
    fileExists: (path) => readFile(path) !== undefined,
    readFile,
    directoryExists: (path) => path === '/' || directories.has(path),
    getDirectories: () => [],
  });
  return ({ kind, code: source, position, name, entrySource, data }) => {
    if (source !== code) { code = source; version++; }
    if (kind === 'details') {
      const detail = service.getCompletionEntryDetails(filename, position, name, undefined, entrySource, undefined, data);
      return detail ? { signature: ts.displayPartsToString(detail.displayParts), documentation: ts.displayPartsToString(detail.documentation) } : null;
    }
    const result = service.getCompletionsAtPosition(filename, position, { includeCompletionsWithInsertText: true });
    if (!result) return null;
    const prefix = code.slice(0, position).match(/[\w$\u00a1-\uffff]*$/)[0];
    return { from: result.optionalReplacementSpan?.start ?? position - prefix.length,
      to: result.optionalReplacementSpan ? result.optionalReplacementSpan.start + result.optionalReplacementSpan.length : position,
      entries: result.entries.map(({ name, kind, insertText, replacementSpan, source, data, isRecommended }) => ({ name, kind, insertText, replacementSpan, source, data, isRecommended })) };
  };
}
