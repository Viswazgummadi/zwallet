// SPDX-License-Identifier: GPL-3.0-only
// Resolves tokens.json into concrete per-mode palettes. Pure; shared by build.ts and the tests.
import { readFileSync } from 'node:fs';
import {
  Hct,
  MaterialDynamicColors,
  SchemeTonalSpot,
  argbFromHex,
  hexFromArgb,
} from '@material/material-color-utilities';

export type Mode = 'light' | 'dark' | 'amoled';
export type Hex = string; // '#RRGGBB' or '#RRGGBBAA'

export const tokens = JSON.parse(readFileSync(new URL('./tokens.json', import.meta.url), 'utf8'));

// ── color math ──────────────────────────────────────────────────────────────────────────────
type Rgb = [number, number, number];
export function parseColor(c: string): { rgb: Rgb; alpha: number } {
  const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(c);
  if (rgba) return { rgb: [+rgba[1], +rgba[2], +rgba[3]], alpha: +rgba[4] };
  const h = c.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Unsupported color ${c}`);
  return { rgb: [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb, alpha: 1 };
}
const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
export function toHex(rgb: Rgb, alpha = 1): Hex {
  return `#${rgb.map(hex2).join('')}${alpha < 1 ? hex2(alpha * 255) : ''}`;
}
/** Normalizes any token color to '#RRGGBB' / '#RRGGBBAA' (upper-case). */
export const normalize = (c: string): Hex => {
  const { rgb, alpha } = parseColor(c);
  return toHex(rgb, alpha);
};
const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: Rgb) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
/** WCAG 2.x contrast ratio between two opaque colors. */
export function contrast(a: string, b: string): number {
  const la = luminance(parseColor(a).rgb);
  const lb = luminance(parseColor(b).rgb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** Source-over composite of fg (with alpha) on an opaque bg. */
export function over(fg: string, alpha: number, bg: string): Hex {
  const f = parseColor(fg).rgb;
  const b = parseColor(bg).rgb;
  return toHex(f.map((v, i) => v * alpha + b[i] * (1 - alpha)) as Rgb);
}

// ── palettes ────────────────────────────────────────────────────────────────────────────────
const NEUTRAL_KEYS = Object.keys(tokens.color.light) as string[];
const M3_EXTRA = [
  'secondary',
  'onSecondary',
  'secondaryContainer',
  'onSecondaryContainer',
  'tertiary',
  'onTertiary',
  'tertiaryContainer',
  'onTertiaryContainer',
  'error',
  'onError',
  'errorContainer',
  'onErrorContainer',
  'outline',
  'outlineVariant',
  'inverseSurface',
  'inverseOnSurface',
  'inversePrimary',
] as const;

export const CONTAINER_ALPHA = 0.16;
export const GLYPH_MIN_CONTRAST = 3;

function slotColor(slot: string, mode: 'light' | 'dark'): Hex {
  if (slot === 'other') return normalize(tokens.dataviz.other[mode]);
  const i = Number(slot.replace('slot', '')) - 1;
  return normalize(tokens.dataviz.categorical[mode][i]);
}

/**
 * Category glyph: the slot color, with its HCT tone moved away from the container (darker in
 * light mode, lighter in dark) in 0.5 steps until glyph-vs-container contrast ≥ 3:1. Hue and
 * chroma are kept, so identity is preserved (DESIGN §2.4).
 */
function glyphFor(slot: Hex, container: Hex, mode: 'light' | 'dark'): Hex {
  const hct = Hct.fromInt(argbFromHex(slot));
  const step = mode === 'light' ? -0.5 : 0.5;
  let c = slot;
  for (let i = 0; i < 200 && contrast(c, container) < GLYPH_MIN_CONTRAST; i++) {
    hct.tone = Math.min(100, Math.max(0, hct.tone + step));
    c = normalize(hexFromArgb(hct.toInt()));
  }
  return c;
}

export interface Palette {
  mode: Mode;
  neutrals: Record<string, Hex>;
  m3: Record<(typeof M3_EXTRA)[number], Hex>;
  dataviz: {
    categorical: Hex[];
    other: Hex;
    single: Hex;
    ghost: Hex;
    band: Hex;
    sequentialZero: Hex;
    divergingNeutral: Hex;
  };
  categoryContainer: Record<string, Hex>;
  categoryGlyph: Record<string, Hex>;
}

export function palette(mode: Mode): Palette {
  const base: 'light' | 'dark' = mode === 'light' ? 'light' : 'dark';
  const neutrals: Record<string, Hex> = {};
  for (const k of NEUTRAL_KEYS) neutrals[k] = normalize(tokens.color[base][k]);
  if (mode === 'amoled')
    for (const [k, v] of Object.entries(tokens.color.amoled)) neutrals[k] = normalize(v as string);

  const scheme = new SchemeTonalSpot(
    Hct.fromInt(argbFromHex(tokens.brand.seed)),
    base === 'dark',
    0,
  );
  const m3 = Object.fromEntries(
    M3_EXTRA.map((k) => [k, normalize(hexFromArgb(MaterialDynamicColors[k].getArgb(scheme)))]),
  ) as Palette['m3'];

  const containers: Record<string, Hex> = {};
  const glyphs: Record<string, Hex> = {};
  for (const [group, slot] of Object.entries(
    tokens.categoryIdentity.containers as Record<string, string>,
  )) {
    const color = slotColor(slot, base);
    containers[group] = over(color, CONTAINER_ALPHA, neutrals.surface);
    glyphs[group] = glyphFor(color, containers[group], base);
  }

  const dv = tokens.dataviz;
  return {
    mode,
    neutrals,
    m3,
    dataviz: {
      categorical: dv.categorical[base].map(normalize),
      other: normalize(dv.other[base]),
      single: normalize(dv.single[base]),
      ghost: normalize(dv.ghost[base]),
      band: normalize(dv.band[base]),
      sequentialZero: normalize(dv.sequential.zero[base]),
      divergingNeutral: normalize(dv.diverging.neutral[base]),
    },
    categoryContainer: containers,
    categoryGlyph: glyphs,
  };
}

export const MODES: Mode[] = ['light', 'dark', 'amoled'];
export const shared = {
  sequential: Object.fromEntries(
    Object.entries(tokens.dataviz.sequential.steps as Record<string, string>).map(([k, v]) => [
      k,
      normalize(v),
    ]),
  ) as Record<string, Hex>,
  divergingNegative: normalize(tokens.dataviz.diverging.negative),
  divergingPositive: normalize(tokens.dataviz.diverging.positive),
  status: Object.fromEntries(
    ['good', 'warning', 'serious', 'critical'].map((k) => [k, normalize(tokens.status[k])]),
  ) as Record<'good' | 'warning' | 'serious' | 'critical', Hex>,
  areaWashOpacity: tokens.dataviz.areaWashOpacity as number,
};
