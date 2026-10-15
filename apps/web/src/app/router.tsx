// SPDX-License-Identifier: GPL-3.0-only
import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from '@tanstack/react-router';
import { PLACEHOLDERS } from '../features/placeholder/copy.ts';
import { AppShell } from './AppShell.tsx';

const root = createRootRoute({ component: AppShell });

// Routes are code-split (ARCHITECTURE §8.2): each page is its own chunk.
const home = createRoute({
  getParentRoute: () => root,
  path: '/',
  component: lazyRouteComponent(() => import('../features/home/HomePage.tsx'), 'HomePage'),
});

const placeholders = (Object.keys(PLACEHOLDERS) as Array<keyof typeof PLACEHOLDERS>).map((key) =>
  createRoute({
    getParentRoute: () => root,
    path: `/${key}`,
    component: lazyRouteComponent(() => import('../features/placeholder/routes.tsx'), key),
  }),
);

export const router = createRouter({
  routeTree: root.addChildren([home, ...placeholders]),
  basepath: import.meta.env.BASE_URL,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
