// SPDX-License-Identifier: GPL-3.0-only
// Reference codec for the .zwallet file (ARCHITECTURE §5.3, ADR 0013/0018). Node WebCrypto + zlib,
// no dependencies. The Kotlin and TS implementations must reproduce every decision here and are
// tested against fixtures/backup/index.json (README "The .zwallet codec").
//
// File = UTF-8 JSON envelope. AAD = canonical JSON (keys sorted at every level, no whitespace,
// strings as JSON.stringify writes them: only " \ and control chars escaped, non-ASCII verbatim) of
// every envelope field except `ciphertext`. Plaintext = gzip(UTF-8 JSON payload).
import { webcrypto, createHash } from 'node:crypto';
import { createGunzip, gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validate } from './row-schema.mjs';
import { parseFieldHlc } from './merge-reference.mjs';

const { subtle } = webcrypto;

export const MAX_FILE_BYTES = 200 * 1024 * 1024;
export const MAX_PLAINTEXT_BYTES = 1024 * 1024 * 1024;
export const FORMAT_VERSION = 1;
export const ZERO_HLC = '0000000000000-0000-00000000';
export const ERROR_CODES = ['wrong_password', 'damaged', 'newer_schema', 'too_large', 'invalid_row'];

export class BackupError extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
    this.detail = detail;
  }
}

const schemaFile = (n) => JSON.parse(readFileSync(fileURLToPath(new URL(`../schema/${n}`, import.meta.url)), 'utf8'));
const envelopeSchema = schemaFile('zwallet-envelope.json');
const payloadSchema = schemaFile('zwallet-payload.json');
export const SCHEMA_VERSION = payloadSchema.properties.schema_version.const;
export const TABLES = Object.keys(payloadSchema.properties.tables.properties);
const refs = Object.fromEntries(TABLES.map((t) => [`${t}.json`, schemaFile(`${t}.json`)]));

