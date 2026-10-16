// SPDX-License-Identifier: GPL-3.0-only
// One lazily loaded chunk for every not-yet-built page (named exports per route key).
import { PLACEHOLDERS } from './copy.ts';
import { PlaceholderPage } from './PlaceholderPage.tsx';

export const activity = () => <PlaceholderPage copy={PLACEHOLDERS.activity} />;
export const insights = () => <PlaceholderPage copy={PLACEHOLDERS.insights} />;
export const people = () => <PlaceholderPage copy={PLACEHOLDERS.people} />;
export const accounts = () => <PlaceholderPage copy={PLACEHOLDERS.accounts} />;
export const budgets = () => <PlaceholderPage copy={PLACEHOLDERS.budgets} />;
export const recurring = () => <PlaceholderPage copy={PLACEHOLDERS.recurring} />;
export const review = () => <PlaceholderPage copy={PLACEHOLDERS.review} />;
export const settings = () => <PlaceholderPage copy={PLACEHOLDERS.settings} />;
