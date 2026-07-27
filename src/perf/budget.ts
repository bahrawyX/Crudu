/**
 * The performance budget from ARCHITECTURE.md section 10.
 *
 * Latency regressions are invisible in code review and obvious in production,
 * which is why these numbers are code rather than prose. src/perf/latency.ts
 * reports against them in phase 2 and e2e/latency.spec.ts fails CI on them in
 * phase 5.
 */
export const PERFORMANCE_BUDGET = {
  /** Keydown to paint, 95th percentile. One frame at 120Hz, half a frame at 60Hz. */
  keydownToPaintP95Ms: 8,

  /**
   * Layout recalculations during a test. Not "few". Any Layout entry in a
   * DevTools trace taken while typing is a bug, which is what invariant 3 and
   * the no-restricted-syntax block exist to prevent.
   */
  layoutRecalcsDuringTest: 0,

  /** Initial JavaScript bundle, gzipped. Enforced in CI from phase 5. */
  initialBundleGzipKb: 150,

  /** Time until the surface accepts its first keystroke, from navigation start. */
  timeToFirstKeystrokeMs: 400,

  /** A 100 WPM typist generates roughly this many keystrokes per second. */
  keystrokesPerSecond: 8,

  /** Dropped frames tolerated over a 60 second synthetic typing run. */
  droppedFramesAllowed: 0,
} as const

export type PerformanceBudget = typeof PERFORMANCE_BUDGET
