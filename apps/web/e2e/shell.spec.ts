// SPDX-License-Identifier: GPL-3.0-only
import { expect, test, type Page } from '@playwright/test';
import { CSP } from '../csp.ts';

const ROUTES = [
  '',
  'transactions',
  'insights',
  'people',
  'accounts',
  'budgets',
  'recurring',
  'review',
  'settings',
];
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1000, height: 800 },
  { name: 'phone', width: 390, height: 844 },
] as const;

async function fontsReady(page: Page) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

test.describe('first-run Home (DESIGN §6)', () => {
  for (const vp of VIEWPORTS) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${vp.name} ${scheme}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto('./');
        await expect(page.getByRole('heading', { name: 'Open your zwallet file' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Choose file…' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Start fresh' })).toBeVisible();
        await expect(page.getByText('nothing is uploaded')).toBeVisible();
        await fontsReady(page);
        await expect(page).toHaveScreenshot(`home-${vp.name}-${scheme}.png`, { fullPage: true });
      });
    }
  }
});

test('navigation layout follows DESIGN §3.2 breakpoints', async ({ page }) => {
  const main = page.getByRole('navigation', { name: 'Main' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  await expect(main.getByRole('link', { name: 'Settings' })).toBeVisible(); // labelled sidebar
  await expect(main.getByText('Settings', { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 1000, height: 800 });
  await expect(main.getByRole('link', { name: 'Settings' })).toBeVisible(); // icon rail
  await expect(main.getByText('Settings', { exact: true })).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(main.getByRole('link', { name: 'People' })).toBeVisible(); // bottom bar, 4 items
  await expect(main.getByRole('link', { name: 'Settings' })).toHaveCount(0);
});

test('every route renders, navigates, and marks the current page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  await page.getByRole('link', { name: 'Insights' }).click();
  await expect(page).toHaveURL(/\/insights$/);
  await expect(page.getByRole('heading', { name: 'Insights', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Insights' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  for (const r of ROUTES.slice(1)) {
    await page.goto(`./${r}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});

test('theme toggle cycles system → light → dark and survives a reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./');
  const toggle = page.getByRole('button', { name: /^Theme:/ });
  await expect(toggle).toHaveAccessibleName('Theme: System');
  await toggle.click();
  await toggle.click();
  await expect(toggle).toHaveAccessibleName('Theme: Dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); // applied before paint
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  expect(bg).toBe('rgb(11, 12, 14)'); // dark page token #0B0C0E
});

test.describe('nothing online (ADR 0012, AC-11.9)', () => {
  test('zero requests leave the app origin, across every route and the service worker', async ({
    page,
    context,
    baseURL,
  }) => {
    const origin = new URL(baseURL!).origin;
    const foreign: string[] = [];
    context.on('request', (req) => {
      const url = req.url();
      if (!url.startsWith('data:') && !url.startsWith('blob:') && new URL(url).origin !== origin)
        foreign.push(url);
    });
    await page.goto('./');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    for (const r of ROUTES) {
      await page.goto(`./${r}`);
      await page.waitForLoadState('networkidle');
    }
    await page.reload(); // now served through the service worker
    await page.waitForLoadState('networkidle');
    expect(foreign).toEqual([]);
  });

  test('the CSP is present and blocks a request to another origin', async ({ page }) => {
    await page.goto('./');
    const meta = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(meta).toBe(CSP);
    expect(meta).toContain("connect-src 'self'");
    const blocked = await page.evaluate(async () => {
      try {
        // eslint-disable-next-line no-restricted-syntax -- the request the CSP must block
        await fetch('https://example.com/');
        return false;
      } catch {
        return true;
      }
    });
    expect(blocked).toBe(true);
  });

  test('works offline after the first visit (PWA precache)', async ({ page, context }) => {
    await page.goto('./');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.reload();
    await context.setOffline(true);
    await page.goto('./people');
    await expect(page.getByRole('heading', { name: 'People', level: 1 })).toBeVisible();
    await context.setOffline(false);
  });
});
