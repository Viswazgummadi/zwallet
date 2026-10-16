// SPDX-License-Identifier: GPL-3.0-only
import { expect, type Page } from '@playwright/test';

export const PLACEHOLDER_ROUTES = [
  'activity',
  'insights',
  'people',
  'accounts',
  'budgets',
  'recurring',
  'review',
  'settings',
] as const;

export const ROUTES = ['', ...PLACEHOLDER_ROUTES];

export async function fontsReady(page: Page) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** 200% text, the way DESIGN §1.7 tests it. (addStyleTag is blocked by the CSP.) */
export async function setTextScale200(page: Page) {
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
}

/** No horizontal scroll: the document is never wider than the viewport. */
export async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}
