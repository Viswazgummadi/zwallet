// SPDX-License-Identifier: GPL-3.0-only
import type { IconName } from '../../ui/generated/icons.ts';

export interface PlaceholderCopy {
  readonly title: string;
  readonly icon: IconName;
  readonly emptyTitle: string;
  readonly body: string;
}

/** Copy for screens whose content arrives in later milestones (DESIGN §8 voice). */
export const PLACEHOLDERS = {
  transactions: {
    title: 'Transactions',
    icon: 'receipt_long',
    emptyTitle: 'Nothing here yet',
    body: 'Add an expense, or open a .zwallet file from your phone.',
  },
  insights: {
    title: 'Insights',
    icon: 'analytics',
    emptyTitle: 'Insights need a little history',
    body: 'Add a few transactions and zwallet will explain where your money goes.',
  },
  people: {
    title: 'People',
    icon: 'group',
    emptyTitle: 'No people yet',
    body: 'Track money you lend and borrow, and split expenses with friends.',
  },
  accounts: {
    title: 'Accounts',
    icon: 'account_balance',
    emptyTitle: 'No accounts yet',
    body: 'Accounts appear when you add transactions or import from your phone.',
  },
  budgets: {
    title: 'Budgets',
    icon: 'savings',
    emptyTitle: 'No budgets yet',
    body: 'Set a monthly limit and zwallet will tell you how you are pacing.',
  },
  recurring: {
    title: 'Recurring',
    icon: 'subscriptions',
    emptyTitle: 'Nothing recurring yet',
    body: 'Subscriptions, rent and EMIs show up here once zwallet spots them.',
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
