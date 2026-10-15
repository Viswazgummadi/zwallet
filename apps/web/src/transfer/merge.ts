// SPDX-License-Identifier: GPL-3.0-only
// Per-merge-group last-writer-wins (ADR 0009) with conflict logging by per-node frontiers (ADR 0017).
// Pure; identical to core:transfer RowMerge (Kotlin) and packages/contracts/lib/merge-reference.mjs.
// Vectors: packages/contracts/fixtures/merge.json.
import type { TableSpec } from '../generated/contracts.ts';

export type Value = string | number | null;
export type Row = Readonly<Record<string, Value>>;
export type Frontier = Readonly<Record<string, string>>;

export interface Conflict {
  readonly group: string;
  readonly losing_side: 'local' | 'incoming';
  readonly losing_values: Readonly<Record<string, Value>>;
  readonly losing_hlc: string;
  readonly winning_hlc: string;
}

export type Outcome = 'inserted' | 'unchanged' | 'updated' | 'deleted';

export interface MergeResult {
  readonly row: Row;
  readonly conflicts: readonly Conflict[];
  readonly outcome: Outcome;
}

/** Total order for tie-breaks: null < integer < string; strings by UTF-16 code unit. */
export function compareValues(a: Value, b: Value): number {
  const rank = (v: Value) => (v === null ? 0 : typeof v === 'number' ? 1 : 2);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (a === b || a === null || b === null) return 0;
  return a < b ? -1 : 1;
}

const FIELD_HLC = /^\{(?:"[a-z][a-z0-9_]*":"[0-9a-f-]*"(?:,"[a-z][a-z0-9_]*":"[0-9a-f-]*")*)?\}$/;

/** field_hlc is JSON with sorted keys and no whitespace: byte-identical on both platforms. */
export function parseFieldHlc(text: string): Record<string, string> {
  if (!FIELD_HLC.test(text)) throw new Error('malformed field_hlc');
  return JSON.parse(text) as Record<string, string>;
}

export function stringifyFieldHlc(map: Readonly<Record<string, string>>): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.keys(map)
        .sort()
        .map((k) => [k, map[k]]),
    ),
  );
}

const nodeOf = (hlc: string): string => hlc.slice(hlc.lastIndexOf('-') + 1);
const maxStr = (a: string, b: string): string => (a > b ? a : b);
const text = (row: Row, col: string): string => row[col] as string;
const int = (row: Row, col: string): number => row[col] as number;

/** node id → highest HLC from that node in any group stamp of these rows. */
export function frontier(rows: Iterable<Row>): Record<string, string> {
  const f: Record<string, string> = {};
  for (const row of rows) {
    for (const h of Object.values(parseFieldHlc(text(row, 'field_hlc')))) {
      const n = nodeOf(h);
      f[n] = maxStr(f[n] ?? '', h);
    }
  }
  return f;
}

const seen = (hlc: string, front: Frontier): boolean =>
  hlc === '' || hlc <= (front[nodeOf(hlc)] ?? '');

export function mergeRow(
  spec: TableSpec,
  local: Row | null,
  incoming: Row,
  ctx: { localFrontier?: Frontier; incomingFrontier?: Frontier } = {},
): MergeResult {
  if (!local) return { row: { ...incoming }, conflicts: [], outcome: 'inserted' };
  const localFrontier = ctx.localFrontier ?? frontier([local]);
  const incomingFrontier = ctx.incomingFrontier ?? frontier([incoming]);
  const lf = parseFieldHlc(text(local, 'field_hlc'));
  const inf = parseFieldHlc(text(incoming, 'field_hlc'));

  const out: Record<string, Value> = { ...local };
  const merged: Record<string, string> = {};
  const conflicts: Conflict[] = [];
  for (const [group, cols] of Object.entries(spec.groups)) {
    const lh = lf[group] ?? '';
    const ih = inf[group] ?? '';
    let cmp = 0;
    for (const c of cols) {
      cmp = compareValues(incoming[c] ?? null, local[c] ?? null);
      if (cmp !== 0) break;
    }
    const incomingWins = ih > lh || (ih === lh && cmp > 0);
    if (incomingWins) for (const c of cols) out[c] = incoming[c] ?? null;
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
          losing_values: Object.fromEntries(cols.map((c) => [c, loser[c] ?? null])),
          losing_hlc: loserH,
          winning_hlc: winnerH,
        });
      }
    }
  }
  // Stamps for groups this schema doesn't know are kept as max (forward compatibility).
  for (const [g, h] of [...Object.entries(lf), ...Object.entries(inf)]) {
    if (!(g in spec.groups)) merged[g] = maxStr(merged[g] ?? '', h);
  }

  out.field_hlc = stringifyFieldHlc(merged);
  const stamps = Object.values(merged);
  out.hlc =
    stamps.length > 0 ? stamps.reduce(maxStr) : maxStr(text(local, 'hlc'), text(incoming, 'hlc'));
  out.created_at = Math.min(int(local, 'created_at'), int(incoming, 'created_at'));
  out.updated_at = Math.max(int(local, 'updated_at'), int(incoming, 'updated_at'));

  const unchanged = spec.columns.every(
    (c) => compareValues(out[c] ?? null, local[c] ?? null) === 0,
  );
  const outcome: Outcome = unchanged
    ? 'unchanged'
    : local.deleted_at === null && out.deleted_at !== null
      ? 'deleted'
      : 'updated';
  return { row: out, conflicts, outcome };
}
