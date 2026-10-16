// SPDX-License-Identifier: GPL-3.0-only
import { createContext, useContext } from 'react';

/** Announces "<feature> arrives in the next update." for controls whose feature isn't built yet. */
export type Announce = (feature: string) => void;

export const NoticeContext = createContext<Announce>(() => undefined);

/** Stub actions stay visible and enabled; activating one tells the user (and screen readers). */
export function useStubAction(): Announce {
  return useContext(NoticeContext);
}

export function stubMessage(feature: string): string {
  return `${feature} arrives in the next update.`;
}
