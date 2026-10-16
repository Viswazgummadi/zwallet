// SPDX-License-Identifier: GPL-3.0-only
// Builds fixtures/search.json (called by vectors.mjs): inputs -> tokens + WHERE + params, plus the
// ids each query must return over a small dataset, computed by running the SQL on SQLite (the
// apps run the same statements on their own SQLite builds).
import { search } from '../lib/search-reference.mjs';
import { openDb } from '../lib/sqlite.mjs';

export const CONTEXT = { today: '2026-10-16', tzOffsetMinutes: 330, minorScale: 2 };
const at = (date, hh = 0, mm = 0, ss = 0, ms = 0) =>
  Date.parse(`${date}T00:00:00Z`) + ((hh * 60 + mm) * 60 + ss) * 1000 + ms - CONTEXT.tzOffsetMinutes * 60000;
const COFFEE = 'Caf' + String.fromCodePoint(0xe9) + ' filter coffee';
const q = (v) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replaceAll("'", "''")}'`);
const ins = (table, row) => `INSERT INTO ${table} (${Object.keys(row).join(', ')}) VALUES (${Object.values(row).map(q).join(', ')})`;
const meta = { hlc: '1760000000000-0000-aaaaaaaa', created_at: 1760000000000, updated_at: 1760000000000 };

function dataset() {
  const cat = (id, name, parent_id, system_key = null) => ins('categories', { id, ...meta, parent_id, name, icon: 'x', color_token: 'x', counts_as: 'spend', system_key });
  const acct = (id, name, last4, kind = 'bank') => ins('accounts', { id, ...meta, name, kind, last4 });
  const merch = (id, name) => ins('merchants', { id, ...meta, name });
  const tag = (id, name, system_key = null) => ins('tags', { id, ...meta, name, system_key });
  const txn = (id, o) =>
    ins('transactions', {
      id, ...meta, deleted_at: null, type: 'expense', currency: 'INR', occurred_tz: 'Asia/Kolkata', account_id: null, category_id: null, merchant_id: null,
      counterparty_raw: null, note: null, payment_method: 'upi', source: 'manual', review_state: 'confirmed', split_group_id: null, recurring_series_id: null, ...o,
    });
  const fts = (id, merchant, note, counterparty, tags) => ins('transactions_fts', { transaction_id: id, merchant, note, counterparty, tags });
  const tt = (id, transaction_id, tag_id, deleted_at = null) => ins('transaction_tags', { id, ...meta, deleted_at, transaction_id, tag_id });
  return [
    'PRAGMA foreign_keys = OFF',
    cat('g-food', 'Food', null), cat('c-groc', 'Groceries', 'g-food', 'food.groceries'), cat('c-dine', 'Dining out', 'g-food', 'food.dining'),
    cat('g-trans', 'Transport', null), cat('c-fuel', 'Fuel', 'g-trans', 'transport.fuel'),
    acct('a-hdfc', 'HDFC', '1234'), acct('a-sbi', 'SBI Savings', '9876'), acct('a-cash', 'Cash', null, 'cash'),
    merch('m-swiggy', 'Swiggy'), merch('m-bigb', 'Big Basket'), merch('m-uber', 'Uber'),
    tag('tg-trip', 'Trip'), tag('tg-reimb', 'Reimbursable', 'reimbursable'),
    ins('people', { id: 'p-rahul', ...meta, display_name: 'Rahul' }),
    txn('t01', { amount_minor: 42000, occurred_at: at('2026-10-15', 12), account_id: 'a-hdfc', category_id: 'c-dine', merchant_id: 'm-swiggy', note: 'Biryani night', counterparty_raw: 'swiggy.stores@axl' }),
    txn('t02', { amount_minor: 125000, occurred_at: at('2026-10-10', 18), account_id: 'a-sbi', category_id: 'c-groc', merchant_id: 'm-bigb', payment_method: 'card' }),
    txn('t03', { type: 'income', amount_minor: 5000000, occurred_at: at('2026-09-30', 23, 30), account_id: 'a-sbi', note: 'Salary', source: 'sms', payment_method: 'netbanking' }),
    txn('t04', { amount_minor: 50000, occurred_at: at('2026-10-16', 9), account_id: 'a-cash', category_id: 'c-fuel', merchant_id: 'm-uber', note: 'Room 500 deposit', review_state: 'needs_review', payment_method: 'cash', source: 'paste' }),
    txn('t05', { amount_minor: 99950, occurred_at: at('2026-10-01', 0), account_id: 'a-hdfc', category_id: 'c-dine', merchant_id: 'm-swiggy', split_group_id: 'sg1' }),
    txn('t06', { deleted_at: 1760000500000, amount_minor: 42000, occurred_at: at('2026-10-15', 13), account_id: 'a-hdfc', category_id: 'c-dine', merchant_id: 'm-swiggy', note: 'Biryani night' }),
    txn('t07', { amount_minor: 20000, occurred_at: at('2026-10-05', 8), account_id: 'a-hdfc', note: 'Netflix', payment_method: 'auto_debit', source: 'recurring_auto', recurring_series_id: 'rs1' }),
    txn('t08', { amount_minor: 18000, occurred_at: at('2026-09-01', 0, 0, 0, 0) - 1, account_id: 'a-cash', note: COFFEE, counterparty_raw: 'cafe.coffee@upi' }),
    txn('t09', { amount_minor: 100, occurred_at: at('2026-10-12', 13), account_id: 'a-cash', note: 'lunch split with Rahul', payment_method: 'cash' }),
    txn('t10', { type: 'refund', amount_minor: 42000, occurred_at: at('2026-10-14', 10), account_id: 'a-hdfc', category_id: 'c-dine', merchant_id: 'm-swiggy' }),
    tt('tt1', 't01', 'tg-trip'), tt('tt2', 't05', 'tg-reimb'), tt('tt3', 't02', 'tg-trip', 1760000600000),
    ins('ledger_entries', { id: 'le1', ...meta, deleted_at: null, person_id: 'p-rahul', kind: 'lent', amount_minor: 50, currency: 'INR', occurred_at: at('2026-10-12', 13), transaction_id: 't09' }),
    fts('t01', 'Swiggy', 'Biryani night', 'swiggy.stores@axl', 'Trip'), fts('t02', 'Big Basket', '', '', ''), fts('t03', '', 'Salary', '', ''),
    fts('t04', 'Uber', 'Room 500 deposit', '', ''), fts('t05', 'Swiggy', '', '', 'Reimbursable'), fts('t06', 'Swiggy', 'Biryani night', '', ''),
    fts('t07', '', 'Netflix', '', ''), fts('t08', '', COFFEE, 'cafe.coffee@upi', ''),
    fts('t09', '', 'lunch split with Rahul', '', ''), fts('t10', 'Swiggy', '', '', ''),
  ];
}

