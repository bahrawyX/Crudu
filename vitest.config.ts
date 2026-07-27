import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The engine is pure functions and the storage layer is pure key handling,
    // so none of the unit suites need a DOM. Phase 2 adds a jsdom environment
    // for the component tests rather than paying for one here.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Playwright owns e2e/. Vitest picking those files up would try to run them
    // as unit tests and fail confusingly.
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/main.tsx', 'src/vite-env.d.ts', 'src/words/**'],
      // The engine is pure functions with no I/O, so there is no excuse for an
      // untested branch in it. Everything else is held to nothing yet; a
      // threshold on a module that cannot be fully exercised is theatre.
      thresholds: {
        'src/engine/**': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
})
