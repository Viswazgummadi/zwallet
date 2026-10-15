// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { nextThemePref, readThemePref, writeThemePref } from './theme.ts';

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe('theme preference', () => {
  it('round-trips through storage; system clears the key', () => {
    const s = memoryStorage();
    writeThemePref('dark', s);
    expect(readThemePref(s)).toBe('dark');
    writeThemePref('system', s);
    expect(s.getItem('zw.theme')).toBeNull();
    expect(readThemePref(s)).toBe('system');
  });
  it('falls back to system when storage throws or holds junk', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readThemePref(throwing)).toBe('system');
    expect(readThemePref({ getItem: () => 'purple' })).toBe('system');
    expect(readThemePref(null)).toBe('system');
  });
  it('cycles system → light → dark → system', () => {
    expect(nextThemePref('system')).toBe('light');
    expect(nextThemePref('light')).toBe('dark');
    expect(nextThemePref('dark')).toBe('system');
  });
});
