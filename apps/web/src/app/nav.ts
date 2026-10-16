// SPDX-License-Identifier: GPL-3.0-only
import type { IconName } from '../ui/generated/icons.ts';

export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: IconName;
  readonly selectedIcon?: IconName;
  /** In the phone bottom bar (DESIGN §3.2: < 840 px works like Android). */
  readonly primary: boolean;
}

/** DESIGN §3.2 sidebar order. */
export const NAV: readonly NavItem[] = [
  { to: '/', label: 'Home', icon: 'home', selectedIcon: 'home_fill', primary: true },
  {
    to: '/activity',
    label: 'Activity',
    icon: 'receipt_long',
    selectedIcon: 'receipt_long_fill',
    primary: true,
  },
  {
    to: '/insights',
    label: 'Insights',
    icon: 'analytics',
    selectedIcon: 'analytics_fill',
    primary: true,
  },
  { to: '/people', label: 'People', icon: 'group', selectedIcon: 'group_fill', primary: true },
  { to: '/accounts', label: 'Accounts', icon: 'account_balance', primary: false },
  { to: '/budgets', label: 'Budgets', icon: 'savings', primary: false },
  { to: '/recurring', label: 'Recurring', icon: 'subscriptions', primary: false },
  { to: '/review', label: 'Review', icon: 'edit_note', primary: false },
  { to: '/settings', label: 'Settings', icon: 'settings', primary: false },
];
