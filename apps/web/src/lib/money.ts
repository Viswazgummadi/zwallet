// SPDX-License-Identifier: GPL-3.0-only
// Money as integer minor units (ADR 0003). Every arithmetic step on money lives here; the rest of
// the app only moves `Minor` values around. Shared vectors: packages/contracts/fixtures/money.json.

declare const minorBrand: unique symbol;
/** An amount in minor units (paise for INR): a safe integer, never a fraction. */
export type Minor = number & { readonly [minorBrand]: true };

/** 2^53 − 1: the largest integer JavaScript and Kotlin both represent exactly. */
export const MAX_MINOR = Number.MAX_SAFE_INTEGER;
const BIG_MAX = BigInt(MAX_MINOR);

export function toMinor(n: number): Minor {
  if (!Number.isSafeInteger(n)) throw new RangeError('amount out of range');
  return n as Minor;
}

export type Grouping = 'indian' | 'western';
export interface Currency {
  readonly code: string;
  /** Minor digits: 2 for INR, 0 for JPY, 3 for KWD. */
  readonly exponent: number;
  /** Prefix symbol, or null to print the code and a space. */
  readonly symbol: string | null;
  readonly grouping: Grouping;
}

const RUPEE = String.fromCodePoint(0x20b9);
export const CURRENCIES: Readonly<Record<string, Currency>> = {
  INR: { code: 'INR', exponent: 2, symbol: RUPEE, grouping: 'indian' },
  USD: { code: 'USD', exponent: 2, symbol: '$', grouping: 'western' },
  EUR: { code: 'EUR', exponent: 2, symbol: String.fromCodePoint(0x20ac), grouping: 'western' },
  GBP: { code: 'GBP', exponent: 2, symbol: String.fromCodePoint(0xa3), grouping: 'western' },
  AED: { code: 'AED', exponent: 2, symbol: null, grouping: 'western' },
  JPY: { code: 'JPY', exponent: 0, symbol: String.fromCodePoint(0xa5), grouping: 'western' },
  KWD: { code: 'KWD', exponent: 3, symbol: null, grouping: 'western' },
};

export function currency(code: string): Currency | undefined {
  return CURRENCIES[code];
}

/** Error codes shared with Kotlin (fixtures/money.json). */
export type MoneyError =
  'empty' | 'invalid' | 'syntax' | 'too_many_decimals' | 'overflow' | 'unknown_currency';
export type MoneyResult<T> = { ok: true; value: T } | { ok: false; error: MoneyError };

const ok = <T>(value: T): MoneyResult<T> => ({ ok: true, value });
const err = (error: MoneyError): MoneyResult<never> => ({ ok: false, error });

export function addMinor(a: Minor, b: Minor): Minor {
  return checked(BigInt(a) + BigInt(b));
}

export function subMinor(a: Minor, b: Minor): Minor {
  return checked(BigInt(a) - BigInt(b));
}

function checked(v: bigint): Minor {
  if (v > BIG_MAX || v < -BIG_MAX) throw new RangeError('amount out of range');
  return Number(v) as Minor;
}

const pow10 = (n: number): bigint => 10n ** BigInt(n);

/** round-half-up(n / d) for n ≥ 0, d > 0. */
export function divHalfUp(n: bigint, d: bigint): bigint {
  return (2n * n + d) / (2n * d);
}

/** Digits with at most one '.', scaled by 10^exponent. Commas must already be removed. */
function parseScaled(s: string, exponent: number): MoneyResult<bigint> {
  if (!/^[0-9.]*$/.test(s) || (s.match(/\./g)?.length ?? 0) > 1 || !/[0-9]/.test(s))
    return err('invalid');
  const dot = s.indexOf('.');
  const intPart = dot < 0 ? s : s.slice(0, dot);
  const fracPart = dot < 0 ? '' : s.slice(dot + 1);
  if (fracPart.length > exponent) return err('too_many_decimals');
  const value = BigInt((intPart === '' ? '0' : intPart) + fracPart.padEnd(exponent, '0'));
  return value > BIG_MAX ? err('overflow') : ok(value);
}

/** User-typed amount → minor units. Commas ignored; at most `exponent` decimals; no signs. */
export function parseMoney(input: string, currencyCode: string): MoneyResult<Minor> {
  const cur = currency(currencyCode);
  if (!cur) return err('unknown_currency');
  const s = input.replace(/^ +| +$/g, '');
  if (s === '') return err('empty');
  const r = parseScaled(s.replaceAll(',', ''), cur.exponent);
  return r.ok ? ok(Number(r.value) as Minor) : r;
}

const MINUS = String.fromCodePoint(0x2212);
const TIMES = String.fromCodePoint(0xd7);

/**
 * Quick-add expressions (SPEC AC-4.2.4), exact: `120+45`, `0.1+0.2` (→ 30), `2.5×40`, `10+2×3`.
 * Each product is rounded once, half-up; a single trailing operator is ignored.
 */
export function evaluateExpression(input: string, currencyCode: string): MoneyResult<Minor> {
  const cur = currency(currencyCode);
  if (!cur) return err('unknown_currency');
  const s = input.replaceAll(' ', '');
  if (s === '') return err('empty');

  type Token = { num: string } | { op: '+' | '-' | '*' };
  const tokens: Token[] = [];
  for (let i = 0; i < s.length;) {
    const c = s.charAt(i);
    if (/[0-9.,]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.,]/.test(s.charAt(j))) j++;
      tokens.push({ num: s.slice(i, j) });
      i = j;
      continue;
    }
    if (c === '+') tokens.push({ op: '+' });
    else if (c === '-' || c === MINUS) tokens.push({ op: '-' });
    else if (c === '*' || c === TIMES) tokens.push({ op: '*' });
    else return err('syntax');
    i++;
  }
  // Drop exactly one trailing operator (live preview). What remains must be `num (op num)*`:
  // odd length and alternating, so `5++` or `5+×` is a syntax error rather than an empty term.
  const body =
    tokens.length > 0 && 'op' in tokens[tokens.length - 1]! ? tokens.slice(0, -1) : tokens;
  if (body.length % 2 !== 1 || !body.every((t, i) => (i % 2 === 0) === 'num' in t))
    return err('syntax');

  const scale = pow10(cur.exponent);
  let sum = 0n;
  let sign = 1n;
  let term: bigint[] = [];
  const flush = (): MoneyError | null => {
    const product = term.reduce((acc, f) => acc * f, 1n);
    const value = divHalfUp(product, scale ** BigInt(term.length - 1));
    if (value > BIG_MAX) return 'overflow';
    sum += sign * value;
    if (sum > BIG_MAX || sum < -BIG_MAX) return 'overflow';
    term = [];
    return null;
  };
  for (const t of body) {
    if ('num' in t) {
      const r = parseScaled(t.num.replaceAll(',', ''), cur.exponent);
      if (!r.ok) return err(r.error === 'invalid' ? 'syntax' : r.error);
      term.push(r.value);
    } else if (t.op !== '*') {
      const e = flush();
      if (e) return err(e);
      sign = t.op === '+' ? 1n : -1n;
    }
  }
  const e = flush();
  return e ? err(e) : ok(Number(sum) as Minor);
}
