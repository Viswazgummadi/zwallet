// SPDX-License-Identifier: GPL-3.0-only
import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const base = process.env.ZW_BASE ?? '/zwallet/';

/**
 * e2e runs against the production build (`vite preview`), so the CSP and service worker are real.
 * Screenshot baselines are recorded on the owner's Windows machine (the visual source of truth,
 * Inter renders differently per OS); other platforms run every functional assertion and skip
 * pixel comparison. Update with: pnpm --filter web e2e --update-snapshots
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  ignoreSnapshots: process.platform !== 'win32',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFileName}/{arg}-{platform}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  use: {
    baseURL: `http://localhost:${port}${base}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm build && pnpm preview',
    url: `http://localhost:${port}${base}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
