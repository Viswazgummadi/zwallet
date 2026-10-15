// SPDX-License-Identifier: GPL-3.0-only
import { EmptyState } from '../../ui/EmptyState.tsx';
import type { PlaceholderCopy } from './copy.ts';

export function PlaceholderPage({ copy }: { copy: PlaceholderCopy }) {
  return (
    <div className="py-6">
      <h1 className="text-headline">{copy.title}</h1>
      <EmptyState icon={copy.icon} title={copy.emptyTitle} body={copy.body} />
    </div>
  );
}
