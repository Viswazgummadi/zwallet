// SPDX-License-Identifier: GPL-3.0-only
// Reference parser + SQL builder for the search grammar (SPEC §4.4, AC-4.4.x). Both apps implement
// the same behaviour and are tested on fixtures/search.json (generated from this file by
// scripts/search-vectors.mjs). Grammar and semantics: packages/contracts/README.md "Search grammar".
//
//   parse(input, ctx)      -> { tokens }               pure, no I/O
//   toSql(tokens, ctx)     -> { where, params }        WHERE fragment over `transactions t`
//   search(input, ctx)     -> { tokens, where, params }
//
// ctx = { today: 'YYYY-MM-DD' (in the display timezone), tzOffsetMinutes: int, minorScale: int }.
// tzOffsetMinutes is only used by dayStart(); apps with DST zones compute day starts with their tz
// database (start of the local calendar day, never "previous start + 86400000").

const NAME_KEYS = new Set(['cat', 'group', 'merchant', 'acct', 'tag', 'person']);
const ENUM_KEYS = {
  type: ['expense', 'income', 'transfer', 'refund'],
  source: ['manual', 'sms', 'paste', 'csv_import', 'recurring_auto'],
  method: ['upi', 'card', 'netbanking', 'cash', 'atm', 'wallet', 'auto_debit', 'other'],
  is: ['review', 'split', 'recurring'],
  has: ['note'],
};
const ALIASES = { source: { csv: 'csv_import', recurring: 'recurring_auto' } };
const SINGLE_KEYS = new Set(['from', 'to', 'amt']);
const DATE_KEYS = new Set(['on', 'from', 'to', 'month']);
const KEYS = new Set([...NAME_KEYS, ...Object.keys(ENUM_KEYS), ...DATE_KEYS, 'amt']);

// Unicode White_Space (same set as the SMS/uuid normalisers).
const WS = new Set([0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0x85, 0xa0, 0x1680, ...range(0x2000, 0x200a), 0x2028, 0x2029, 0x202f, 0x205f, 0x3000]);
function range(a, b) {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}
const isWs = (ch) => WS.has(ch.codePointAt(0));
/** ASCII-only lower-casing, to match SQLite's lower() exactly. */
export const asciiLower = (s) => s.replace(/[A-Z]/g, (c) => c.toLowerCase());
const hasText = (s) => /[\p{L}\p{N}]/u.test(s);

/** Splits input into lexemes: {raw, phrase} for "phrases" or {raw, word} for bare tokens. */
function lex(input) {
  const chars = [...input];
  const out = [];
  let i = 0;
  while (i < chars.length) {
    if (isWs(chars[i])) {
      i++;
      continue;
    }
    if (chars[i] === '"') {
      let j = i + 1;
      while (j < chars.length && chars[j] !== '"') j++;
      out.push({ raw: chars.slice(i, Math.min(j + 1, chars.length)).join(''), phrase: chars.slice(i + 1, j).join('') });
      i = j + 1;
      continue;
    }
    // Bare token: ends at whitespace, except inside a quoted segment. A quote opens a segment only
    // right after ':' or ',' (key:"a b", key:x,"a b"); elsewhere it is a literal character.
    let j = i;
    let inQuote = false;
    while (j < chars.length && (inQuote || !isWs(chars[j]))) {
      if (chars[j] === '"') {
        if (inQuote) inQuote = false;
        else if (j > i && (chars[j - 1] === ':' || chars[j - 1] === ',')) inQuote = true;
      }
      j++;
    }
    out.push({ raw: chars.slice(i, j).join(''), word: chars.slice(i, j).join('') });
    i = j;
  }
  return out;
}

