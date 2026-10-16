// SPDX-License-Identifier: GPL-3.0-only

/**
 * ADR 0020: every GitHub Pages site of one account shares `<user>.github.io`, and with it the
 * browser's OPFS, IndexedDB and localStorage. A project site (served under a sub-path) therefore
 * can't keep your data private from its siblings; only a dedicated origin can.
 */
export function isSharedOrigin(location: Pick<Location, 'hostname'>, base: string): boolean {
  return location.hostname.toLowerCase().endsWith('.github.io') && base !== '/';
}

export function sharedOriginWarning(host: string): string {
  return `This copy runs on a shared web address. Other sites on ${host} could read data you save here. Use zwallet from its own address.`;
}
