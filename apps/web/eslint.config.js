// SPDX-License-Identifier: GPL-3.0-only
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dev-dist',
      'src/generated',
      'src/ui/generated',
      'playwright-report',
      'test-results',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      // noUncheckedIndexedAccess is on; `!` marks indexes that are in bounds by construction.
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Nothing online (ADR 0012): no fetch to other origins, no dangerouslySetInnerHTML (ARCH §10).
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'No dangerouslySetInnerHTML (XSS, ARCHITECTURE §10).',
        },
        {
          selector: "CallExpression[callee.name='fetch'] > Literal[value=/^https?:/]",
          message: 'zwallet never talks to other origins (ADR 0012).',
        },
      ],
    },
  },
);
