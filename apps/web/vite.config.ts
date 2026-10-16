// SPDX-License-Identifier: GPL-3.0-only
import { createHash } from 'node:crypto';
import { copyFileSync } from 'node:fs';
import path from 'node:path';
import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { cspWith } from './csp.ts';
import { palettes } from './src/ui/generated/tokens.ts';

/** Served from https://<user>.github.io/<repo>/ — forks set ZW_BASE in pages.yml. */
const base = process.env.ZW_BASE ?? '/zwallet/';

/**
 * Injects the CSP <meta> with a SHA-256 hash for every inline script in the final HTML, and
 * preloads the bundled Inter font (the LCP text waits on it; otherwise it is discovered late,
 * from the CSS).
 */
function csp(): Plugin {
  return {
    name: 'zw-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html, ctx) => {
        const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
          (m) => createHash('sha256').update(m[1]!, 'utf8').digest('base64'),
        );
        const tags: HtmlTagDescriptor[] = [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: cspWith(hashes) },
            injectTo: 'head-prepend',
          },
        ];
        const font = Object.keys(ctx.bundle ?? {}).find((f) => f.endsWith('.woff2'));
        if (font) {
          tags.push({
            tag: 'link',
            attrs: {
              rel: 'preload',
              as: 'font',
              type: 'font/woff2',
              crossorigin: '',
              href: `${base}${font}`,
            },
            injectTo: 'head',
          });
        }
        return { html, tags };
      },
    },
  };
}

/** GitHub Pages serves 404.html for unknown paths; a copy of index.html makes deep links work. */
function spaFallback(): Plugin {
  let outDir = 'dist';
  return {
    name: 'zw-spa-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      copyFileSync(path.join(outDir, 'index.html'), path.join(outDir, '404.html'));
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwind(),
    csp(),
    spaFallback(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'zwallet',
        short_name: 'zwallet',
        description: 'Personal finance that never leaves your devices.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        theme_color: palettes.light.primary,
        background_color: palettes.light.page,
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        globPatterns: ['**/*.{html,js,css,woff2,svg,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    target: 'es2022',
    // No source maps in the Pages build: they would ship the whole source (and 1.4 MB) to users.
    sourcemap: false,
  },
  worker: { format: 'es' },
  // `vite preview` is only the e2e server; e2e/origin.spec.ts reaches it as <name>.github.io to
  // exercise the shared-origin warning (ADR 0020). Not part of the deployed site.
  preview: { allowedHosts: ['.github.io'] },
});
