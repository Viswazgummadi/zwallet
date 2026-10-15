// SPDX-License-Identifier: GPL-3.0-only
import type { ReactNode } from 'react';
import type { IconName } from './generated/icons.ts';
import { Icon } from './Icon.tsx';

/** DESIGN §4 EmptyState: illustration, one sentence, primary CTA. */
export function EmptyState({
  icon,
  title,
  body,
  children,
}: {
  icon: IconName;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
        <Icon name={icon} />
      </div>
      <h2 className="text-title text-ink-primary">{title}</h2>
      <p className="text-body text-ink-secondary">{body}</p>
      {children}
    </section>
  );
}
