// SPDX-License-Identifier: GPL-3.0-only
// Screenshot baselines (DESIGN §9, OPEN_QUESTIONS #22: pixel comparison is Windows-only).
import { expect, test } from '@playwright/test';
import { fontsReady, PLACEHOLDER_ROUTES, setTextScale200 } from './helpers.ts';

const SCHEMES = ['light', 'dark'] as const;

test.describe('placeholder pages', () => {
  for (const route of PLACEHOLDER_ROUTES) {
    for (const scheme of SCHEMES) {
      test(`${route} ${scheme}`, async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(`./${route}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await fontsReady(page);
        await expect(page).toHaveScreenshot(`page-${route}-${scheme}.png`);
      });
    }
  }
});

test.describe('Home at 200% text', () => {
  for (const vp of [
    { name: 'phone', width: 390, height: 844 },
    { name: 'desktop', width: 1440, height: 900 },
  ]) {
    for (const scheme of SCHEMES) {
      test(`${vp.name} ${scheme}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto('./');
        await setTextScale200(page);
        await fontsReady(page);
        await expect(page.getByRole('heading', { name: 'Open your zwallet file' })).toBeVisible();
        await expect(page).toHaveScreenshot(`home-200-${vp.name}-${scheme}.png`);
      });
    }
  }
});

test.describe('phone overflow menu open', () => {
  for (const scheme of SCHEMES) {
    test(scheme, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('./');
      await page.getByRole('button', { name: 'Menu' }).click();
      await expect(page.getByRole('menu')).toBeVisible();
      await fontsReady(page);
      await expect(page).toHaveScreenshot(`menu-open-phone-${scheme}.png`);
    });
  }
});

test.describe('focus ring on a nav item', () => {
  for (const scheme of SCHEMES) {
    test(scheme, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('./');
      await fontsReady(page);
      await page.keyboard.press('Tab'); // keyboard modality, so :focus-visible applies
      const nav = page.getByRole('navigation', { name: 'Main' });
      const link = nav.getByRole('link', { name: 'Insights' });
      await link.focus();
      await expect(link).toBeFocused();
      const outline = await link.evaluate((el) => getComputedStyle(el).outlineStyle);
      expect(outline).toBe('solid');
      await expect(nav).toHaveScreenshot(`nav-focus-${scheme}.png`);
    });
  }
});
