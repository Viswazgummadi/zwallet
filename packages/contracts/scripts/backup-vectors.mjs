// SPDX-License-Identifier: GPL-3.0-only
// Builds fixtures/backup/*.zwallet and fixtures/backup/index.json (called by vectors.mjs).
//
// DETERMINISM / SECURITY NOTE: salt and IV are derived from the vector name (SHA-256) so the files
// regenerate identically. A fixed or derived IV is for these test vectors ONLY. Production code
// must draw a fresh random 16-byte salt and 12-byte IV for every file it writes.
// The gzip bytes depend on the zlib build, so `vectors:check` verifies the .zwallet files by
// decoding them against index.json (the index carries SHA-256 of the decrypted payload JSON,
// which is deterministic) instead of comparing ciphertext bytes.
import { createHash } from 'node:crypto';
import { encode, encodeText, decode, BackupError, TABLES, SCHEMA_VERSION, maxStamp } from '../lib/backup-reference.mjs';
import { stringifyFieldHlc } from '../lib/merge-reference.mjs';

export const PASSWORD = 'correct horse battery staple 42';
export const WRONG_PASSWORD = 'definitely the wrong password';

const derive = (name, tag, n) => createHash('sha256').update(`zwallet-vector:${name}:${tag}`).digest().subarray(0, n);
const cp = (...xs) => String.fromCodePoint(...xs);

