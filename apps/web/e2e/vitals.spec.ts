// SPDX-License-Identifier: GPL-3.0-only
// ARCHITECTURE §9 web vitals on the production preview. No dependency: PerformanceObserver only.
// Timing-based, so it is tagged @perf (run alone with `--grep @perf`, skip with `--grep-invert`)
// in case a loaded CI runner makes it flaky; the budgets leave several-fold headroom locally.
import { expect, test } from '@playwright/test';

const LCP_BUDGET_MS = 1200;
const INTERACTION_BUDGET_MS = 100;

test.describe('web vitals @perf', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test(`cold-load LCP <= ${LCP_BUDGET_MS} ms`, async ({ page }) => {
    await page.goto('./'); // fresh context: no service worker, no HTTP cache
    const lcp = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            resolve(entries[entries.length - 1]!.startTime);
          }).observe({ type: 'largest-contentful-paint', buffered: true });
        }),
    );
    console.log(`cold LCP: ${Math.round(lcp)} ms`);
    expect(lcp).toBeLessThanOrEqual(LCP_BUDGET_MS);
  });

  test(`nav click and theme toggle respond within ${INTERACTION_BUDGET_MS} ms`, async ({
    page,
  }) => {
    await page.goto('./');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      const w = window as unknown as { __events: number[] };
      w.__events = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__events.push(e.duration);
      }).observe({
        type: 'event',
        durationThreshold: 16, // not yet in lib.dom's PerformanceObserverInit
        buffered: true,
      } as PerformanceObserverInit);
    });

    await page.getByRole('link', { name: 'Insights' }).click();
    await expect(page.getByRole('heading', { name: 'Insights', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: /^Theme:/ }).click();
    await expect(page.getByRole('button', { name: 'Theme: Light' })).toBeVisible();
    await page.waitForTimeout(300); // let the observer deliver the trailing entries

    const durations = await page.evaluate(
      () => (window as unknown as { __events: number[] }).__events,
    );
    const worst = Math.max(0, ...durations);
    console.log(`slowest nav click / theme toggle event: ${worst} ms`);
    expect(worst).toBeLessThanOrEqual(INTERACTION_BUDGET_MS);
  });
});
