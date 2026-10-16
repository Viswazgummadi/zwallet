// SPDX-License-Identifier: GPL-3.0-only
import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from '@tanstack/react-router';
import { HomePage } from '../features/home/HomePage.tsx';
import { PLACEHOLDERS } from '../features/placeholder/copy.ts';
import { AppShell } from './AppShell.tsx';

const root = createRootRoute({ component: AppShell });

// Home is the landing route and tiny, so it ships in the entry chunk (no waterfall on cold load).
// Every other page is code-split (ARCHITECTURE §8.2).
const home = createRoute({ getParentRoute: () => root, path: '/', component: HomePage });

// The main tab was called "Transactions" before it became "Activity" on both platforms.
const legacyTransactions = createRoute({
  getParentRoute: () => root,
  path: '/transactions',
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's redirect protocol
    throw redirect({ to: '/activity', replace: true });
  },
});

const placeholders = (Object.keys(PLACEHOLDERS) as Array<keyof typeof PLACEHOLDERS>).map((key) =>
  createRoute({
    getParentRoute: () => root,
    path: `/${key}`,
    component: lazyRouteComponent(() => import('../features/placeholder/routes.tsx'), key),
  }),
);

export const router = createRouter({
  routeTree: root.addChildren([home, legacyTransactions, ...placeholders]),
  basepath: import.meta.env.BASE_URL,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
