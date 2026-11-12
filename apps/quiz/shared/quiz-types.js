export const QUESTION_CATEGORIES = Object.freeze({
  vocabulary: '単語の意味',
  knowledge: '知識',
  flow: 'フロー構築',
  design: 'ユースケース設計',
  debugging: '誤り発見・原因特定',
  comparison: '比較・使い分け',
});
export const ANSWER_TYPES = Object.freeze({ choice: '選択式', ordering: '並べ替え', written: '記述式' });
export const categoryOf = (question) => question.category ?? 'knowledge';
export const isImmediate = (question) => question.type === 'choice' || question.type === 'ordering';
export const sameAnswer = (a, b) => JSON.stringify(a) === JSON.stringify(b);
