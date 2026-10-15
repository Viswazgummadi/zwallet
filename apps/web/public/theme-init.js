// SPDX-License-Identifier: GPL-3.0-only
// Runs before first paint: applies the saved theme so there is no light→dark flash.
// Kept in sync with src/ui/theme.ts (THEME_KEY). Storage may be unavailable (private mode).
(function () {
  try {
    var pref = window.localStorage.getItem('zw.theme');
    if (pref === 'light' || pref === 'dark')
      document.documentElement.setAttribute('data-theme', pref);
  } catch (e) {
    /* ignore: follow the system theme */
  }
})();
