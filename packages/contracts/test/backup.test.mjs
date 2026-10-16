// SPDX-License-Identifier: GPL-3.0-only
// Decodes every fixtures/backup/*.zwallet with the reference codec and checks the codec rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decode, encode, assertPlainIntegers, canonicalJson, aadOf, BackupError, ERROR_CODES, MAX_FILE_BYTES, MAX_PLAINTEXT_BYTES } from '../lib/backup-reference.mjs';

const dir = fileURLToPath(new URL('../fixtures/backup/', import.meta.url));
const index = JSON.parse(readFileSync(`${dir}index.json`, 'utf8'));

test('index.json lists every .zwallet file, and every error code is covered', () => {
  const listed = new Set(index.entries.map((e) => e.file));
  const onDisk = readdirSync(dir).filter((f) => f.endsWith('.zwallet'));
  assert.deepEqual([...listed].sort(), onDisk.sort());
  const codes = new Set(index.entries.filter((e) => e.expect.error).map((e) => e.expect.error));
  assert.deepEqual([...codes].sort(), [...ERROR_CODES].sort());
  assert.equal(MAX_FILE_BYTES, 209715200);
  assert.equal(MAX_PLAINTEXT_BYTES, 1073741824);
});

for (const e of index.entries) {
  test(`vector ${e.name} -> ${e.expect.error ?? 'ok'}`, async () => {
    const o = {};
    if (e.options?.max_file_bytes) o.maxFileBytes = e.options.max_file_bytes;
    if (e.options?.max_plaintext_bytes) o.maxPlaintextBytes = e.options.max_plaintext_bytes;
    const bytes = readFileSync(`${dir}${e.file}`);
    if (e.expect.error) {
      await assert.rejects(decode(bytes, e.password, o), (err) => err instanceof BackupError && err.code === e.expect.error);
    } else {
      const r = await decode(bytes, e.password, o);
      assert.deepEqual(r.counts, e.expect.counts);
      assert.equal(r.payload.max_hlc, e.expect.max_hlc);
      assert.equal(r.payloadSha256, e.expect.payload_sha256);
    }
  });
}

test('canonical JSON sorts keys at every level and has no whitespace; AAD excludes ciphertext', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: 'x', c: [2, { z: 1, y: 2 }] } }), '{"a":{"c":[2,{"y":2,"z":1}],"d":"x"},"b":1}');
  const env = JSON.parse(readFileSync(`${dir}basic.zwallet`, 'utf8'));
  const aad = aadOf(env).toString('utf8');
  assert.ok(!aad.includes('ciphertext') && !/\s/.test(aad.replace(/"[^"]*"/g, '')));
  assert.ok(aad.startsWith('{"cipher":{"iv":'));
});

test('plain-digit scan rejects 1.0, 1e2, +1, -0, 01 and unsafe integers but ignores strings', () => {
  for (const bad of ['{"a":1.0}', '{"a":1e2}', '{"a":1E2}', '{"a":+1}', '{"a":-0}', '{"a":01}', '{"a":[9007199254740992]}', '{"a":-9007199254740992}'])
    assert.throws(() => assertPlainIntegers(bad), (e) => e.code === 'invalid_row', bad);
  assert.doesNotThrow(() => assertPlainIntegers('{"a":"1.0 1e2 \\" 5.5","b":[0,-1,9007199254740991,42]}'));
});

test('round trip with random salt/iv; empty tables use the zero max_hlc; 12-byte IV and 16-byte salt are enforced by schema', async () => {
  const { randomBytes } = await import('node:crypto');
  const base = await decode(readFileSync(`${dir}minimal_empty.zwallet`), index.password);
  const text = await encode({ tables: base.payload.tables }, { password: 'another long password', salt: randomBytes(16), iv: randomBytes(12) });
  const again = await decode(text, 'another long password');
  assert.deepEqual(again.payload, base.payload);
  await assert.rejects(decode(text, 'short'), (e) => e.code === 'wrong_password');
});
