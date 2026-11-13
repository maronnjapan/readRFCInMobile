import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceTargetIndex } from '../src/source-location.js';

test('source links find a heading despite formatting and RFC page headers', () => {
  const source = '\nAuthor                        [Page 3]\n\f\nRFC 9449              DPoP              September 2023\n\n4.3.  Checking DPoP Proofs\n';
  assert.equal(sourceTargetIndex(source, 2, 7, ['Introduction', '4.3Checking DPoP Proofs', 'Other text']), 1);
});

test('source links find a definition or numbered item instead of its containing text', () => {
  assert.equal(sourceTargetIndex('   token_endpoint_auth_method\r\n      String indicator.', 1, 2,
    ['Metadata mentions token_endpoint_auth_method.', 'token_endpoint_auth_method', 'String indicator.']), 1);
  assert.equal(sourceTargetIndex('   1.  The issuer MUST be verified.\n       by the recipient.', 1, 2,
    ['Outer item: The issuer MUST be verified. by the recipient.', 'The issuer MUST be verified. by the recipient.']), 1);
});

test('a reference starting within a wrapped paragraph finds the displayed paragraph', () => {
  const source = 'Other text.\n   To request a token that is bound\n   to a public key, send a DPoP proof.\n';
  assert.equal(sourceTargetIndex(source, 3, 3, ['Other text.', 'To request a token that is bound to a public key, send a DPoP proof.']), 1);
});

test('invalid and missing source ranges leave the reader without a target', () => {
  for (const [start, end] of [[0, 1], [2, 1], [1.5, 2], [1, Infinity], [5, 6]]) {
    assert.equal(sourceTargetIndex('Text.', start, end, ['Text.']), -1);
  }
  assert.equal(sourceTargetIndex('Unrelated text.', 1, 1, ['Text.']), -1);
});
