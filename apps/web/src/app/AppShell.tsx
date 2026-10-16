// SPDX-License-Identifier: GPL-3.0-only
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { Icon } from '../ui/Icon.tsx';
import { Menu, type MenuItem } from '../ui/Menu.tsx';
import { NoticeHost } from '../ui/NoticeHost.tsx';
import { useStubAction } from '../ui/notice.ts';
import {
  applyThemePref,
  nextThemePref,
  readThemePref,
  writeThemePref,
  type ThemePref,
} from '../ui/theme.ts';
import { NAV, type NavItem } from './nav.ts';

const THEME_LABEL: Record<ThemePref, string> = { system: 'System', light: 'Light', dark: 'Dark' };
const THEME_ICON = { system: 'contrast', light: 'light_mode', dark: 'dark_mode' } as const;

function useActivePath(): string {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return path;
}

function isActive(item: NavItem, path: string): boolean {
  return item.to === '/' ? path === '/' : path === item.to || path.startsWith(`${item.to}/`);
}

/**
 * App layout (DESIGN §3.2): labelled sidebar ≥ 1200 px, icon sidebar 840–1199, bottom navigation
 * below 840; global top bar with search, data chip, New and Export. The top bar adapts to its own
 * width (container queries, in rem) so it also holds at 200% text.
 */
export function AppShell() {
  const path = useActivePath();
  return (
    <NoticeHost>
      <div className="flex min-h-dvh bg-page text-ink-primary">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-surface-raised px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        <Sidebar path={path} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main
            id="main"
            className="mx-auto w-full max-w-(--zw-size-content-max) min-w-0 flex-1 px-(--zw-size-gutter-compact) pb-32 medium:px-(--zw-size-gutter-medium) expanded:pb-8"
          >
            <Outlet />
          </main>
        </div>
        <BottomNav path={path} />
      </div>
    </NoticeHost>
  );
}

function Sidebar({ path }: { path: string }) {
  return (
    <nav
      aria-label="Main"
      className="sticky top-0 hidden h-dvh shrink-0 flex-col gap-1 overflow-y-auto border-r border-hairline bg-surface px-3 py-4 expanded:flex large:w-60"
    >
      <div className="mb-4 flex items-center gap-2 px-2 text-title-sm text-primary">
        <Icon name="account_balance_wallet" />
        <span className="hidden large:inline">zwallet</span>
      </div>
      {NAV.map((item) => {
        const active = isActive(item, path);
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-label={item.label}
            title={item.label}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-12 shrink-0 items-center gap-3 rounded-full px-3 text-label ${
              active
                ? 'bg-primary-container text-on-primary-container'
                : 'text-ink-secondary hover:bg-surface-sunken'
            }`}
          >
            <Icon name={active && item.selectedIcon ? item.selectedIcon : item.icon} />
            <span className="hidden large:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function BottomNav({ path }: { path: string }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)] expanded:hidden"
    >
      {NAV.filter((i) => i.primary).map((item) => {
        const active = isActive(item, path);
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={active ? 'page' : undefined}
            className="flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-center focus-visible:-outline-offset-2 text-label-sm wrap-anywhere text-ink-secondary"
          >
            <span
              className={`flex h-8 w-16 max-w-full items-center justify-center rounded-full ${
                active ? 'bg-primary-container text-on-primary-container' : ''
              }`}
            >
              <Icon name={active && item.selectedIcon ? item.selectedIcon : item.icon} />
            </span>
            <span className={active ? 'text-ink-primary' : ''}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

const OUTLINED_BUTTON =
  'flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-md border border-outline px-3 text-body-sm text-ink-primary hover:bg-surface-sunken';

function TopBar() {
  const stub = useStubAction();
  const [theme, setTheme] = useState<ThemePref>(() => readThemePref());
  const cycleTheme = () => {
    const next = nextThemePref(theme);
    writeThemePref(next);
    applyThemePref(next);
    setTheme(next);
  };

  // Phone: the DESIGN §3.1 avatar/overflow menu holds the destinations the bottom bar lacks. Wide
  // top bars hold Export inline; narrow ones (phone, or large text) move it into the same menu.
  const menuItems: MenuItem[] = [
    ...NAV.filter((i) => !i.primary).map((i) => ({
      key: i.to,
      label: i.label,
      icon: i.icon,
      to: i.to,
      className: 'expanded:hidden',
    })),
    {
      key: 'export',
      label: 'Export',
      icon: 'download',
      onSelect: () => {
        stub('Export');
      },
      className: '@4xl:hidden',
    },
  ];

  return (
    <header className="@container sticky top-0 z-10 flex min-h-16 flex-wrap items-center gap-2 border-b border-hairline bg-page/95 px-(--zw-size-gutter-compact) py-2 backdrop-blur medium:px-(--zw-size-gutter-medium)">
      <span className="min-w-0 text-title-sm text-primary expanded:hidden">zwallet</span>
      <button
        type="button"
        aria-label="Search"
        onClick={() => {
          stub('Search');
        }}
        className={`${OUTLINED_BUTTON} ml-auto expanded:ml-0 expanded:max-w-md expanded:min-w-0 expanded:flex-1 expanded:basis-0 expanded:justify-start`}
      >
        <Icon name="search" className="size-5 shrink-0" />
        <span className="hidden expanded:inline">Search</span>
      </button>
      <span className="hidden items-center gap-1 rounded-full border border-outline bg-surface-raised px-3 py-1 text-label-sm whitespace-nowrap text-ink-secondary medium:inline-flex expanded:ml-auto">
        <Icon name="file_open" className="size-4 shrink-0" />
        <span className="sr-only @3xl:not-sr-only">No file imported yet</span>
      </span>
      <button
        type="button"
        onClick={cycleTheme}
        aria-label={`Theme: ${THEME_LABEL[theme]}`}
        title={`Theme: ${THEME_LABEL[theme]}`}
        className="flex size-12 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-sunken"
      >
        <Icon name={THEME_ICON[theme]} />
      </button>
      <button
        type="button"
        onClick={() => {
          stub('Export');
        }}
        className={`${OUTLINED_BUTTON} hidden px-4 text-label @4xl:flex`}
      >
        <Icon name="download" className="size-5" />
        Export
      </button>
      <button
        type="button"
        onClick={() => {
          stub('Adding transactions');
        }}
        className="flex min-h-12 items-center gap-1 rounded-md bg-primary px-4 text-label text-on-primary"
      >
        <Icon name="add" className="size-5" />
        <span className="hidden medium:inline">New</span>
        <span className="sr-only medium:hidden">New transaction</span>
      </button>
      <Menu label="Menu" icon="menu" items={menuItems} className="@4xl:expanded:hidden" />
    </header>
  );
}
