// SPDX-License-Identifier: GPL-3.0-only
// ADR 0020: a copy served from <user>.github.io/<repo>/ shares storage with the user's other
// sites. Chromium resolves *.github.io to the local preview server here; nothing leaves the machine.
import { expect, test } from '@playwright/test';
import { fontsReady } from './helpers.ts';

test.use({ launchOptions: { args: ['--host-resolver-rules=MAP *.github.io localhost'] } });

const SHARED = 'http://someone.github.io:4173/zwallet/';
const WARNING =
  'This copy runs on a shared web address. Other sites on someone.github.io could read data you save here. Use zwallet from its own address.';

for (const scheme of ['light', 'dark'] as const) {
  test(`Home warns on a shared web address (${scheme})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(SHARED);
    const alert = page.getByRole('alert');
    await expect(alert).toHaveText(WARNING);
    await fontsReady(page);
    await expect(page).toHaveScreenshot(`shared-origin-${scheme}.png`, { fullPage: true });
  });
}

test('the warning stays while using the app (persistent on Home)', async ({ page }) => {
  await page.goto(SHARED);
  await page.getByRole('button', { name: 'Start fresh' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alert')).not.toHaveAttribute('hidden');
});
