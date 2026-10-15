// SPDX-License-Identifier: GPL-3.0-only
// Third-party notices bundled into both apps (shown by the About screen, M7). Every third-party
// asset that ships inside the APK or the web build must be listed here with its full license text.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

interface Notice {
  name: string;
  copyright: string;
  license: string;
  usage: string;
  text: string;
}

function notices(root: string): Notice[] {
  const symbols = path.dirname(require.resolve('@material-symbols/svg-400/package.json'));
  return [
    {
      name: 'Inter',
      copyright: 'Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)',
      license: 'SIL Open Font License 1.1 (OFL-1.1)',
      usage: 'UI typeface, subset to Latin and the rupee sign (ADR 0015).',
      text: readFileSync(path.join(root, 'packages/design-tokens/licenses/Inter-OFL.txt'), 'utf8'),
    },
    {
      name: 'Material Symbols (Rounded)',
      copyright: 'Copyright Google LLC',
      license: 'Apache License 2.0 (Apache-2.0)',
      usage: 'Icon path data, converted to Android vector drawables and web SVG paths.',
      text: readFileSync(path.join(symbols, 'LICENSE'), 'utf8'),
    },
  ];
}

function render(root: string): string {
  const rule = '='.repeat(78);
  const parts = [
    'zwallet - third-party notices',
    '',
    'zwallet is free software under the GNU General Public License v3.0 only.',
    'It bundles the following third-party assets under their own licenses.',
    '',
  ];
  for (const n of notices(root)) {
    parts.push(
      rule,
      n.name,
      n.copyright,
      `License: ${n.license}`,
      `Used for: ${n.usage}`,
      rule,
      '',
    );
    parts.push(n.text.replace(/\r\n/g, '\n').trimEnd(), '');
  }
  return `${parts.join('\n')}\n`;
}

/** [file, content] pairs written by build.ts: one copy per app. */
export function noticeOutputs(root: string): Array<[string, string]> {
  const text = render(root);
  return [
    [
      path.join(root, 'apps/android/core/designsystem/src/main/res/raw/third_party_notices.txt'),
      text,
    ],
    [path.join(root, 'apps/web/public/third-party-notices.txt'), text],
  ];
}
