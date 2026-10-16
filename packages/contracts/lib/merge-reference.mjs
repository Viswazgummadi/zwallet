// SPDX-License-Identifier: GPL-3.0-only
// Reference per-group LWW merge (ADR 0009, ADR 0017). Generates fixtures/merge.json; the Kotlin
// (core:transfer) and TS (apps/web/src/transfer) implementations are tested against it.
//
// mergeRow(spec, local, incoming, ctx) → { row, conflicts, outcome, write }, or throws MergeError
//   spec      { columns, immutable, groups }   (generated Contracts / TABLES)
//   local     existing row or null; incoming   row from the file
//   ctx       { localFrontier, incomingFrontier }: node → max HLC that side has seen (ADR 0017)
//
// Strict inputs: every spec column must be present on both rows (MergeError "missing_column") and
// field_hlc must be a canonical JSON object of well-formed HLC stamps (MergeError
// "malformed_field_hlc"). Columns are checked first (incoming, then local), then field_hlc
// (incoming, then local). A group missing from a valid field_hlc counts as "" (ADR 0017).
//
// Values: per merge group, LWW by stamp, equal stamps broken by the larger value (compareValues).
// Every x-immutable column takes the larger of the two values when they differ (commutative; no
// conflict-log entry). Stamps of groups this spec doesn't know (a newer minor version, or a group
// literally named "constructor") are kept as the max and never touch values.
//
// Outcome (user-facing, from merge-group VALUES only; never created_at/updated_at/hlc/field_hlc):
//   inserted          row absent locally, incoming is live
//   inserted_deleted  row absent locally, incoming is a tombstone (not "new" in the preview)
//   deleted           live locally → deleted
//   restored          deleted locally → live
//   updated           a non-deleted group value or an immutable column changed
//   unchanged         none of the above
// write: whether the merged row differs from local in ANY column (stamps, hlc, created_at,
// updated_at included); the importer persists it even when the outcome is "unchanged".

const META_MIN = 'created_at';
const META_MAX = 'updated_at';

export class MergeError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.code = code;
  }
}

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

const ENTRY = '"[a-z][a-z0-9_]*":"[0-9]{13}-[0-9a-f]{4}-[0-9a-f]{8}"';
const FIELD_HLC = new RegExp(`^\\{(?:${ENTRY}(?:,${ENTRY})*)?\\}$`);

/**
 * field_hlc text → group → stamp (null-prototype object, so no group name can hit Object.prototype).
 * Strict: a string, canonical JSON (no whitespace), every stamp a well-formed HLC. "" is malformed.
 */
export function parseFieldHlc(text) {
  if (typeof text !== 'string' || !FIELD_HLC.test(text)) throw new MergeError('malformed_field_hlc', String(text));
  return Object.assign(Object.create(null), JSON.parse(text));
}
/** field_hlc is stored as JSON with keys sorted (byte-identical on both platforms). */
export function stringifyFieldHlc(map) {
  return JSON.stringify(Object.fromEntries(Object.keys(map).sort().map((k) => [k, map[k]])));
}

function checkColumns(spec, row) {
  for (const c of spec.columns) if (!Object.hasOwn(row, c)) throw new MergeError('missing_column', c);
}

/** node → max HLC appearing in any group stamp of these rows. */
export function frontier(rows) {
  const f = Object.create(null);
  for (const row of rows) {
    if (!Object.hasOwn(row, 'field_hlc')) throw new MergeError('missing_column', 'field_hlc');
    for (const h of Object.values(parseFieldHlc(row.field_hlc))) {
      const n = nodeOf(h);
      f[n] = maxStr(f[n] ?? '', h);
    }
  }
  return f;
}

const seen = (hlc, front) => hlc === '' || hlc <= (front[nodeOf(hlc)] ?? '');

export function mergeRow(spec, local, incoming, ctx = {}) {
  checkColumns(spec, incoming);
  if (local) checkColumns(spec, local);
  const inf = parseFieldHlc(incoming.field_hlc);
  if (!local) {
    return {
      row: { ...incoming },
      conflicts: [],
      outcome: incoming.deleted_at === null ? 'inserted' : 'inserted_deleted',
      write: true,
    };
  }
  const lf = parseFieldHlc(local.field_hlc);
  const localFrontier = ctx.localFrontier ?? frontier([local]);
  const incomingFrontier = ctx.incomingFrontier ?? frontier([incoming]);

  const out = { ...local };
  const merged = Object.create(null);
  const conflicts = [];

  for (const [group, cols] of Object.entries(spec.groups)) {
    const lh = lf[group] ?? '';
    const ih = inf[group] ?? '';
    const cmp = compareCols(incoming, local, cols);
    const incomingWins = ih > lh || (ih === lh && cmp > 0);
    if (incomingWins) for (const c of cols) out[c] = incoming[c];
    const h = maxStr(lh, ih);
    if (h !== '') merged[group] = h;
    // Both copies deleted the row: only the deletion time differs, nothing for the user to choose.
    const bothDeleted = group === 'deleted' && local.deleted_at != null && incoming.deleted_at != null;
    if (cmp !== 0 && !bothDeleted) {
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
  // Immutable columns should be equal on every copy; if they aren't, the larger value wins, so the
  // merge still converges. Not a conflict: there is nothing for the user to choose.
  for (const c of spec.immutable) if (compareValues(incoming[c], local[c]) > 0) out[c] = incoming[c];
  // Stamps for groups this spec doesn't know are kept as max, whatever their name.
  for (const [g, h] of [...Object.entries(lf), ...Object.entries(inf)]) {
    if (!Object.hasOwn(spec.groups, g)) merged[g] = maxStr(merged[g] ?? '', h);
  }

  out.field_hlc = stringifyFieldHlc(merged);
  const stamps = Object.values(merged);
  out.hlc = stamps.length ? stamps.reduce(maxStr) : maxStr(local.hlc, incoming.hlc);
  out[META_MIN] = Math.min(local[META_MIN], incoming[META_MIN]);
  out[META_MAX] = Math.max(local[META_MAX], incoming[META_MAX]);

  const differs = (c) => compareValues(out[c], local[c]) !== 0;
  const userColumns = [
    ...spec.immutable,
    ...Object.entries(spec.groups).filter(([g]) => g !== 'deleted').flatMap(([, cols]) => cols),
  ];
  const wasDeleted = local.deleted_at !== null;
  const isDeleted = out.deleted_at !== null;
  const outcome =
    !wasDeleted && isDeleted ? 'deleted' : wasDeleted && !isDeleted ? 'restored' : userColumns.some(differs) ? 'updated' : 'unchanged';
  return { row: out, conflicts, outcome, write: spec.columns.some(differs) };
}
