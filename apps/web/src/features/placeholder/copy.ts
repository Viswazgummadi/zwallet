// SPDX-License-Identifier: GPL-3.0-only
import type { IconName } from '../../ui/generated/icons.ts';

/** Primary call to action of an empty state (DESIGN §4). Not built yet, so it is a stub action. */
export interface PlaceholderCta {
  readonly label: string;
  readonly icon: IconName;
  /** Named in the "<feature> arrives in the next update." notice. */
  readonly feature: string;
}

export interface PlaceholderCopy {
  readonly title: string;
  readonly icon: IconName;
  readonly emptyTitle: string;
  readonly body: string;
  readonly cta?: PlaceholderCta;
}

const ADD_EXPENSE: PlaceholderCta = {
  label: 'Add expense',
  icon: 'add',
  feature: 'Adding expenses',
};

/** Copy for screens whose content arrives in later milestones (DESIGN §8 voice). */
export const PLACEHOLDERS = {
  activity: {
    title: 'Activity',
    icon: 'receipt_long',
    emptyTitle: 'Nothing here yet',
    body: 'Add an expense, or open a .zwallet file from your phone.',
    cta: ADD_EXPENSE,
  },
  insights: {
    title: 'Insights',
    icon: 'analytics',
    emptyTitle: 'Insights need a little history',
    body: 'Add a few transactions and zwallet will explain where your money goes.',
    cta: ADD_EXPENSE,
  },
  people: {
    title: 'People',
    icon: 'group',
    emptyTitle: 'No people yet',
    body: 'Track money you lend and borrow, and split expenses with friends.',
    cta: { label: 'Add person', icon: 'person_add', feature: 'Adding people' },
  },
  accounts: {
    title: 'Accounts',
    icon: 'account_balance',
    emptyTitle: 'No accounts yet',
    body: 'Accounts appear when you add transactions or import from your phone.',
    cta: { label: 'Add account', icon: 'add', feature: 'Adding accounts' },
  },
  budgets: {
    title: 'Budgets',
    icon: 'savings',
    emptyTitle: 'No budgets yet',
    body: 'Set a monthly limit and zwallet will tell you how you are pacing.',
    cta: { label: 'Set a budget', icon: 'add', feature: 'Budgets' },
  },
  recurring: {
    title: 'Recurring',
    icon: 'subscriptions',
    emptyTitle: 'Nothing recurring yet',
    body: 'Subscriptions, rent and EMIs show up here once zwallet spots them.',
    cta: { label: 'Add recurring payment', icon: 'add', feature: 'Recurring payments' },
  },
  review: {
    title: 'Review',
    icon: 'edit_note',
    emptyTitle: 'All caught up',
    body: 'Transactions that need a second look will wait for you here.',
  },
  settings: {
    title: 'Settings',
    icon: 'settings',
    emptyTitle: 'Settings are on their way',
    body: 'zwallet never connects to the internet. Your data is only on this device and in files you export.',
  },
} as const satisfies Record<string, PlaceholderCopy>;
