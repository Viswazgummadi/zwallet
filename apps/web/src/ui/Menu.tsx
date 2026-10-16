// SPDX-License-Identifier: GPL-3.0-only
import { Link } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { IconName } from './generated/icons.ts';
import { Icon } from './Icon.tsx';

export interface MenuItem {
  readonly key: string;
  readonly label: string;
  readonly icon: IconName;
  /** Route to navigate to; otherwise `onSelect` runs. */
  readonly to?: string;
  readonly onSelect?: () => void;
  /** Extra classes, e.g. responsive visibility. */
  readonly className?: string;
}

const ITEM_CLASS =
  'flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-left text-label text-ink-primary hover:bg-surface-sunken';

/**
 * Menu button pattern (WAI-ARIA APG): the button has aria-haspopup/expanded; opening moves focus
 * to the first item; arrows/Home/End move; Esc closes and returns focus; Tab closes.
 * Items hidden by CSS (display: none) are skipped by keyboard navigation.
 */
export function Menu({
  label,
  icon,
  items,
  className = '',
}: {
  label: string;
  icon: IconName;
  items: readonly MenuItem[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const visibleItems = (): HTMLElement[] =>
    Array.from(panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []).filter(
      (el) => el.offsetParent !== null,
    );

  useEffect(() => {
    if (open) visibleItems()[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) button.current?.focus();
  };

  const onPanelKeyDown = (e: KeyboardEvent) => {
    const list = visibleItems();
    const i = list.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => {
      e.preventDefault();
      list[(n + list.length) % list.length]?.focus();
    };
    switch (e.key) {
      case 'ArrowDown':
        go(i + 1);
        break;
      case 'ArrowUp':
        go(i - 1);
        break;
      case 'Home':
        go(0);
        break;
      case 'End':
        go(list.length - 1);
        break;
      case 'Escape':
        e.preventDefault();
        close(true);
        break;
      case 'Tab':
        close(false);
        break;
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="flex size-12 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-sunken"
      >
        <Icon name={icon} />
      </button>
      {open && (
        <div
          ref={panel}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onPanelKeyDown}
          className="absolute top-full right-0 z-20 mt-1 flex w-56 max-w-[calc(100vw-2*var(--zw-size-gutter-compact))] flex-col rounded-md border border-outline bg-surface-raised p-1"
        >
          {items.map((item) =>
            item.to ? (
              <Link
                key={item.key}
                to={item.to}
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  close(false);
                }}
                className={`${ITEM_CLASS} ${item.className ?? ''}`}
              >
                <Icon name={item.icon} className="size-5 shrink-0" />
                {item.label}
              </Link>
            ) : (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  close(true);
                  item.onSelect?.();
                }}
                className={`${ITEM_CLASS} ${item.className ?? ''}`}
              >
                <Icon name={item.icon} className="size-5 shrink-0" />
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
