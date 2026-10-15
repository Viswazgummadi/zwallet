// SPDX-License-Identifier: GPL-3.0-only
/**
 * ARCHITECTURE §8.2: GitHub Pages can't set headers, so the CSP ships as a <meta>. Nothing but the
 * app's own origin may be contacted. Injected only into production builds (the dev server needs
 * inline styles for HMR); e2e runs against the production build.
 */
export const CSP =
  "default-src 'self'; connect-src 'self'; script-src 'self' 'wasm-unsafe-eval'; " +
  "img-src 'self' data: blob:; style-src 'self'; object-src 'none'; base-uri 'none'";
