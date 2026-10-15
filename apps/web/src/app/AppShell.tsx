// SPDX-License-Identifier: GPL-3.0-only
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { Icon } from '../ui/Icon.tsx';
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
 * below 840; global top bar with search, data chip, New and Export.
 */
export function AppShell() {
  const path = useActivePath();
  return (
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
          className="mx-auto w-full max-w-(--zw-size-content-max) flex-1 px-(--zw-size-gutter-compact) pb-24 medium:px-(--zw-size-gutter-medium) expanded:pb-8"
        >
          <Outlet />
        </main>
      </div>
      <BottomNav path={path} />
    </div>
  );
}

function Sidebar({ path }: { path: string }) {
  return (
    <nav
      aria-label="Main"
      className="sticky top-0 hidden h-dvh shrink-0 flex-col gap-1 border-r border-hairline bg-surface px-3 py-4 expanded:flex large:w-60"
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
            className={`flex min-h-12 items-center gap-3 rounded-full px-3 text-label ${
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
            className="flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-label-sm text-ink-secondary"
          >
            <span
              className={`flex h-8 w-16 items-center justify-center rounded-full ${
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

function TopBar() {
  const [theme, setTheme] = useState<ThemePref>(() => readThemePref());
  const cycleTheme = () => {
    const next = nextThemePref(theme);
    writeThemePref(next);
    applyThemePref(next);
    setTheme(next);
  };
  const soon = 'Arrives with the ledger (M1)';
  return (
    <header className="sticky top-0 z-10 flex min-h-16 items-center gap-2 border-b border-hairline bg-page/95 px-(--zw-size-gutter-compact) backdrop-blur medium:px-(--zw-size-gutter-medium)">
      <span className="text-title-sm text-primary expanded:hidden">zwallet</span>
      <button
        type="button"
        disabled
        title={soon}
        className="ml-auto flex min-h-12 min-w-12 items-center gap-2 rounded-md border border-hairline px-3 text-body-sm text-ink-muted disabled:cursor-not-allowed expanded:ml-0 expanded:min-w-72"
      >
        <Icon name="search" className="size-5" />
        <span className="hidden expanded:inline">Search</span>
        <kbd className="ml-auto hidden text-label-sm expanded:inline">Ctrl K</kbd>
      </button>
      <span className="hidden items-center gap-1 rounded-full bg-surface-sunken px-3 py-1 text-label-sm text-ink-secondary medium:inline-flex expanded:ml-auto">
        <Icon name="file_open" className="size-4" />
        No file imported yet
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
        disabled
        title={soon}
        className="hidden min-h-12 items-center gap-1 rounded-md border border-hairline px-4 text-label text-ink-muted disabled:cursor-not-allowed medium:flex"
      >
        <Icon name="download" className="size-5" />
        Export
      </button>
      <button
        type="button"
        disabled
        title={soon}
        className="flex min-h-12 items-center gap-1 rounded-md bg-primary px-4 text-label text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon name="add" className="size-5" />
        <span className="hidden medium:inline">New</span>
        <span className="sr-only medium:hidden">New transaction</span>
      </button>
    </header>
  );
}
