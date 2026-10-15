// SPDX-License-Identifier: GPL-3.0-only
// Reference implementation of zwallet's deterministic ids (ADR 0010, ADR 0013). Used to generate
// fixtures/uuid.json and seed ids. Both apps re-implement this and are tested against the vectors.
import { createHash } from 'node:crypto';

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest();

/** RFC 9562 UUIDv8 from the first 128 bits of SHA-256(name). */
export function uuidV8(name) {
  const b = Buffer.from(sha256(name).subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x80; // version 8
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 9562 variant (0b10)
  return formatUuid(b);
}

/** RFC 9562 UUIDv7 from unix ms + 10 random bytes (rand_a = 12 bits, rand_b = 62 bits). */
export function uuidV7(unixMs, rand10) {
  const b = Buffer.alloc(16);
  b.writeUIntBE(unixMs, 0, 6);
  b[6] = 0x70 | (rand10[0] & 0x0f);
  b[7] = rand10[1];
  b[8] = 0x80 | (rand10[2] & 0x3f);
  for (let i = 3; i < 10; i++) b[i + 6] = rand10[i];
  return formatUuid(b);
}

function formatUuid(b) {
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Unicode White_Space (not JS \s, not Java \s — they differ): U+0009–U+000D, U+0020, U+0085,
 * U+00A0, U+1680, U+2000–U+200A, U+2028, U+2029, U+202F, U+205F, U+3000.
 */
const WS_RANGES = [
  [0x09, 0x0d], [0x20, 0x20], [0x85, 0x85], [0xa0, 0xa0], [0x1680, 0x1680], [0x2000, 0x200a],
  [0x2028, 0x2029], [0x202f, 0x202f], [0x205f, 0x205f], [0x3000, 0x3000],
];
const ch = (n) => String.fromCodePoint(n);
export const WHITE_SPACE = new RegExp(
  `[${WS_RANGES.map(([a, b]) => (a === b ? ch(a) : `${ch(a)}-${ch(b)}`)).join('')}]+`,
  'g',
);

/** Strip the DLT operator prefix ("VM-") and the -S/-T/-P suffix, then upper-case. */
export function normalizeSender(sender) {
  return sender
    .trim()
    .replace(/^[A-Za-z]{2}-/, '')
    .replace(/-[STPstp]$/, '')
    .toUpperCase();
}

/** Trim and collapse every run of Unicode White_Space to a single U+0020. */
export function normalizeBody(body) {
  return body.replace(WHITE_SPACE, ' ').replace(/^ | $/g, '');
}

/** Deterministic id of an SMS-sourced transaction (ADR 0010). dateSentSeconds: integer. */
export function smsId(sender, body, dateSentSeconds) {
  const bodyHash = sha256(normalizeBody(body)).toString('hex');
  return uuidV8(`sms:v1|${normalizeSender(sender)}|${bodyHash}|${dateSentSeconds}`);
}

export const seedId = (systemKey) => uuidV8(`seed:v1|${systemKey}`);
export const transactionTagId = (transactionId, tagId) => uuidV8(`tt:v1|${transactionId}|${tagId}`);
export const insightDismissalId = (ruleId, subjectKey) => uuidV8(`insight:v1|${ruleId}|${subjectKey}`);
