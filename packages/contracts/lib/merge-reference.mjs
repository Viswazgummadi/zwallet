// SPDX-License-Identifier: GPL-3.0-only
// Reference per-group LWW merge (ADR 0009, ADR 0017). Generates fixtures/merge.json; the Kotlin
// (core:transfer) and TS (apps/web/src/transfer) implementations are tested against it.
//
// mergeRow(spec, local, incoming, ctx) → { row, conflicts, outcome }
//   spec      { columns, immutable, groups }   (generated Contracts / TABLES)
//   local     existing row or null; incoming   row from the file
//   ctx       { localFrontier, incomingFrontier }: node → max HLC that side has seen (ADR 0017)

const META_MIN = 'created_at';
const META_MAX = 'updated_at';

export const nodeOf = (hlc) => hlc.slice(hlc.lastIndexOf('-') + 1);
const maxStr = (a, b) => (a > b ? a : b);

/** Total order on column values: null < integer < string; integers numerically; strings by UTF-16 code units. */
export function compareValues(a, b) {
  const rank = (v) => (v === null ? 0 : typeof v === 'number' ? 1 : 2);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (a === null || a === b) return 0;
  return a < b ? -1 : 1;
}
const compareCols = (x, y, cols) => {
  for (const c of cols) {
    const d = compareValues(x[c], y[c]);
    if (d !== 0) return d;
  }
  return 0;
};

/** field_hlc is stored as JSON with keys sorted (byte-identical on both platforms). */
export const parseFieldHlc = (s) => (s ? JSON.parse(s) : {});
export function stringifyFieldHlc(map) {
  return JSON.stringify(Object.fromEntries(Object.keys(map).sort().map((k) => [k, map[k]])));
}

/** node → max HLC appearing in any group stamp of these rows. */
export function frontier(rows) {
  const f = {};
  for (const row of rows) {
    for (const h of Object.values(parseFieldHlc(row.field_hlc))) {
      const n = nodeOf(h);
      f[n] = maxStr(f[n] ?? '', h);
    }
  }
  return f;
}

const seen = (hlc, front) => hlc === '' || hlc <= (front[nodeOf(hlc)] ?? '');

export function mergeRow(spec, local, incoming, ctx = {}) {
  if (!local) return { row: { ...incoming }, conflicts: [], outcome: 'inserted' };
  const localFrontier = ctx.localFrontier ?? frontier([local]);
  const incomingFrontier = ctx.incomingFrontier ?? frontier([incoming]);

  const lf = parseFieldHlc(local.field_hlc);
  const inf = parseFieldHlc(incoming.field_hlc);
  const out = { ...local };
  const merged = {};
  const conflicts = [];

  for (const [group, cols] of Object.entries(spec.groups)) {
    const lh = lf[group] ?? '';
    const ih = inf[group] ?? '';
    const cmp = compareCols(incoming, local, cols);
    const incomingWins = ih > lh || (ih === lh && cmp > 0);
    if (incomingWins) for (const c of cols) out[c] = incoming[c];
    const h = maxStr(lh, ih);
    if (h !== '') merged[group] = h;
    if (cmp !== 0) {
      const [loser, loserH, winnerH, winnerFrontier] = incomingWins
        ? [local, lh, ih, incomingFrontier]
        : [incoming, ih, lh, localFrontier];
      if (!seen(loserH, winnerFrontier)) {
        conflicts.push({
          group,
          losing_side: incomingWins ? 'local' : 'incoming',
          losing_values: Object.fromEntries(cols.map((c) => [c, loser[c]])),
          losing_hlc: loserH,
          winning_hlc: winnerH,
        });
      }
    }
  }
  // Stamps for groups this spec doesn't know (never from a valid file today) are kept as max.
  for (const [g, h] of [...Object.entries(lf), ...Object.entries(inf)]) {
    if (!(g in spec.groups)) merged[g] = maxStr(merged[g] ?? '', h);
  }

  out.field_hlc = stringifyFieldHlc(merged);
  const stamps = Object.values(merged);
  out.hlc = stamps.length ? stamps.reduce(maxStr) : maxStr(local.hlc, incoming.hlc);
  out[META_MIN] = Math.min(local[META_MIN], incoming[META_MIN]);
  out[META_MAX] = Math.max(local[META_MAX], incoming[META_MAX]);

  const unchanged = spec.columns.every((c) => compareValues(out[c], local[c]) === 0);
  const outcome = unchanged
    ? 'unchanged'
    : local.deleted_at === null && out.deleted_at !== null
      ? 'deleted'
      : 'updated';
  return { row: out, conflicts, outcome };
}