/** Splits on commas outside quotes and removes the quotes (no escapes; a quote opens only at the start or after a comma). */
function splitValues(rest, single) {
  const out = [''];
  let inQuote = false;
  let prev = ',';
  for (const ch of rest) {
    if (ch === '"' && (inQuote || prev === ',')) inQuote = !inQuote;
    else if (ch === ',' && !inQuote && !single) out.push('');
    else out[out.length - 1] += ch;
    prev = ch;
  }
  return out;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const validDate = (s) => {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
};
const addDays = (s, n) => new Date(Date.parse(`${s}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const addMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};
/** Epoch ms of local midnight of 'YYYY-MM-DD' for a fixed UTC offset. */
export const dayStart = (date, ctx) => Date.parse(`${date}T00:00:00Z`) - ctx.tzOffsetMinutes * 60000;

function toMinor(text, scale) {
  const m = /^(\d{1,15})(?:\.(\d+))?$/.exec(text);
  if (!m || (m[2] ?? '').length > scale) return null;
  return Number(m[1]) * 10 ** scale + Number((m[2] ?? '').padEnd(scale, '0') || 0);
}

function parseAmount(value, ctx, prefixed) {
  const D = '(\\d+(?:\\.\\d+)?)';
  let m = new RegExp(`^(>=|<=|>|<)${D}$`).exec(value);
  if (m) {
    const a = toMinor(m[2], ctx.minorScale);
    return a === null ? { reason: 'bad_amount' } : { op: { '>': 'gt', '>=': 'gte', '<': 'lt', '<=': 'lte' }[m[1]], a_minor: a, b_minor: null };
  }
  m = new RegExp(`^${D}\\.\\.${D}$`).exec(value);
  if (m) {
    const a = toMinor(m[1], ctx.minorScale);
    const b = toMinor(m[2], ctx.minorScale);
    if (a === null || b === null) return { reason: 'bad_amount' };
    return a <= b ? { op: 'between', a_minor: a, b_minor: b } : { reason: 'bad_range' };
  }
  if (prefixed) {
    m = new RegExp(`^${D}$`).exec(value);
    if (m) {
      const a = toMinor(m[1], ctx.minorScale);
      return a === null ? { reason: 'bad_amount' } : { op: 'eq', a_minor: a, b_minor: null };
    }
  }
  return { reason: 'bad_amount' };
}

function parseDateValue(key, v, ctx) {
  if (key === 'month') return /^\d{4}-\d{2}$/.test(v) && validDate(`${v}-01`) ? v : null;
  if (v === 'today') return ctx.today;
  if (v === 'yesterday') return addDays(ctx.today, -1);
  return validDate(v) ? v : null;
}

export function parse(input, ctx) {
  const tokens = [];
  const invalid = (raw, reason) => tokens.push({ kind: 'invalid', raw, reason });
  for (const lx of lex(input)) {
    if (lx.phrase !== undefined) {
      if (!hasText(lx.phrase)) invalid(lx.raw, 'no_text');
      else tokens.push({ kind: 'phrase', raw: lx.raw, value: lx.phrase });
      continue;
    }
    const word = lx.word;
    const colon = word.indexOf(':');
    const key = colon > 0 ? asciiLower(word.slice(0, colon)) : '';
    if (KEYS.has(key)) {
      const rest = word.slice(colon + 1);
      if (rest === '') {
        invalid(lx.raw, 'empty_value');
        continue;
      }
      if (key === 'amt') {
        const a = parseAmount(rest, ctx, true);
        a.reason ? invalid(lx.raw, a.reason) : tokens.push({ kind: 'amt', raw: lx.raw, ...a });
        continue;
      }
      const values = splitValues(rest, SINGLE_KEYS.has(key)).map((v) => asciiLower(v.trim()));
      if (values.some((v) => v === '')) {
        invalid(lx.raw, 'empty_value');
        continue;
      }
      if (SINGLE_KEYS.has(key) && splitValues(rest, false).length > 1) {
        invalid(lx.raw, 'single_value_only');
        continue;
      }
      if (NAME_KEYS.has(key)) tokens.push({ kind: key, raw: lx.raw, values: [...new Set(values)] });
      else if (key in ENUM_KEYS) {
        const mapped = values.map((v) => ALIASES[key]?.[v] ?? v);
        const bad = mapped.find((v) => !ENUM_KEYS[key].includes(v));
        bad === undefined ? tokens.push({ kind: key, raw: lx.raw, values: [...new Set(mapped)] }) : invalid(lx.raw, 'unknown_value');
      } else {
        const dates = values.map((v) => parseDateValue(key, v, ctx));
        dates.includes(null) ? invalid(lx.raw, 'bad_date') : tokens.push({ kind: key, raw: lx.raw, values: [...new Set(dates)] });
      }
      continue;
    }
    if (/^[<>]/.test(word) || /^\d+(\.\d+)?\.\.\d+(\.\d+)?$/.test(word)) {
      const a = parseAmount(word, ctx, false);
      a.reason ? invalid(lx.raw, a.reason) : tokens.push({ kind: 'amt', raw: lx.raw, ...a });
      continue;
    }
    if (!hasText(word)) invalid(lx.raw, 'no_text');
    else tokens.push({ kind: 'word', raw: lx.raw, value: word });
  }
  return { tokens };
}

const nameMatch = (col, extra = '') => `(${[`lower(${col}) = ?`, `lower(replace(${col}, ' ', '-')) = ?`, ...(extra ? [extra] : [])].join(' OR ')})`;
const ftsPhrase = (s, prefix) => `"${s.replaceAll('"', '""')}"${prefix ? '*' : ''}`;
const FTS = 'transactions_fts MATCH ?';
const ftsIn = `t.id IN (SELECT transaction_id FROM transactions_fts WHERE ${FTS})`;

export function toSql({ tokens }, ctx) {
  const parts = ['t.deleted_at IS NULL'];
  const params = [];
  const add = (sql, ...ps) => {
    parts.push(sql);
    params.push(...ps);
  };
  const text = tokens.filter((x) => (x.kind === 'word' || x.kind === 'phrase') && !(x.kind === 'word' && /^\d+(\.\d+)?$/.test(x.value) && toMinor(x.value, ctx.minorScale) !== null));
  let textDone = false;
  for (const tok of tokens) {
    switch (tok.kind) {
      case 'cat':
      case 'tag': {
        const table = tok.kind === 'cat' ? 'categories' : 'tags';
        const inner = (v) => ({ sql: nameMatch('name', 'lower(system_key) = ?'), ps: [v, v, v] });
        // params must follow the order of the SQL text, so build the sub-select inline.
        const sqls = [];
        const ps = [];
        for (const v of tok.values) {
          const m = inner(v);
          sqls.push(m.sql);
          ps.push(...m.ps);
        }
        const where = sqls.join(' OR ');
        if (tok.kind === 'cat') add(`t.category_id IN (SELECT id FROM ${table} WHERE ${where})`, ...ps);
        else add(`t.id IN (SELECT tt.transaction_id FROM transaction_tags tt WHERE tt.deleted_at IS NULL AND tt.tag_id IN (SELECT id FROM ${table} WHERE ${where}))`, ...ps);
        break;
      }
      case 'group':
      case 'merchant':
      case 'acct':
      case 'person': {
        const sqls = [];
        const ps = [];
        for (const v of tok.values) {
          if (tok.kind === 'acct') {
            sqls.push(`(lower(name) = ? OR lower(replace(name, ' ', '-')) = ? OR lower(replace(name, ' ', '-') || '-' || coalesce(last4, '')) = ? OR last4 = ?)`);
            ps.push(v, v, v, v);
          } else {
            const col = tok.kind === 'person' ? 'display_name' : 'name';
            sqls.push(nameMatch(col));
            ps.push(v, v);
          }
        }
        const where = sqls.join(' OR ');
        if (tok.kind === 'group') add(`t.category_id IN (SELECT id FROM categories WHERE parent_id IN (SELECT id FROM categories WHERE ${where}))`, ...ps);
        else if (tok.kind === 'merchant') add(`t.merchant_id IN (SELECT id FROM merchants WHERE ${where})`, ...ps);
        else if (tok.kind === 'acct') add(`t.account_id IN (SELECT id FROM accounts WHERE ${where})`, ...ps);
        else add(`t.id IN (SELECT le.transaction_id FROM ledger_entries le WHERE le.deleted_at IS NULL AND le.transaction_id IS NOT NULL AND le.person_id IN (SELECT id FROM people WHERE ${where}))`, ...ps);
        break;
      }
      case 'type':
      case 'source':
      case 'method': {
        const col = { type: 't.type', source: 't.source', method: 't.payment_method' }[tok.kind];
        add(`${col} IN (${tok.values.map(() => '?').join(', ')})`, ...tok.values);
        break;
      }
      case 'is':
      case 'has': {
        const sql = { review: "t.review_state = 'needs_review'", split: 't.split_group_id IS NOT NULL', recurring: 't.recurring_series_id IS NOT NULL', note: "(t.note IS NOT NULL AND t.note <> '')" };
        const sqls = tok.values.map((v) => sql[v]);
        add(sqls.length > 1 ? `(${sqls.join(' OR ')})` : sqls[0]);
        break;
      }
      case 'amt': {
        if (tok.op === 'between') add('t.amount_minor BETWEEN ? AND ?', tok.a_minor, tok.b_minor);
        else add(`t.amount_minor ${{ gt: '>', gte: '>=', lt: '<', lte: '<=', eq: '=' }[tok.op]} ?`, tok.a_minor);
        break;
      }
      case 'on':
      case 'month': {
        const sqls = [];
        const ps = [];
        for (const v of tok.values) {
          const a = tok.kind === 'on' ? v : `${v}-01`;
          const b = tok.kind === 'on' ? addDays(v, 1) : `${addMonth(v)}-01`;
          sqls.push('(t.occurred_at >= ? AND t.occurred_at < ?)');
          ps.push(dayStart(a, ctx), dayStart(b, ctx));
        }
        add(sqls.length > 1 ? `(${sqls.join(' OR ')})` : sqls[0], ...ps);
        break;
      }
      case 'from':
        add('t.occurred_at >= ?', dayStart(tok.values[0], ctx));
        break;
      case 'to':
        add('t.occurred_at < ?', dayStart(addDays(tok.values[0], 1), ctx));
        break;
      case 'word':
      case 'phrase': {
        const numeric = tok.kind === 'word' && /^\d+(\.\d+)?$/.test(tok.value) && toMinor(tok.value, ctx.minorScale) !== null;
        if (numeric) add(`(t.amount_minor = ? OR ${ftsIn})`, toMinor(tok.value, ctx.minorScale), ftsPhrase(tok.value, true));
        else if (!textDone) {
          textDone = true;
          add(ftsIn, text.map((x) => ftsPhrase(x.value, x.kind === 'word')).join(' '));
        }
        break;
      }
      default:
        break; // invalid tokens never reach SQL
    }
  }
  return { where: parts.join(' AND '), params };
}

export function search(input, ctx) {
  const parsed = parse(input, ctx);
  return { ...parsed, ...toSql(parsed, ctx) };
}
