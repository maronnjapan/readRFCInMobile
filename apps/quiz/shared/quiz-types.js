export const QUESTION_CATEGORIES = Object.freeze({
  vocabulary: '単語の意味',
  knowledge: '知識',
  flow: 'フロー構築',
  design: 'ユースケース設計',
  debugging: '誤り発見・原因特定',
  comparison: '比較・使い分け',
  implementation: 'ケースに基づく実装',
});
export const ANSWER_TYPES = Object.freeze({ choice: '選択式', ordering: '並べ替え', written: '記述式', implementation: 'コード実装' });
export const CODE_LANGUAGES = Object.freeze({ javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python' });
export const categoryOf = (question) => question.category ?? 'knowledge';
export const isImmediate = (question) => question.type === 'choice' || question.type === 'ordering';
export const needsGrading = (question) => !isImmediate(question);
export const sameAnswer = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 回答開始時に形式を固定し、画面幅が変わっても保存済み回答の意味を変えない。
export function setForAttempt(set, implementationMode = 'code') {
  if (implementationMode !== 'reading') return set;
  return { ...set, questions: set.questions.map((q) => q.type === 'implementation' ? {
    ...q, type: 'choice', implementationMode: 'reading',
    prompt: q.implementation.mobile.prompt, options: q.implementation.mobile.options,
  } : q) };
}
