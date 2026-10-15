// SPDX-License-Identifier: GPL-3.0-only
// Shared cross-platform vectors (packages/contracts/fixtures). Test-only; Node APIs.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed view of a JSON file
export function fixture<T>(name: string): T {
  const url = new URL(`../../../../packages/contracts/fixtures/${name}`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as T;
}
