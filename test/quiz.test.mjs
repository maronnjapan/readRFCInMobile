import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../test-support/quiz-worker.mjs';
import { validateSet, validateAnswers, validateGrades } from '../worker/contracts.js';
import { excerpt, inScope } from '../tools/authoring/context.mjs';

test('the sample has separate public questions, solutions and pinned source material', () => {
  const value = validateSet(fixture, { published: true });
  assert.equal(value.public.questions[0].answer, undefined);
  assert.equal(value.public.solutions, undefined);
  assert.equal(value.public.references[0].excerpt, undefined);
  assert.ok(value.materials['jwt-claims'].includes('client_id'));
  assert.equal(value.solutions['client-sub'].answer, 0);
});
test('rejects mutable references, missing rubrics, unpublished candidates and invalid answers', () => {
  for (const change of [
    (v) => { v.references[0].commit = 'main'; },
    (v) => { v.solutions['audience-validation'].rubric[0].points = 10; },
    (v) => { v.status = 'draft'; },
    (v) => { v.questions[0].referenceIds = ['invented']; },
    (v) => { v.questions[0].options = ['same', 'same']; },
  ]) { const value = structuredClone(fixture); change(value); assert.throws(() => validateSet(value, { published: true })); }
  const set = validateSet(fixture).public;
  assert.throws(() => validateAnswers({ 'client-sub': 0 }, set));
  assert.throws(() => validateAnswers({ 'client-sub': 8, 'audience-validation': '回答' }, set));
  assert.throws(() => validateGrades({ grades: [{ questionId: 'audience-validation', score: 100, reason: '理由', referenceIds: ['jwt-claims'] }] }, set));
});
test('code search limits paths and preserves line numbers around a keyword', () => {
  assert.ok(inScope('src/auth.js', ['src/']));
  assert.equal(inScope('../secret', ['../']), false);
  assert.equal(inScope('scripts/run.sh', ['src/']), false);
  const content = Array.from({ length: 100 }, (_, i) => i === 50 ? 'validate audience' : `line ${i + 1}`).join('\n');
  const result = excerpt(content, ['audience']);
  assert.equal(result.startLine, 36);
  assert.ok(result.excerpt.includes('validate audience'));
});
