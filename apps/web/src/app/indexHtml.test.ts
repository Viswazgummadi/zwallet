// SPDX-License-Identifier: GPL-3.0-only
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cspWith } from '../../csp.ts';
import { THEME_KEY } from '../ui/theme.ts';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

describe('index.html theme-init', () => {
  it('is one inline script that reads the same storage key as theme.ts', () => {
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].filter(
      (m) => !m[0].includes('type="module"'),
    );
    expect(inline).toHaveLength(1);
    expect(inline[0]![1]).toContain(`'${THEME_KEY}'`);
  });
});

describe('CSP', () => {
  it('never allows unsafe-inline or other origins and locks forms, base and objects', () => {
    const csp = cspWith(['abc=']);
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval' 'sha256-abc='");
    for (const d of ["form-action 'none'", "base-uri 'none'", "object-src 'none'"])
      expect(csp).toContain(d);
    expect(csp).not.toMatch(/https?:/);
  });
});
