// SPDX-License-Identifier: GPL-3.0-only
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { NoticeContext, stubMessage } from './notice.ts';

/** DESIGN §4 Snackbar: 5 s, a new message replaces the old one. */
const NOTICE_MS = 5000;

/**
 * Owns the one polite live region for stub-action notices and shows the same text as a visible
 * toast line. The region stays mounted (empty) so assistive tech registers it before it speaks.
 */
export function NoticeHost({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const counter = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const announce = useCallback((feature: string) => {
    counter.current += 1;
    setNotice({ id: counter.current, text: stubMessage(feature) });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setNotice(null);
    }, NOTICE_MS);
  }, []);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  return (
    <NoticeContext value={announce}>
      {children}
      <div
        role="status"
        aria-live="polite"
        data-testid="notice"
        className="pointer-events-none fixed inset-x-4 bottom-28 z-30 flex justify-center expanded:inset-x-auto expanded:right-6 expanded:bottom-6"
      >
        {notice && (
          <p
            key={notice.id}
            className="rounded-md bg-inverse-surface px-4 py-3 text-body-sm text-inverse-on-surface"
          >
            {notice.text}
          </p>
        )}
      </div>
    </NoticeContext>
  );
}
