// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { fixture } from '../test/fixtures.ts';
import {
  insightDismissalId,
  newUuidV7,
  normalizeBody,
  normalizeSender,
  seedId,
  smsId,
  transactionTagId,
  uuidV7,
  uuidV8,
} from './ids.ts';

const uuid = fixture<{
  v8: Array<{ name: string; uuid: string }>;
  v7: Array<{ unix_ms: number; rand_hex: string; uuid: string }>;
  sms: Array<{
    sender: string;
    body: string;
    date_sent_s: number;
    normalized_sender: string;
    normalized_body: string;
    uuid: string;
  }>;
  seed: Array<{ system_key: string; uuid: string }>;
  transaction_tag: Array<{ transaction_id: string; tag_id: string; uuid: string }>;
  insight_dismissal: Array<{ rule_id: string; subject_key: string; uuid: string }>;
}>('uuid.json');

const bytes = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));

describe('uuid vectors (packages/contracts/fixtures/uuid.json)', () => {
  it.each(uuid.v8)('v8 "$name"', async (c) => {
    expect(await uuidV8(c.name)).toBe(c.uuid);
  });
  it.each(uuid.v7)('v7 $unix_ms', (c) => {
    expect(uuidV7(c.unix_ms, bytes(c.rand_hex))).toBe(c.uuid);
  });
  it.each(uuid.sms)('sms $sender @$date_sent_s', async (c) => {
    expect(normalizeSender(c.sender)).toBe(c.normalized_sender);
    expect(normalizeBody(c.body)).toBe(c.normalized_body);
    expect(await smsId(c.sender, c.body, c.date_sent_s)).toBe(c.uuid);
  });
  it.each(uuid.seed)('seed $system_key', async (c) => {
    expect(await seedId(c.system_key)).toBe(c.uuid);
  });
  it('transaction tag and insight dismissal ids', async () => {
    for (const c of uuid.transaction_tag)
      expect(await transactionTagId(c.transaction_id, c.tag_id)).toBe(c.uuid);
    for (const c of uuid.insight_dismissal)
      expect(await insightDismissalId(c.rule_id, c.subject_key)).toBe(c.uuid);
  });
});

it('newUuidV7 is RFC 9562 version 7 and sorts by time', () => {
  const a = newUuidV7(1_760_000_000_000);
  const b = newUuidV7(1_760_000_000_001);
  expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(a < b).toBe(true);
});
