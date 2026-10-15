// SPDX-License-Identifier: GPL-3.0-only
import { copyFileSync } from 'node:fs';
import path from 'node:path';
import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { CSP } from './csp.ts';
import { palettes } from './src/ui/generated/tokens.ts';

/** Served from https://<user>.github.io/<repo>/ — forks set ZW_BASE in pages.yml. */
const base = process.env.ZW_BASE ?? '/zwallet/';

function csp(): Plugin {
  return {
    name: 'zw-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler: () => [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend',
        },
      ],
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
    sourcemap: true,
  },
  worker: { format: 'es' },
});
