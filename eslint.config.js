import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/*
 * Invariants 1, 2 and 3 from CLAUDE.md, expressed as lint errors.
 *
 * These are errors, never warnings. A warning is a note that a rule was broken
 * and the build shipped anyway, which is the same as not having the rule. `pnpm
 * lint` runs with --max-warnings 0 for the same reason.
 *
 * tests/engine/invariants.test.ts checks the same three rules by walking the
 * source tree. The duplication is deliberate: a `files` glob below can be
 * edited to stop covering a directory and nothing would fail, whereas the test
 * reads the directories directly.
 */

const ENGINE = ['src/engine/**/*.{ts,tsx}']
const TEST_SURFACE = ['src/components/test/**/*.{ts,tsx}']

/**
 * Reading any of these forces the browser to flush pending style and layout
 * work synchronously. On a keystroke that is a guaranteed frame drop.
 *
 * The first four are the ones invariant 3 names. The rest force layout in
 * exactly the same way, and docs/design-prototype.html positions its caret
 * with offsetLeft, offsetTop, offsetWidth and clientWidth. A rule
 * that stopped at the four named APIs would let three of those four straight
 * through, which is the opposite of the point. See docs/DECISIONS.md.
 */
const LAYOUT_READS = [
  'getBoundingClientRect',
  'getClientRects',
  'getComputedStyle',
  'offsetWidth',
  'offsetHeight',
  'offsetLeft',
  'offsetTop',
  'offsetParent',
  'clientWidth',
  'clientHeight',
  'clientLeft',
  'clientTop',
  'scrollWidth',
  'scrollHeight',
]

const LAYOUT_READ_MESSAGE =
  'Invariant 3: no layout reads in the keystroke path. Caret position is arithmetic — column * charWidth, line * lineHeight — with charWidth measured once on font load via canvas measureText and cached. See ARCHITECTURE.md 4.1.'

/** Bare global call: getComputedStyle(el), getBoundingClientRect is never one. */
const layoutReadSelectors = LAYOUT_READS.flatMap((api) => [
  {
    selector: `MemberExpression[property.name='${api}']`,
    message: `${api}: ${LAYOUT_READ_MESSAGE}`,
  },
  {
    selector: `MemberExpression[computed=true][property.value='${api}']`,
    message: `${api}: ${LAYOUT_READ_MESSAGE}`,
  },
  {
    selector: `ObjectPattern > Property[key.name='${api}']`,
    message: `${api}: ${LAYOUT_READ_MESSAGE}`,
  },
  {
    selector: `CallExpression[callee.name='${api}']`,
    message: `${api}: ${LAYOUT_READ_MESSAGE}`,
  },
])

/**
 * Every way a module specifier can enter a file: static import, side-effect
 * import, re-export, dynamic import and require. no-restricted-imports below
 * covers the first three with better messages; these selectors close the last
 * two, which that rule does not see.
 *
 * \b rather than an escaped slash so the selector needs no slash escaping:
 * ^motion\b matches "motion" and "motion/react" but not "motionless".
 */
function importSelectors(pattern, message) {
  return [
    `ImportDeclaration[source.value=/${pattern}/]`,
    `ImportExpression[source.value=/${pattern}/]`,
    `ExportNamedDeclaration[source.value=/${pattern}/]`,
    `ExportAllDeclaration[source.value=/${pattern}/]`,
    `CallExpression[callee.name='require'][arguments.0.value=/${pattern}/]`,
  ].map((selector) => ({ selector, message }))
}

const REACT_PATTERN = String.raw`^react(-dom)?\b`
const ANIMATION_PATTERN = String.raw`^(motion|framer-motion|gsap)\b`

const REACT_IN_ENGINE_MESSAGE =
  'Invariant 1: the typing engine never imports React. It is a pure TypeScript reducer; React subscribes to it via useSyncExternalStore at word granularity. Importing a hook here puts React back in the input path. See ARCHITECTURE.md 4.2.'

const ANIMATION_ON_SURFACE_MESSAGE =
  'Invariant 2: no JavaScript animation library on the test surface. <motion.span> per character adds a hook, a subscription and a style write to each of ~300 nodes, at 8 keystrokes per second. Characters and caret animate with CSS transitions. See ARCHITECTURE.md 7.'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },

  js.configs.recommended,
  tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },

  {
    files: ['src/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
    },
  },

  // ---- Invariant 1: no React inside the engine -----------------------------
  // ---- Invariant 3: no layout reads inside the engine ----------------------
  // Both live in one block because no-restricted-syntax does not merge across
  // configs. The last config that sets it wins outright, so every selector for
  // a directory has to be listed together.
  {
    files: ENGINE,
    rules: {
      'no-restricted-syntax': [
        'error',
        ...importSelectors(REACT_PATTERN, REACT_IN_ENGINE_MESSAGE),
        ...layoutReadSelectors,
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
              message: REACT_IN_ENGINE_MESSAGE,
            },
          ],
        },
      ],
    },
  },

  // ---- Invariant 2: no JS animation library on the test surface ------------
  // ---- Invariant 3: no layout reads on the test surface --------------------
  {
    files: TEST_SURFACE,
    rules: {
      'no-restricted-syntax': [
        'error',
        ...importSelectors(ANIMATION_PATTERN, ANIMATION_ON_SURFACE_MESSAGE),
        ...layoutReadSelectors,
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['motion', 'motion/*', 'framer-motion', 'framer-motion/*', 'gsap', 'gsap/*'],
              message: ANIMATION_ON_SURFACE_MESSAGE,
            },
          ],
        },
      ],
    },
  },

  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    extends: [tseslint.configs.disableTypeChecked],
  },

  {
    files: ['tests/**/*.ts', 'e2e/**/*.ts'],
    rules: {
      // Suites read fixtures off disk and assert on literal values; neither is
      // worth a shared helper.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
)
