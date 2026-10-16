// SPDX-License-Identifier: GPL-3.0-only
import { EmptyState } from '../../ui/EmptyState.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { useStubAction } from '../../ui/notice.ts';
import type { PlaceholderCopy } from './copy.ts';

export function PlaceholderPage({ copy }: { copy: PlaceholderCopy }) {
  const stub = useStubAction();
  const { cta } = copy;
  return (
    <div className="py-6">
      <h1 className="text-headline">{copy.title}</h1>
      <EmptyState icon={copy.icon} title={copy.emptyTitle} body={copy.body}>
        {cta && (
          <button
            type="button"
            onClick={() => {
              stub(cta.feature);
            }}
            className="mt-2 flex min-h-12 items-center gap-2 rounded-md bg-primary px-6 text-label text-on-primary"
          >
            <Icon name={cta.icon} className="size-5" />
            {cta.label}
          </button>
        )}
      </EmptyState>
    </div>
  );
}
