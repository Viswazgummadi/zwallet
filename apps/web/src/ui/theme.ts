// SPDX-License-Identifier: GPL-3.0-only
// Appearance (SPEC §13): system / light / dark. A per-browser convenience kept in localStorage —
// which may be unavailable (private mode), so every access is guarded. public/theme-init.js
// applies the same key before first paint.

export type ThemePref = 'system' | 'light' | 'dark';
export const THEME_KEY = 'zw.theme';
export const THEME_ORDER: readonly ThemePref[] = ['system', 'light', 'dark'];

export function readThemePref(storage: Pick<Storage, 'getItem'> | null = safeStorage()): ThemePref {
  try {
    const v = storage?.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function writeThemePref(
  pref: ThemePref,
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null = safeStorage(),
) {
  try {
    if (pref === 'system') storage?.removeItem(THEME_KEY);
    else storage?.setItem(THEME_KEY, pref);
  } catch {
    /* the choice just won't persist */
  }
}

export function applyThemePref(pref: ThemePref, root: HTMLElement = document.documentElement) {
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
}

export function nextThemePref(pref: ThemePref): ThemePref {
  return THEME_ORDER[(THEME_ORDER.indexOf(pref) + 1) % THEME_ORDER.length]!;
}

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
