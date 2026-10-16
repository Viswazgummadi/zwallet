// SPDX-License-Identifier: GPL-3.0-only
import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { cspWith } from '../csp.ts';
import { expectNoHorizontalScroll, fontsReady, ROUTES, setTextScale200 } from './helpers.ts';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1000, height: 800 },
  { name: 'phone', width: 390, height: 844 },
] as const;

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
        await expect(page.getByRole('alert')).toHaveCount(0); // not on a shared origin
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
  await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden(); // sidebar has everything

  await page.setViewportSize({ width: 1000, height: 800 });
  await expect(main.getByRole('link', { name: 'Settings' })).toBeVisible(); // icon rail
  await expect(main.getByText('Settings', { exact: true })).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(main.getByRole('link', { name: 'People' })).toBeVisible(); // bottom bar, 4 items
  await expect(main.getByRole('link', { name: 'Activity' })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Settings' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible(); // avatar/overflow menu
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

test('the old /transactions path redirects to /activity', async ({ page }) => {
  await page.goto('./transactions');
  await expect(page).toHaveURL(/\/activity$/);
  await expect(page.getByRole('heading', { name: 'Activity', level: 1 })).toBeVisible();
});

test.describe('phone overflow menu (DESIGN §3.1)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('reaches Settings, is keyboard operable and returns focus on Esc', async ({ page }) => {
    await page.goto('./');
    const button = page.getByRole('button', { name: 'Menu' });
    await expect(button).toHaveAttribute('aria-haspopup', 'menu');
    await expect(button).toHaveAttribute('aria-expanded', 'false');

    await button.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    const items = page.getByRole('menuitem');
    await expect(items).toHaveText([
      'Accounts',
      'Budgets',
      'Recurring',
      'Review',
      'Settings',
      'Export',
    ]);
    await expect(items.first()).toBeFocused(); // focus moves into the menu
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press('End');
    await expect(items.last()).toBeFocused();
    await page.keyboard.press('ArrowDown'); // wraps
    await expect(items.first()).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(items.last()).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-expanded', 'false');

    await button.click();
    await page.getByRole('menuitem', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('closes on an outside click', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.mouse.click(4, 600); // empty page margin, clear of the panel
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('Export in the menu announces that it is coming', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Export' }).click();
    await expect(page.getByTestId('notice')).toHaveText('Export arrives in the next update.');
  });

  test('the search button has an accessible name', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeVisible();
  });
});

test.describe('stub actions stay enabled and announce themselves (D-N7)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Search, Export, New and empty-state CTAs', async ({ page }) => {
    await page.goto('./activity');
    const notice = page.getByTestId('notice');
    await expect(notice).toHaveAttribute('role', 'status');
    await expect(notice).toHaveAttribute('aria-live', 'polite');
    const cases: Array<[string, string]> = [
      ['Search', 'Search arrives in the next update.'],
      ['Export', 'Export arrives in the next update.'],
      ['New', 'Adding transactions arrives in the next update.'],
      ['Add expense', 'Adding expenses arrives in the next update.'],
    ];
    for (const [name, text] of cases) {
      const btn = page.getByRole('button', { name, exact: true });
      await expect(btn).toBeEnabled();
      await expect(btn).not.toHaveAttribute('title', /.+/);
      await btn.click();
      await expect(notice).toHaveText(text);
    }
    await expect(page.getByText('Ctrl K')).toHaveCount(0);
  });

  test('every empty state has its primary CTA', async ({ page }) => {
    const ctas: Record<string, string> = {
      activity: 'Add expense',
      insights: 'Add expense',
      people: 'Add person',
      accounts: 'Add account',
      budgets: 'Set a budget',
      recurring: 'Add recurring payment',
    };
    for (const [route, label] of Object.entries(ctas)) {
      await page.goto(`./${route}`);
      await expect(page.getByRole('button', { name: label })).toBeEnabled();
    }
  });
});

test.describe('200% text (DESIGN §1.7)', () => {
  for (const width of [320, 390, 1440]) {
    test(`no horizontal scroll at ${width} px on every route`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      for (const r of ROUTES) {
        await page.goto(`./${r}`);
        await setTextScale200(page);
        await fontsReady(page);
        await expectNoHorizontalScroll(page);
      }
    });
  }

  test('phone: every bottom-nav destination and the primary actions stay reachable', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./');
    await setTextScale200(page);
    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const name of ['Home', 'Activity', 'Insights', 'People']) {
      const link = nav.getByRole('link', { name });
      await expect(link).toBeVisible();
      const box = (await link.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
    for (const name of ['New transaction', 'Menu', 'Search']) {
      const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
  });

  test('desktop: Settings stays reachable in the sidebar and Export moves to the menu', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./');
    await setTextScale200(page);
    const settings = page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Settings' });
    await settings.scrollIntoViewIfNeeded();
    await expect(settings).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeHidden();
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('menuitem')).toHaveText(['Export']);
  });
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

  test('the CSP meta is present, hashes the inline theme script, and is enforced', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __violations: string[] };
      w.__violations = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        w.__violations.push(e.violatedDirective);
      });
    });
    await page.goto('./');
    const meta = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    const inline = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script:not([src])')).map((s) => s.textContent),
    );
    expect(inline).toHaveLength(1);
    const hash = createHash('sha256').update(inline[0]!, 'utf8').digest('base64');
    expect(meta).toBe(cspWith([hash]));
    for (const d of [
      "connect-src 'self'",
      "form-action 'none'",
      "base-uri 'none'",
      "object-src 'none'",
    ])
      expect(meta).toContain(d);
    expect(meta).not.toContain('unsafe-inline');

    await page.evaluate(async () => {
      try {
        // eslint-disable-next-line no-restricted-syntax -- the request the CSP must block
        await fetch('https://example.com/', { mode: 'no-cors' });
      } catch {
        /* blocked, as intended */
      }
    });
    const violations = await page.evaluate(
      () => (window as unknown as { __violations: string[] }).__violations,
    );
    expect(violations.some((d) => d.startsWith('connect-src'))).toBe(true);
    expect(violations.some((d) => d.startsWith('script-src'))).toBe(false); // theme-init allowed
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