/** Canonical JSON: object keys sorted (UTF-16 code unit order), no whitespace. */
export function canonicalJson(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(',')}}`;
}
export const aadOf = (envelope) => {
  const { ciphertext: _c, ...rest } = envelope;
  return Buffer.from(canonicalJson(rest), 'utf8');
};

const keyCache = new Map();
async function deriveKey(password, salt, iterations) {
  const id = `${password}|${salt.toString('hex')}|${iterations}`;
  if (!keyCache.has(id)) {
    const base = await subtle.importKey('raw', Buffer.from(password, 'utf8'), 'PBKDF2', false, ['deriveKey']);
    keyCache.set(
      id,
      await subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']),
    );
  }
  return keyCache.get(id);
}

/** max over every row `hlc` and every `field_hlc` stamp; ZERO_HLC when there are no rows. */
export function maxStamp(tables) {
  let max = ZERO_HLC;
  for (const rows of Object.values(tables))
    for (const r of rows) {
      if (r.hlc > max) max = r.hlc;
      for (const h of Object.values(parseFieldHlc(r.field_hlc))) if (h > max) max = h;
    }
  return max;
}

/**
 * Low-level encoder: encrypt exactly `plaintext` text (any string; vectors use it for bad
 * payloads). `salt`/`iv` are Buffers (16/12 bytes); production code MUST use fresh random bytes
 * (a fixed IV is for deterministic test vectors only). `envelope` overrides/extends envelope
 * fields before AAD is computed.
 */
export async function encodeText(plaintext, { password, salt, iv, iterations = 600000, createdBy = { app: 'zwallet-web', app_version: '1.0.0' }, envelope = {} }) {
  const kdf = { name: 'PBKDF2-HMAC-SHA256', iterations, salt: salt.toString('base64') };
  const cipher = { name: 'AES-256-GCM', iv: iv.toString('base64') };
  const env = { format: 'zwallet-backup', format_version: FORMAT_VERSION, kdf, cipher, created_by: createdBy, ...envelope };
  const key = await deriveKey(password, salt, iterations);
  const ct = Buffer.from(
    await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aadOf(env), tagLength: 128 }, key, gzipSync(Buffer.from(plaintext, 'utf8'), { level: 9 })),
  );
  return { ...env, ciphertext: ct.toString('base64') };
}

/** Encodes a payload object (`tables` required; header fields default) → file text. */
export async function encode(payload, opts) {
  const body = {
    schema_version: SCHEMA_VERSION,
    exported_at: 1760000000000,
    source_node: 'aaaaaaaa',
    max_hlc: maxStamp(payload.tables),
    ...payload,
  };
  return JSON.stringify(await encodeText(JSON.stringify(body), opts));
}

/**
 * Rejects number tokens that are not plain digits: `1.0`, `1e2`, `+1`, `-0`, `01`, and integers
 * outside +-(2^53-1). Scans the raw text outside string literals, before JSON.parse can normalise.
 */
export function assertPlainIntegers(text) {
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text.charCodeAt(i);
    if (c === 0x22) {
      i++;
      while (i < n && text.charCodeAt(i) !== 0x22) i += text.charCodeAt(i) === 0x5c ? 2 : 1;
      i++;
    } else if (c === 0x2d || (c >= 0x30 && c <= 0x39) || c === 0x2b || c === 0x2e) {
      let j = i;
      while (j < n && /[-+.0-9eE]/.test(text[j])) j++;
      const tok = text.slice(i, j);
      if (!/^-?(0|[1-9][0-9]*)$/.test(tok) || tok === '-0' || !Number.isSafeInteger(Number(tok)))
        throw new BackupError('invalid_row', `non-plain integer ${tok.slice(0, 32)}`);
      i = j;
    } else i++;
  }
}

async function gunzipCapped(buf, cap) {
  const gz = createGunzip();
  const chunks = [];
  let total = 0;
  const done = new Promise((resolve, reject) => {
    gz.on('data', (d) => {
      total += d.length;
      if (total > cap) {
        gz.destroy();
        reject(new BackupError('too_large', `plaintext > ${cap} bytes`));
      } else chunks.push(d);
    });
    gz.on('end', resolve);
    gz.on('error', () => reject(new BackupError('damaged', 'gzip')));
  });
  gz.end(buf);
  await done;
  return Buffer.concat(chunks);
}

const b64 = (s) => Buffer.from(s, 'base64');

/**
 * Decodes and fully validates a file. Returns {envelope, payload, counts, payloadSha256}.
 * Throws BackupError with code in ERROR_CODES. Order of checks (first failure wins):
 *  1 file > maxFileBytes -> too_large
 *  2 envelope not UTF-8/JSON, not matching the envelope schema, or `format` wrong -> damaged
 *    (format_version above ours is checked first -> newer_schema)
 *  3 AES-GCM failure (wrong password, tampered header or ciphertext are indistinguishable)
 *    -> wrong_password
 *  4 gunzip failure -> damaged; output above maxPlaintextBytes -> too_large
 *  5 payload not UTF-8 / JSON -> damaged
 *  6 non-plain integer anywhere in the payload -> invalid_row
 *  7 schema_version above ours -> newer_schema
 *  8 payload header invalid -> damaged; any row invalid -> invalid_row
 *  9 max_hlc != max stamp over the rows -> damaged
 * clock_ahead is the importer's job (needs the device clock), not the codec's.
 */
export async function decode(fileBytes, password, { maxFileBytes = MAX_FILE_BYTES, maxPlaintextBytes = MAX_PLAINTEXT_BYTES } = {}) {
  const bytes = typeof fileBytes === 'string' ? Buffer.from(fileBytes, 'utf8') : Buffer.from(fileBytes);
  if (bytes.length > maxFileBytes) throw new BackupError('too_large', `file > ${maxFileBytes} bytes`);
  let envelope;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    assertPlainIntegers(text);
    envelope = JSON.parse(text);
  } catch (e) {
    throw new BackupError('damaged', e instanceof BackupError ? e.detail : 'envelope is not JSON');
  }
  if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope) || envelope.format !== 'zwallet-backup')
    throw new BackupError('damaged', 'not a zwallet backup');
  if (Number.isInteger(envelope.format_version) && envelope.format_version > FORMAT_VERSION)
    throw new BackupError('newer_schema', `format_version ${envelope.format_version}`);
  const envErrors = validate(envelopeSchema, envelope);
  if (envErrors.length) throw new BackupError('damaged', envErrors[0]);
  const salt = b64(envelope.kdf.salt);
  const iv = b64(envelope.cipher.iv);
  let plain;
  try {
    const key = await deriveKey(password, salt, envelope.kdf.iterations);
    plain = Buffer.from(await subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aadOf(envelope), tagLength: 128 }, key, b64(envelope.ciphertext)));
  } catch {
    throw new BackupError('wrong_password');
  }
  const raw = await gunzipCapped(plain, maxPlaintextBytes);
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
    JSON.parse(text);
  } catch {
    throw new BackupError('damaged', 'payload is not UTF-8 JSON');
  }
  assertPlainIntegers(text);
  const payload = JSON.parse(text);
  if (Number.isInteger(payload?.schema_version) && payload.schema_version > SCHEMA_VERSION)
    throw new BackupError('newer_schema', `schema_version ${payload.schema_version}`);
  const errors = validate(payloadSchema, payload, { refs });
  if (errors.length) {
    const rowErr = errors.find((e) => /^\$\.tables\.[a-z_]+\[/.test(e));
    throw new BackupError(rowErr ? 'invalid_row' : 'damaged', (rowErr ?? errors[0]).slice(0, 200));
  }
  let max;
  try {
    max = maxStamp(payload.tables);
  } catch {
    throw new BackupError('invalid_row', 'malformed field_hlc');
  }
  if (max !== payload.max_hlc) throw new BackupError('damaged', `max_hlc ${payload.max_hlc} != ${max}`);
  const counts = Object.fromEntries(TABLES.map((t) => [t, payload.tables[t].length]));
  return { envelope, payload, counts, payloadSha256: createHash('sha256').update(raw).digest('hex') };
}
