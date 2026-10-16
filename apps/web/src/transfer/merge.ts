// SPDX-License-Identifier: GPL-3.0-only
// Per-merge-group last-writer-wins (ADR 0009) with conflict logging by per-node frontiers (ADR 0017).
// Pure; identical to core:transfer RowMerge (Kotlin) and packages/contracts/lib/merge-reference.mjs,
// which documents the rules (strict inputs, immutable reconciliation, outcomes, `write`).
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

/**
 * User-facing bucket for one row, from merge-group VALUES only (never created_at/updated_at/hlc/
 * field_hlc). `inserted_deleted` = a tombstone for a row we never had (not "new" in the preview).
 */
export type Outcome =
  'inserted' | 'inserted_deleted' | 'updated' | 'deleted' | 'restored' | 'unchanged';

export interface MergeResult {
  readonly row: Row;
  readonly conflicts: readonly Conflict[];
  readonly outcome: Outcome;
  /** The merged row differs from local in any column (stamps, hlc, created_at ...): persist it. */
  readonly write: boolean;
}

export type MergeErrorCode = 'malformed_field_hlc' | 'missing_column';

/** An input the merge refuses: the importer rejects the whole file before touching the DB. */
export class MergeError extends Error {
  constructor(
    readonly code: MergeErrorCode,
    detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = 'MergeError';
  }
}

/** Total order for tie-breaks: null < integer < string; strings by UTF-16 code unit. */
export function compareValues(a: Value, b: Value): number {
  const rank = (v: Value) => (v === null ? 0 : typeof v === 'number' ? 1 : 2);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (a === b || a === null || b === null) return 0;
  return a < b ? -1 : 1;
}

const ENTRY = '"[a-z][a-z0-9_]*":"[0-9]{13}-[0-9a-f]{4}-[0-9a-f]{8}"';
const FIELD_HLC = new RegExp(`^\\{(?:${ENTRY}(?:,${ENTRY})*)?\\}$`);

/** group → stamp. Null-prototype, so no group name ("constructor") can hit Object.prototype. */
export type Stamps = Record<string, string>;

/** Strict: a string of canonical JSON whose stamps are all well-formed HLCs. "" is malformed. */
export function parseFieldHlc(value: Value | undefined): Stamps {
  if (typeof value !== 'string' || !FIELD_HLC.test(value))
    throw new MergeError('malformed_field_hlc', String(value));
  return Object.assign(Object.create(null) as Stamps, JSON.parse(value) as Record<string, string>);
}

/** field_hlc is JSON with sorted keys and no whitespace: byte-identical on both platforms. */
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
const get = (row: Row, col: string): Value => row[col] as Value;

function checkColumns(spec: TableSpec, row: Row): void {
  for (const c of spec.columns)
    if (!Object.hasOwn(row, c)) throw new MergeError('missing_column', c);
}

/** node id → highest HLC from that node in any group stamp of these rows. */
export function frontier(rows: Iterable<Row>): Record<string, string> {
  const f: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const row of rows) {
    if (!Object.hasOwn(row, 'field_hlc')) throw new MergeError('missing_column', 'field_hlc');
    for (const h of Object.values(parseFieldHlc(row.field_hlc))) {
      const n = nodeOf(h);
      f[n] = maxStr(f[n] ?? '', h);
    }
  }
  return f;
}

const seen = (hlc: string, front: Frontier): boolean =>
  hlc === '' || hlc <= (Object.hasOwn(front, nodeOf(hlc)) ? front[nodeOf(hlc)]! : '');

export function mergeRow(
  spec: TableSpec,
  local: Row | null,
  incoming: Row,
  ctx: { localFrontier?: Frontier; incomingFrontier?: Frontier } = {},
): MergeResult {
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

  const out: Record<string, Value> = { ...local };
  const merged: Stamps = Object.create(null) as Stamps;
  const conflicts: Conflict[] = [];
  for (const [group, cols] of Object.entries(spec.groups)) {
    const lh = lf[group] ?? '';
    const ih = inf[group] ?? '';
    let cmp = 0;
    for (const c of cols) {
      cmp = compareValues(get(incoming, c), get(local, c));
      if (cmp !== 0) break;
    }
    const incomingWins = ih > lh || (ih === lh && cmp > 0);
    if (incomingWins) for (const c of cols) out[c] = get(incoming, c);
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
          losing_values: Object.fromEntries(cols.map((c) => [c, get(loser, c)])),
          losing_hlc: loserH,
          winning_hlc: winnerH,
        });
      }
    }
  }
  // Immutable columns should be equal on every copy; if they are not, the larger value wins, so
  // the merge still converges. Not a conflict: there is nothing for the user to choose.
  for (const c of spec.immutable)
    if (compareValues(get(incoming, c), get(local, c)) > 0) out[c] = get(incoming, c);
  // Stamps for groups this schema doesn't know are kept as max, whatever their name.
  for (const [g, h] of [...Object.entries(lf), ...Object.entries(inf)]) {
    if (!Object.hasOwn(spec.groups, g)) merged[g] = maxStr(merged[g] ?? '', h);
  }

  out.field_hlc = stringifyFieldHlc(merged);
  const stamps = Object.values(merged);
  out.hlc =
    stamps.length > 0 ? stamps.reduce(maxStr) : maxStr(text(local, 'hlc'), text(incoming, 'hlc'));
  out.created_at = Math.min(int(local, 'created_at'), int(incoming, 'created_at'));
  out.updated_at = Math.max(int(local, 'updated_at'), int(incoming, 'updated_at'));

  const differs = (c: string): boolean => compareValues(get(out, c), get(local, c)) !== 0;
  const userColumns = [
    ...spec.immutable,
    ...Object.entries(spec.groups)
      .filter(([g]) => g !== 'deleted')
      .flatMap(([, cols]) => cols),
  ];
  const wasDeleted = local.deleted_at !== null;
  const isDeleted = out.deleted_at !== null;
  const outcome: Outcome =
    !wasDeleted && isDeleted
      ? 'deleted'
      : wasDeleted && !isDeleted
        ? 'restored'
        : userColumns.some(differs)
          ? 'updated'
          : 'unchanged';
  return { row: out, conflicts, outcome, write: spec.columns.some(differs) };
}
