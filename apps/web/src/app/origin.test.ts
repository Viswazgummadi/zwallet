// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { isSharedOrigin, sharedOriginWarning } from './origin.ts';

describe('isSharedOrigin (ADR 0020)', () => {
  it('flags a project site on github.io', () => {
    expect(isSharedOrigin({ hostname: 'viswaz.github.io' }, '/zwallet/')).toBe(true);
  });
  it('is case-insensitive', () => {
    expect(isSharedOrigin({ hostname: 'Viswaz.GitHub.io' }, '/zwallet/')).toBe(true);
  });
  it('accepts a dedicated origin: github.io with a root base (custom or user site)', () => {
    expect(isSharedOrigin({ hostname: 'viswaz.github.io' }, '/')).toBe(false);
  });
  it('accepts custom domains and localhost under any base', () => {
    expect(isSharedOrigin({ hostname: 'zwallet.example.org' }, '/zwallet/')).toBe(false);
    expect(isSharedOrigin({ hostname: 'localhost' }, '/zwallet/')).toBe(false);
  });
  it('does not match look-alike hosts', () => {
    expect(isSharedOrigin({ hostname: 'evilgithub.io' }, '/zwallet/')).toBe(false);
    expect(isSharedOrigin({ hostname: 'github.io.example.com' }, '/zwallet/')).toBe(false);
  });
  it('words the warning with the host', () => {
    expect(sharedOriginWarning('viswaz.github.io')).toBe(
      'This copy runs on a shared web address. Other sites on viswaz.github.io could read data you save here. Use zwallet from its own address.',
    );
  });
});
