// SPDX-License-Identifier: GPL-3.0-only
// Money → text, the only place money becomes a string (fixtures/money.json "format", "compact").
import { divHalfUp, type Currency, type Grouping } from './money.ts';

/** U+2212 MINUS SIGN for negative amounts (not the ASCII hyphen). */
export const MINUS_SIGN = String.fromCodePoint(0x2212);

/** full = every minor digit; list = drop an all-zero fraction (SPEC §4.1). */
export type MoneyStyle = 'full' | 'list';

export function group(digits: string, grouping: Grouping): string {
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3);
  const tail = digits.slice(-3);
  const size = grouping === 'indian' ? 2 : 3;
  const parts: string[] = [];
  for (let end = head.length; end > 0; end -= size)
    parts.unshift(head.slice(Math.max(0, end - size), end));
  return `${parts.join(',')},${tail}`;
}

export function formatMoney(minor: number, cur: Currency, style: MoneyStyle = 'full'): string {
  const abs = BigInt(minor) < 0n ? -BigInt(minor) : BigInt(minor);
  const digits = abs.toString().padStart(cur.exponent + 1, '0');
  const intPart = digits.slice(0, digits.length - cur.exponent);
  const frac = digits.slice(digits.length - cur.exponent);
  const showFrac = cur.exponent > 0 && !(style === 'list' && /^0+$/.test(frac));
  const prefix = cur.symbol ?? `${cur.code} `;
  return `${minor < 0 ? MINUS_SIGN : ''}${prefix}${group(intPart, cur.grouping)}${showFrac ? `.${frac}` : ''}`;
}

const INDIAN_UNITS: ReadonlyArray<readonly [bigint, string]> = [
  [1_000n, 'K'],
  [100_000n, 'L'],
  [10_000_000n, 'Cr'],
];
const WESTERN_UNITS: ReadonlyArray<readonly [bigint, string]> = [
  [1_000n, 'K'],
  [1_000_000n, 'M'],
  [1_000_000_000n, 'B'],
];

/** Chart/axis label without a symbol: 950 · 9.5K · 1.2L · 3.4Cr; rounds half-up, promotes units. */
export function formatCompact(minor: number, cur: Currency): string {
  const abs = BigInt(minor) < 0n ? -BigInt(minor) : BigInt(minor);
  const scale = 10n ** BigInt(cur.exponent);
  const units = cur.grouping === 'indian' ? INDIAN_UNITS : WESTERN_UNITS;
  const sign = minor < 0 ? MINUS_SIGN : '';
  const unit = (i: number) => units[i]![0];
  const tenthsOf = (i: number) => divHalfUp(abs * 10n, unit(i) * scale);

  let idx = -1;
  units.forEach(([u], i) => {
    if (abs >= u * scale) idx = i;
  });
  if (idx < 0) {
    const whole = divHalfUp(abs, scale);
    if (whole < unit(0)) return sign + group(whole.toString(), cur.grouping);
    idx = 0;
  }
  let tenths = tenthsOf(idx);
  while (idx < units.length - 1 && tenths >= (10n * unit(idx + 1)) / unit(idx)) {
    idx++;
    tenths = tenthsOf(idx);
  }
  const whole = tenths / 10n;
  const dec = tenths % 10n;
  return `${sign}${group(whole.toString(), cur.grouping)}${dec !== 0n ? `.${dec}` : ''}${units[idx]![1]}`;
}