const INPUTS = [
  '', '   ', 'swiggy', 'SWIGGY biryani', 'swig', '"biryani night"', '"night biryani"', 'coffee', String.fromCodePoint(0x63, 0x61, 0x66, 0xe9), 'cafe.coffee@upi',
  '500', '1000', '1.00', 'trip', 'reimb', 'room 500', '!!!', '"  "', 'say"hi', 'foo:bar',
  'cat:dining out', 'cat:"dining out"', 'cat:dining-out', 'CAT:Groceries', 'cat:food.groceries,fuel', 'cat:', 'group:food', 'group:transport,food', 'merchant:swiggy', 'merchant:big-basket', 'merchant:"big basket",uber',
  'acct:hdfc-1234', 'acct:hdfc', 'acct:1234', 'acct:sbi-savings', 'acct:sbi-savings-9876', 'acct:cash,hdfc-1234',
  'tag:trip', 'tag:reimbursable,trip', 'person:rahul', 'person:nobody',
  'type:income', 'type:expense,refund', 'type:bogus', 'source:sms', 'source:csv', 'method:upi', 'method:cash,card',
  'is:review', 'is:split', 'is:recurring', 'is:review,split', 'is:foo', 'has:note',
  '>500', '>=500', '<500', '<=500', '500..2000', '2000..500', 'amt:500', 'amt:>1000.50', 'amt:>1.234', '>abc', '>1,000', 'amt:',
  'on:today', 'on:yesterday', 'on:2026-10-15', 'on:2026-10-15,2026-10-12', 'on:2026-02-30', 'from:2026-10-01', 'to:2026-09-30', 'from:2026-10-01 to:2026-10-12',
  'month:2026-09', 'month:2026-10', 'month:2026-13', 'from:today', 'to:yesterday', 'from:2026-10-01,2026-10-02',
  'swiggy cat:"dining out" is:split', 'cat:"dining out","fuel" is:review', 'cat:"a,b"', 'cat:dining-out >400 method:upi biryani', 'swiggy >=420 <=999.50 month:2026-10', 'type:refund merchant:swiggy "night"',
  'Swiggy "Biryani night" tag:trip acct:hdfc-1234 on:2026-10-15',
];

export function buildSearchVectors() {
  const sqls = dataset();
  const db = openDb({ local: true });
  for (const s of sqls) db.exec(s);
  const cases = INPUTS.map((input) => {
    const r = search(input, CONTEXT);
    const ids = db.prepare(`SELECT t.id FROM transactions t WHERE ${r.where} ORDER BY t.id`).all(...r.params).map((x) => x.id);
    return { input, tokens: r.tokens, where: r.where, params: r.params, expect_ids: ids };
  });
  return {
    'fixtures/search.json': {
      description:
        'Generated by scripts/search-vectors.mjs from lib/search-reference.mjs; never hand-edit. Grammar: packages/contracts/README.md "Search grammar". For each case an implementation must produce exactly `tokens` (deep-equal) from `input` under `context`, exactly `where` (string-equal) and `params` (same order, same types) over `transactions t`, and `SELECT t.id FROM transactions t WHERE <where> ORDER BY t.id` on the canonical schema + transactions_fts loaded with `dataset_sql` (run in order; foreign keys off) must return `expect_ids`. today is a calendar date in the display timezone; day starts are local midnights computed with tzOffsetMinutes (330 = Asia/Kolkata, no DST in the dataset).',
      context: CONTEXT,
      dataset_sql: sqls,
      cases,
    },
  };
}
