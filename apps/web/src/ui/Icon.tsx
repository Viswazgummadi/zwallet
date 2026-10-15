// SPDX-License-Identifier: GPL-3.0-only
import { ICON_VIEWBOX, icons, type IconName } from './generated/icons.ts';

/** Material Symbols Rounded glyph (bundled path data). Decorative unless `label` is given. */
export function Icon({
  name,
  label,
  className = 'size-6',
}: {
  name: IconName;
  label?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox={ICON_VIEWBOX}
      className={className}
      fill="currentColor"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={icons[name]} />
    </svg>
  );
}
