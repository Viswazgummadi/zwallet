// SPDX-License-Identifier: GPL-3.0-only
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fixture } from '../test/fixtures.ts';
import { formatCompact, formatMoney, type MoneyStyle } from './format.ts';
import { CURRENCIES, MAX_MINOR, evaluateExpression, parseMoney, type MoneyError } from './money.ts';

interface Case {
  input?: string;
  currency: string;
  minor?: number;
  error?: MoneyError;
  style?: MoneyStyle;
  text?: string;
}
interface Section {
  cases: Case[];
}
const money = fixture<{
  max_minor: number;
  parse: Section;
  format: Section;
  compact: Section;
  expression: Section;
}>('money.json');
const expected = (c: Case) =>
  c.error ? { ok: false, error: c.error } : { ok: true, value: c.minor };
const cur = (code: string) => {
  const c = CURRENCIES[code];
  if (!c) throw new Error(`unknown currency ${code}`);
  return c;
};

describe('money vectors (packages/contracts/fixtures/money.json)', () => {
  it('shares MAX_MINOR with Kotlin', () => {
    expect(MAX_MINOR).toBe(money.max_minor);
  });
  it.each(money.parse.cases)('parse $input $currency', (c) => {
    expect(parseMoney(c.input!, c.currency)).toEqual(expected(c));
  });
  it.each(money.format.cases)('format $minor $currency $style', (c) => {
    expect(formatMoney(c.minor!, cur(c.currency), c.style)).toBe(c.text);
  });
  it.each(money.compact.cases)('compact $minor $currency', (c) => {
    expect(formatCompact(c.minor!, cur(c.currency))).toBe(c.text);
  });
  it.each(money.expression.cases)('expression $input $currency', (c) => {
    expect(evaluateExpression(c.input!, c.currency)).toEqual(expected(c));
  });
});

describe('money properties', () => {
  it('format → parse round-trips every amount in every currency', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX_MINOR }), (minor) => {
        for (const code of ['INR', 'USD', 'JPY', 'KWD']) {
          const c = cur(code);
          const text = formatMoney(minor, c).slice((c.symbol ?? `${c.code} `).length);
          expect(parseMoney(text, code)).toEqual({ ok: true, value: minor });
        }
      }),
      { numRuns: 2000 },
    );
  });
  it('a + b as an expression equals the integer sum (no float drift)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e9 }), fc.integer({ min: 0, max: 1e9 }), (a, b) => {
        const inr = cur('INR');
        const expr = `${formatMoney(a, inr).slice(1)}+${formatMoney(b, inr).slice(1)}`;
        expect(evaluateExpression(expr, 'INR')).toEqual({ ok: true, value: a + b });
      }),
      { numRuns: 2000 },
    );
  });
});
