import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vite'
import type { PluginOption } from 'vite'

/*
 * The bundle report, in two shapes.
 *
 * `raw-data` is what scripts/check-bundle.mjs reads to attribute a failure to
 * the modules that caused it; `treemap` is what a human opens afterwards. Both
 * carry gzipSize, because the budget in ARCHITECTURE.md section 10 is written
 * against the compressed size and a raw byte count is not the number anybody
 * waits for.
 *
 * emitFile is false so the reports land beside dist rather than inside the
 * asset graph, where they would be served and, worse, counted.
 *
 * The cast is rollup's Plugin type meeting vite's under
 * exactOptionalPropertyTypes: every optional hook property differs by an
 * implicit `| undefined`. It is a type-level disagreement between two versions
 * of the same interface, not a runtime one.
 */
const bundleReport = (): PluginOption[] =>
  (
    [
      { filename: 'dist/stats.json', template: 'raw-data' },
      { filename: 'dist/stats.html', template: 'treemap' },
    ] as const
  ).map(
    (report) =>
      visualizer({
        filename: report.filename,
        template: report.template,
        gzipSize: true,
        emitFile: false,
      }) as PluginOption,
  )

export default defineConfig({
  plugins: [react(), tailwindcss(), ...bundleReport()],
  build: {
    // The engine and the test surface are written against ES2022. Matching the
    // tsconfig target here keeps the shipped bundle free of downlevel helpers
    // that would show up in the keystroke path.
    target: 'es2022',
    sourcemap: true,
  },
})
