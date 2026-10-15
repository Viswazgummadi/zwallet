# 0015 — Bundle a subset of Inter (OFL-1.1) on both apps

- Status: accepted
- Date: 2026-10-15

## Context
DESIGN §2.2 specifies Inter, bundled, with tabular figures for amounts. "Nothing online"
(ADR 0012) rules out remote fonts. CLAUDE.md requires an ADR for any dependency over 500 KB or
under a non-GPL license:
- The full `InterVariable.ttf` is about 860 KB.
- Inter is licensed under the **SIL Open Font License 1.1**, not the GPL.

## Decision
- Bundle **one subset of Inter 4.1's variable font** per platform, produced by
  `packages/design-tokens/fonts.ts`. The script uses `subset-font` (BSD-3-Clause) and
  `harfbuzzjs` (MIT), both dev-only. It pins the source file's SHA-256.
  - Characters: Basic Latin, Latin-1 Supplement, dashes, quotes, bullet, ellipsis, ‹ ›,
    thin/narrow spaces, €, **₹**, arrows ↑↓←→↔, **−** (U+2212), ≈, ▲, ▼.
  - `wght` axis cut to 400–600, the weights the type scale uses.
  - `opsz` pinned to 14 (text).
  - Every OpenType layout feature kept. The script fails if `tnum`, `cv11`, `case` or `calt`
    goes missing.
  - Results: Android `res/font/inter_variable.ttf` is 134 KB; web `InterVariable-zw.woff2` is
    42 KB.
- The OFL text ships next to each copy: `res/raw/inter_ofl.txt`, `src/ui/fonts/OFL.txt`, and
  `packages/design-tokens/licenses/Inter-OFL.txt`. It will be listed on the About → open-source
  licenses screen (M7).
- **License compatibility:** the font is a separate work aggregated with the program. The OFL
  allows bundling with any software, including GPL software, as long as the font keeps its own
  license and isn't sold by itself. It does not make zwallet's code OFL, and the GPL doesn't
  extend to the font.
- Inter has no `⇄` (U+21C4), which DESIGN uses as the transfer sign. Android and browsers fall
  back per glyph to the system font, so the sign still renders. If that looks off, a later change
  can draw the sign as the `sync_alt` icon instead.

## Consequences
- Identical typography on both apps, with tabular amounts. About 175 KB in total, well inside the
  APK (≤ 12 MB) and web (≤ 180 KB JS; fonts don't count toward JS) budgets.
- Names with characters outside the subset (e.g. Devanagari) render in the system font. That's
  acceptable; Inter has no Indic scripts anyway.
- Changing the character set or the Inter version means re-running `fonts.ts` and committing the
  outputs.

## Alternatives considered
- **System fonts (Roboto / Segoe / SF).** Different metrics per platform, and no guaranteed
  `tnum` + `cv11`.
- **The full variable font.** About 880 KB; mostly glyphs and axes we never use.
- **Google Fonts CDN.** Violates ADR 0012.
