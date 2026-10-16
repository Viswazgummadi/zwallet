// SPDX-License-Identifier: GPL-3.0-only
// Row ids (ADR 0010, ADR 0013, RFC 9562): UUIDv7 for new manual rows, UUIDv8 of a namespaced name
// for rows that must merge across copies. WebCrypto only. Vectors: fixtures/uuid.json.

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

function formatUuid(b: Uint8Array): string {
  const h = hex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

/** UUIDv7 from unix ms and 10 random bytes (rand_a = 12 bits, rand_b = 62 bits). */
export function uuidV7(unixMs: number, rand10: Uint8Array): string {
  if (rand10.length !== 10) throw new Error('need 10 random bytes');
  const b = new Uint8Array(16);
  let ms = BigInt(unixMs);
  for (let i = 5; i >= 0; i--) {
    b[i] = Number(ms & 0xffn);
    ms >>= 8n;
  }
  b[6] = 0x70 | (rand10[0]! & 0x0f);
  b[7] = rand10[1]!;
  b[8] = 0x80 | (rand10[2]! & 0x3f);
  for (let i = 3; i < 10; i++) b[i + 6] = rand10[i]!;
  return formatUuid(b);
}

export function newUuidV7(nowMs: number = Date.now()): string {
  return uuidV7(nowMs, crypto.getRandomValues(new Uint8Array(10)));
}

/** UUIDv8 from the first 128 bits of SHA-256(UTF-8 name). */
export async function uuidV8(name: string): Promise<string> {
  const b = (await sha256(name)).slice(0, 16);
  b[6] = 0x80 | (b[6]! & 0x0f);
  b[8] = 0x80 | (b[8]! & 0x3f);
  return formatUuid(b);
}

/** Unicode White_Space (not JS \s): U+0009–000D, 0020, 0085, 00A0, 1680, 2000–200A, 2028, 2029, 202F, 205F, 3000. */
export function isWhiteSpace(c: number): boolean {
  return (
    (c >= 0x09 && c <= 0x0d) ||
    c === 0x20 ||
    c === 0x85 ||
    c === 0xa0 ||
    c === 0x1680 ||
    (c >= 0x2000 && c <= 0x200a) ||
    c === 0x2028 ||
    c === 0x2029 ||
    c === 0x202f ||
    c === 0x205f ||
    c === 0x3000
  );
}

/** Collapses runs of White_Space to one U+0020 and trims. */
export function normalizeBody(body: string): string {
  let out = '';
  let pendingSpace = false;
  for (const ch of body) {
    if (isWhiteSpace(ch.codePointAt(0)!)) {
      pendingSpace = out.length > 0;
    } else {
      if (pendingSpace) out += ' ';
      pendingSpace = false;
      out += ch;
    }
  }
  return out;
}

/**
 * Trims Unicode White_Space only. Not String.prototype.trim, which also strips U+FEFF (Kotlin's
 * trim() strips U+001C–U+001F instead); both apps must agree for SMS ids to match.
 */
export function trimWhiteSpace(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && isWhiteSpace(s.charCodeAt(start))) start++;
  while (end > start && isWhiteSpace(s.charCodeAt(end - 1))) end--;
  return s.slice(start, end);
}

/** Trims White_Space, strips the DLT prefix ("VM-") and the -S/-T/-P suffix, then upper-cases. */
export function normalizeSender(sender: string): string {
  return trimWhiteSpace(sender)
    .replace(/^[A-Za-z]{2}-/, '')
    .replace(/-[STPstp]$/, '')
    .toUpperCase();
}

/** Id of an SMS-sourced transaction: the same SMS on any device → the same row (ADR 0010). */
export async function smsId(
  sender: string,
  body: string,
  dateSentSeconds: number,
): Promise<string> {
  if (!Number.isSafeInteger(dateSentSeconds))
    throw new RangeError('dateSentSeconds must be a safe integer');
  const bodyHash = hex(await sha256(normalizeBody(body)));
  return uuidV8(`sms:v1|${normalizeSender(sender)}|${bodyHash}|${dateSentSeconds}`);
}

export const seedId = (systemKey: string): Promise<string> => uuidV8(`seed:v1|${systemKey}`);
export const transactionTagId = (transactionId: string, tagId: string): Promise<string> =>
  uuidV8(`tt:v1|${transactionId}|${tagId}`);
export const insightDismissalId = (ruleId: string, subjectKey: string): Promise<string> =>
  uuidV8(`insight:v1|${ruleId}|${subjectKey}`);
