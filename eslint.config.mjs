import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/**
 * The mechanical form of the bans in AGENTS.md section 3 and
 * CODING_STANDARDS.md section 7. Each pattern below names the rule it enforces;
 * a false positive is fixed here, not suppressed at the call site.
 */

// Matches a quoted string (className="...", clsx('...'), or a Tailwind literal)
// that contains a raw palette utility or an arbitrary visual value.
const BANNED_CLASS_PATTERNS = [
  {
    name: 'raw Tailwind palette utilities (AGENTS.md 3)',
    pattern:
      /['"`][^'"`]*\b(?:bg|text|border|ring|from|via|to|fill|stroke|outline|decoration|divide|accent|caret|shadow|accent)-?(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b[^'"`]*['"`]/,
  },
  {
    name: 'arbitrary colour values (AGENTS.md 3)',
    pattern: /['"`][^'"`]*\b(?:bg|text|border|ring|from|via|to|fill|stroke|outline|decoration|divide)-(?:\[)(?:#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla)\()[^\]]*\][^'"`]*['"`]/,
  },
  {
    name: 'arbitrary spacing, radius, or shadow escapes (UI_UX_STANDARDS 2.3)',
    pattern:
      /['"`][^'"`]*(?:\b[pm][trblxy]?-\[|\bgap-\[|\bw-\[|\bh-\[|\brounded-\[|\bshadow-\[)[^\]]*\][^'"`]*['"`]/,
  },
  {
    name: 'text sizes below the accessibility floor (UI_UX_STANDARDS 2.2)',
    pattern: /['"`][^'"`]*\btext-\[(?:[0-9]|1[01])px\][^'"`]*['"`]/,
  },
  {
    name: 'inline visual style values (UI_UX_STANDARDS 7)',
    pattern: /\bstyle=\{\{[^}]*(?:color|background|padding|margin|font-size|border)/,
  },
  {
    name: 'secrets exposed through NEXT_PUBLIC_ (SECURITY.md 3)',
    pattern: /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|CREDENTIAL|DSN)[A-Z0-9_]*/,
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.turbo/**',
      'pnpm-lock.yaml',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Type safety (CODING_STANDARDS.md 1)
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-floating-promises': 'off',
      // Imports and modules (CODING_STANDARDS.md 3)
      'no-restricted-syntax': [
        'error',
        {
          selector: "ImportDeclaration[source.value='react'] > ImportDefaultSpecifier",
          message: 'Use a named import from react, not a default import.',
        },
        ...BANNED_CLASS_PATTERNS.map((entry) => ({
          selector: `Literal[value=/${entry.pattern.source}/]`,
          message: `Banned: ${entry.name}. Use a token from packages/design-tokens.`,
        })),
      ],
      // Logging (CODING_STANDARDS.md 5)
      'no-console': ['error', { allow: ['warn', 'error'] }],
      // React
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'module',
    },
    rules: {
      // CI scripts may log; application code may not (CODING_STANDARDS.md 5)
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.{test,spec}.{ts,tsx}'],
    rules: {
      // Non-null assertions are permitted in tests and narrowing contexts
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  prettier,
);