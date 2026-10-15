// SPDX-License-Identifier: GPL-3.0-only
// Accessibility guarantees of the token set (MASTER_PROMPT §2.7, DESIGN §2, §9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODES, palette, contrast, tokens, GLYPH_MIN_CONTRAST } from '../resolve.ts';

const TEXT = [
  'inkPrimary',
  'inkSecondary',
  'inkMuted',
  'amountIncome',
  'amountExpense',
  'amountTransfer',
  'primary',
];
const SURFACES = ['page', 'surface', 'surfaceRaised', 'surfaceSunken'];

for (const mode of MODES) {
  const p = palette(mode);

  test(`${mode}: text tokens reach 4.5:1 on every surface`, () => {
    for (const fg of TEXT) {
      for (const bg of SURFACES) {
        const r = contrast(p.neutrals[fg], p.neutrals[bg]);
        assert.ok(r >= 4.5, `${fg} on ${bg} = ${r.toFixed(2)}`);
      }
    }
    assert.ok(contrast(p.neutrals.onPrimary, p.neutrals.primary) >= 4.5, 'onPrimary on primary');
    assert.ok(
      contrast(p.neutrals.onPrimaryContainer, p.neutrals.primaryContainer) >= 4.5,
      'onPrimaryContainer on primaryContainer',
    );
  });

  test(`${mode}: focus ring and hairline-free UI indicators reach 3:1 (WCAG 1.4.11)`, () => {
    for (const bg of SURFACES) {
      const r = contrast(p.neutrals.focusRing, p.neutrals[bg]);
      assert.ok(r >= 3, `focusRing on ${bg} = ${r.toFixed(2)}`);
    }
  });

  test(`${mode}: every category glyph reaches ${GLYPH_MIN_CONTRAST}:1 on its container`, () => {
    for (const [group, glyph] of Object.entries(p.categoryGlyph)) {
      const r = contrast(glyph, p.categoryContainer[group]);
      assert.ok(
        r >= GLYPH_MIN_CONTRAST,
        `${group}: ${glyph} on ${p.categoryContainer[group]} = ${r.toFixed(2)}`,
      );
    }
  });

  test(`${mode}: categorical palette has 8 distinct slots`, () => {
    assert.equal(p.dataviz.categorical.length, 8);
    assert.equal(new Set(p.dataviz.categorical).size, 8);
  });
}

test('glyph tone shifts are minimal: unchanged when the slot color already passes', () => {
  const light = palette('light');
  // slot1 (food) is #2A78D6 and already ≥ 3:1 on its container, so it must stay untouched.
  assert.equal(light.categoryGlyph.food, '#2A78D6');
});

test('dark is designed, not inverted (DESIGN §2.1)', () => {
  assert.equal(palette('dark').neutrals.surface, '#121417');
  assert.equal(palette('dark').neutrals.surfaceRaised, '#1A1D21');
  assert.equal(palette('amoled').neutrals.page, '#000000');
});

test('brand seed is the teal from the kickoff', () => {
  assert.equal(tokens.brand.seed, '#0B6E69');
});
