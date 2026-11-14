import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScriptLibraries } from '../scripts/typescript-libs.mjs';
import { createTypeScriptService } from '../web/typescript-service.js';

const libraries = await loadTypeScriptLibraries();
const javascript = createTypeScriptService(libraries, 'javascript');
const typescript = createTypeScriptService(libraries, 'typescript');
function names(complete, code) {
  return complete({ code, position: code.length })?.entries.map((entry) => entry.name) || [];
}

test('JavaScript completions infer local strings, arrays, objects and browser APIs', () => {
  assert.ok(names(javascript, 'const value = "hello"; value.').includes('toUpperCase'));
  assert.ok(!names(javascript, 'const value = "hello"; value.').includes('push'));
  assert.ok(names(javascript, 'const values = ["hello"]; values.').includes('map'));
  assert.ok(names(javascript, 'const metadata = { nonce: "abc", issuedAt: 0 }; metadata.').includes('nonce'));
  assert.ok(names(javascript, 'const url = new URL("https://example.com"); url.').includes('searchParams'));
});

test('TypeScript completions follow declared types, optional chaining and the current document', () => {
  assert.deepEqual(names(typescript, 'interface Claims { nonce: string; issuedAt: number; }\ndeclare const claims: Claims | undefined; claims?.').sort(), ['issuedAt', 'nonce']);
  assert.deepEqual(names(typescript, 'const claims = { audience: "client" }; claims.'), ['audience']);
  assert.ok(names(typescript, 'const clients: string[] = []; clients.').includes('filter'));
  assert.ok(names(typescript, 'const clients: string[] = []; clients[0].').includes('toLowerCase'));
});

test('standard library and Node.js imports supply member completions in both languages', () => {
  for (const complete of [javascript, typescript]) {
    assert.ok(names(complete, 'JSON.').includes('parse'));
    assert.ok(names(complete, 'import { createHash } from "node:crypto"; createHash("sha256").').includes('digest'));
    assert.ok(names(complete, 'const bytes = Buffer.from("abc"); bytes.').includes('toString'));
  }
});

test('completion replacement ranges and signatures preserve the typed prefix', () => {
  const code = 'const nonce = "abc"; nonce.toUp';
  const result = javascript({ code, position: code.length });
  assert.equal(code.slice(result.from, result.to), 'toUp');
  const entry = result.entries.find((entry) => entry.name === 'toUpperCase');
  assert.ok(entry);
  const detail = javascript({ kind: 'details', code, position: code.length, name: entry.name, entrySource: entry.source, data: entry.data });
  assert.match(detail.signature, /toUpperCase\(\): string/);
  assert.ok(detail.documentation);
});