export async function buildBackupVectors({ cases, spec, compaction }) {
  const H = (k) => cases.hlcs[k];
  const nth = (id, i) => id.slice(0, -2) + i.toString(16).padStart(2, '0');
  const row = (table, i, { hlc = 'H0', set = {}, stamp = {}, compacted = null } = {}) => {
    const t = cases.tables[table];
    const s = spec(table);
    const stamps = Object.fromEntries(Object.keys(s.groups).map((g) => [g, H(hlc)]));
    for (const [g, h] of Object.entries(stamp)) stamps[g] = H(h);
    let r = { ...t.base, id: nth(t.base.id, i), ...set };
    if (table === 'transaction_tags') r.id = nth(t.base.id, i);
    if (compacted) {
      for (const g of Object.keys(s.groups)) stamps[g] = H(compacted.hlc);
      r = { ...r, ...compaction.get(table), deleted_at: compacted.deleted_at };
    }
    r.field_hlc = stringifyFieldHlc(stamps);
    r.hlc = Object.values(stamps).reduce((a, b) => (a > b ? a : b), '');
    return Object.fromEntries(s.columns.map((c) => [c, r[c]]));
  };
  const empty = () => Object.fromEntries(TABLES.map((t) => [t, []]));
  const withRows = (o) => ({ ...empty(), ...o });

  const basicTables = withRows({
    transactions: [row('transactions', 1), row('transactions', 2, { hlc: 'A1', set: { amount_minor: 125050, note: 'lunch' } }), row('transactions', 3, { hlc: 'B1', set: { type: 'income', amount_minor: 5000000 } })],
    tags: [row('tags', 1)],
    ledger_entries: [row('ledger_entries', 1)],
  });
  const tombTables = withRows({
    transactions: [
      row('transactions', 1),
      row('transactions', 2, { hlc: 'A1', set: { deleted_at: 1760000100000 }, stamp: { deleted: 'A2' } }),
      row('transactions', 3, { compacted: { hlc: 'B2', deleted_at: 1760000200000 } }),
    ],
    transaction_tags: [row('transaction_tags', 1, { compacted: { hlc: 'B2', deleted_at: 1760000200000 } })],
  });
  const uni = [
    'caf' + cp(0xe9) + ' vs cafe' + cp(0x301), // NFC vs NFD
    cp(0x90f, 0x915, 0x20, 0x92a, 0x93e, 0x928, 0x940), // Devanagari
    'party ' + cp(0x1f389, 0x1f4b8) + ' ' + cp(0x1f469, 0x200d, 0x1f4bb), // astral + ZWJ
    cp(0x5d5, 0x5d0, 0x5d5) + ' ' + cp(0x627, 0x644, 0x633, 0x644, 0x627, 0x645), // RTL
    'line1\nline2\t"quoted" back\\slash ' + cp(0x2028, 0x2029) + ' ' + cp(0x7f, 0x1f),
  ];
  const uniTables = withRows({ transactions: uni.map((note, i) => row('transactions', i + 1, { set: { note, counterparty_raw: note } })) });

  const files = {};
  const index = [];
  const opts = (name, extra = {}) => ({ password: PASSWORD, salt: derive(name, 'salt', 16), iv: derive(name, 'iv', 12), ...extra });
  const add = async (name, text, expect, extra = {}) => {
    files[`${name}.zwallet`] = text;
    index.push({ name, file: `${name}.zwallet`, password: PASSWORD, ...extra, expect });
  };
  const ok = {};
  const header = (tables) => ({ schema_version: SCHEMA_VERSION, exported_at: 1760000000000, source_node: 'aaaaaaaa', max_hlc: maxStamp(tables), tables });
  const textOf = (tables, mutate = (s) => s) => mutate(JSON.stringify(header(tables)));
  const bad = (name, text, envelope = {}) => encodeText(text, opts(name, { envelope })).then((e) => JSON.stringify(e));

  await add('minimal_empty', await encode({ tables: empty() }, opts('minimal_empty')), ok);
  await add('basic', await encode({ tables: basicTables }, opts('basic')), ok);
  await add('tombstones', await encode({ tables: tombTables }, opts('tombstones')), ok);
  await add('unicode', await encode({ tables: uniTables }, opts('unicode')), ok);

  const basic = JSON.parse(files['basic.zwallet']);
  const variant = (name, f, expect, extra) => add(name, JSON.stringify(f(structuredClone(basic))), expect, extra);
  index.push({ name: 'wrong_password', file: 'basic.zwallet', password: WRONG_PASSWORD, expect: { error: 'wrong_password' } });
  await variant('tampered_header', (e) => ((e.created_by.app_version = '1.0.1'), e), { error: 'wrong_password' });
  await variant('tampered_ciphertext', (e) => {
    const b = Buffer.from(e.ciphertext, 'base64');
    b[Math.floor(b.length / 2)] ^= 0x01;
    e.ciphertext = b.toString('base64');
    return e;
  }, { error: 'wrong_password' });
  await variant('kdf_iterations_huge', (e) => ((e.kdf.iterations = 4294967295), e), { error: 'damaged' });
  await variant('kdf_iterations_low', (e) => ((e.kdf.iterations = 1000), e), { error: 'damaged' });
  await variant('wrong_format', (e) => ((e.format = 'something-else'), e), { error: 'damaged' });
  await add('garbage', 'this is not a zwallet file', { error: 'damaged' });
  index.push({ name: 'file_too_large', file: 'basic.zwallet', password: PASSWORD, options: { max_file_bytes: 1000 }, expect: { error: 'too_large' } });
  index.push({ name: 'plaintext_too_large', file: 'basic.zwallet', password: PASSWORD, options: { max_plaintext_bytes: 1024 }, expect: { error: 'too_large' } });

  await add('newer_format_version', await bad('newer_format_version', textOf(basicTables), { format_version: 2 }), { error: 'newer_schema' });
  await add('newer_schema_version', await bad('newer_schema_version', textOf(basicTables, (s) => s.replace(`"schema_version":${SCHEMA_VERSION}`, `"schema_version":${SCHEMA_VERSION + 1}`))), { error: 'newer_schema' });
  const badAmount = structuredClone(basicTables);
  badAmount.transactions[0].amount_minor = 0;
  await add('bad_row', await bad('bad_row', textOf(badAmount)), { error: 'invalid_row' });
  await add('non_plain_integer_decimal', await bad('non_plain_integer_decimal', textOf(basicTables, (s) => s.replace('"amount_minor":42000,', '"amount_minor":42000.0,'))), { error: 'invalid_row' });
  await add('non_plain_integer_exponent', await bad('non_plain_integer_exponent', textOf(basicTables, (s) => s.replace('"amount_minor":42000,', '"amount_minor":42e3,'))), { error: 'invalid_row' });
  await add('unsafe_integer', await bad('unsafe_integer', textOf(basicTables, (s) => s.replace('"amount_minor":42000,', '"amount_minor":9007199254740993,'))), { error: 'invalid_row' });
  const skew = { ...header(basicTables), max_hlc: '1760000999999-0000-aaaaaaaa' };
  await add('max_hlc_mismatch', await bad('max_hlc_mismatch', JSON.stringify(skew)), { error: 'damaged' });
  await add('payload_not_json', await bad('payload_not_json', '{"schema_version":1,'), { error: 'damaged' });

  // Fill expectations of the success files from the reference decoder (and self-check every entry).
  for (const e of index) {
    const text = files[e.file] ?? files['basic.zwallet'];
    const o = e.options ? { maxFileBytes: e.options.max_file_bytes, maxPlaintextBytes: e.options.max_plaintext_bytes } : {};
    let got;
    try {
      const r = await decode(text, e.password, Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)));
      got = { counts: r.counts, max_hlc: r.payload.max_hlc, payload_sha256: r.payloadSha256 };
    } catch (err) {
      if (!(err instanceof BackupError)) throw err;
      got = { error: err.code };
    }
    if (e.expect.error ? got.error !== e.expect.error : got.error) throw new Error(`backup vector ${e.name}: expected ${JSON.stringify(e.expect)}, got ${JSON.stringify(got)}`);
    e.expect = got;
  }
  return {
    files,
    index: {
      description:
        'Generated by scripts/backup-vectors.mjs (via vectors.mjs); never hand-edit. Every file decodes with `password` (default entries) to `expect`: either {counts, max_hlc, payload_sha256} (SHA-256 of the decrypted, gunzipped payload bytes; counts = rows per table) or {error} with one of wrong_password | damaged | newer_schema | too_large | invalid_row. `options` overrides the codec limits (max_file_bytes, max_plaintext_bytes) so too_large is testable with tiny files. Salt/IV are derived from the vector name: for vectors only, never reuse an IV in production. Decode tests must compare results, not ciphertext bytes (gzip output depends on zlib).',
      password: PASSWORD,
      error_codes: ['wrong_password', 'damaged', 'newer_schema', 'too_large', 'invalid_row'],
      entries: index,
    },
  };
}
