// SPDX-License-Identifier: GPL-3.0-only
// Subsets Inter (OFL-1.1, ADR 0015) for both apps. Not part of the regular build: run it when the
// character set or the Inter version changes, and commit the outputs.
//
//   node fonts.ts <path to InterVariable.ttf from https://github.com/rsms/inter/releases/tag/v4.1>
//
// Outputs:
//   apps/android/core/designsystem/src/main/res/font/inter_variable.ttf
//   apps/web/src/ui/fonts/InterVariable-zw.woff2
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';
import { Blob, Face } from 'harfbuzzjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
/** SHA-256 of InterVariable.ttf in Inter-4.1.zip. */
export const SOURCE_SHA256 = '4989b125924991b90d05b2d16e0e388c48f7d5bb8b30539bbf9c755278d0ccaf';
/** Weights used by the type scale (tokens.json); the wght axis is cut to this range. */
const WEIGHTS = { min: 400, max: 600 };
/** Optical size pinned to text (14); hero amounts stay legible and the file stays small. */
const OPSZ = 14;

const ranges: Array<[number, number]> = [
  [0x20, 0x7e], // Basic Latin
  [0xa0, 0xff], // Latin-1 Supplement (×, ·, £, ¥, NBSP, accents in names)
  [0x2009, 0x200a], // thin/hair space
  [0x2010, 0x2015], // hyphens and dashes
  [0x2018, 0x201e], // quotes
  [0x2020, 0x2022], // dagger, bullet
  [0x2026, 0x2026], // ellipsis
  [0x2039, 0x203a], // ‹ › (period switcher)
  [0x202f, 0x202f], // narrow no-break space
  [0x20ac, 0x20ac], // €
  [0x20b9, 0x20b9], // ₹
  [0x2190, 0x2195], // arrows (deltas)
  [0x2212, 0x2212], // − minus sign (negative amounts)
  [0x2248, 0x2248], // ≈
  [0x25b2, 0x25b2], // ▲
  [0x25bc, 0x25bc], // ▼
];
export const SUBSET_TEXT = ranges
  .flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i)))
  .join('');

async function main() {
  const src = process.argv[2];
  if (!src) throw new Error('usage: node fonts.ts <InterVariable.ttf>');
  const input = readFileSync(src);
  const sha = createHash('sha256').update(input).digest('hex');
  if (SOURCE_SHA256 && sha !== SOURCE_SHA256)
    throw new Error(`unexpected source font sha256 ${sha}`);

  const opts = { variationAxes: { wght: WEIGHTS, opsz: OPSZ } } as const;
  const ttf = await subsetFont(input, SUBSET_TEXT, { ...opts, targetFormat: 'truetype' });
  const woff2 = await subsetFont(input, SUBSET_TEXT, { ...opts, targetFormat: 'woff2' });

  const face = new Face(new Blob(ttf), 0);
  const features = face.getTableFeatureTags('GSUB');
  const axes = face.getAxisInfos();
  const unicodes = face.collectUnicodes();
  for (const f of ['tnum', 'cv11', 'case', 'calt']) {
    if (!features.includes(f)) throw new Error(`subset lost OpenType feature ${f}`);
  }
  // Inter has no U+21C4 (⇄, transfer sign): it falls back per glyph to the system font (ADR 0015).
  for (const cp of [0x20b9, 0x2212, 0x2194]) {
    if (!unicodes.includes(cp)) throw new Error(`subset lacks U+${cp.toString(16)}`);
  }

  const out = [
    ['apps/android/core/designsystem/src/main/res/font/inter_variable.ttf', ttf],
    ['apps/web/src/ui/fonts/InterVariable-zw.woff2', woff2],
  ] as const;
  for (const [rel, data] of out) {
    const file = path.join(ROOT, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, data);
    console.log(`wrote ${rel} (${(data.length / 1024).toFixed(1)} KB)`);
  }
  console.log(`source sha256 ${sha}`);
  console.log(`axes ${JSON.stringify(axes)}`);
  console.log(`GSUB features ${features.join(' ')}`);
  console.log(`${unicodes.length} code points`);
}

await main();
