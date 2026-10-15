-- SPDX-License-Identifier: GPL-3.0-only
-- Android-only device-local tables (ARCHITECTURE §4.3, §6). Never exported, never logged.

-- One row per SMS seen. raw_body is kept only while "Keep raw text locally" is on (ARCH §6.5).
CREATE TABLE sms_index (
  sms_id         INTEGER NOT NULL PRIMARY KEY,
  fingerprint    TEXT    NOT NULL,
  received_at    INTEGER NOT NULL,
  status         TEXT    NOT NULL
                 CHECK (status IN ('transaction','ignored','needs_review','failed','upcoming','balance')),
  kind           TEXT    NOT NULL,
  confidence     INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  parsed_json    TEXT,
  raw_body       TEXT,
  transaction_id TEXT
);
CREATE UNIQUE INDEX sms_index_fingerprint ON sms_index (fingerprint);
