#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// ARCHITECTURE §9: initial JS ≤ 180 KB gzip. "Initial" = every script and modulepreload that
// dist/index.html loads before any route chunk. Run after `vite build`.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const BUDGET = 180 * 1024;
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
const base = process.env.ZW_BASE ?? '/zwallet/';

const refs = [
  ...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g),
  ...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g),
].map((m) => m[1]);

let total = 0;
for (const ref of new Set(refs)) {
  const rel = ref.startsWith(base) ? ref.slice(base.length) : ref.replace(/^\//, '');
  const size = gzipSync(readFileSync(path.join(dist, rel))).length;
  total += size;
  console.log(`${(size / 1024).toFixed(1).padStart(7)} KB  ${rel}`);
}
console.log(`${(total / 1024).toFixed(1).padStart(7)} KB  total initial JS (gzip), budget ${BUDGET / 1024} KB`);
if (total > BUDGET) {
  console.error('Initial JS over budget (ARCHITECTURE §9).');
  process.exit(1);
}
