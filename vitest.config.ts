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
      // No thresholds yet. Phase 1 sets 100% branch coverage on src/engine/,
      // which is the only place a threshold means anything.
    },
  },
})
