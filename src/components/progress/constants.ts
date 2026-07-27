/**
 * Progress screen constants.
 *
 * ARCHITECTURE.md section 8.3: plot the rolling median, not the personal best.
 * Personal bests are noise-chasing; the median is the thing that actually moves.
 */
export const PROGRESS = {
  /** Width of the rolling window, in days. */
  rollingMedianDays: 7,
  /** Nothing is plotted until this many tests exist. The empty state says so. */
  minimumTests: 3,
  /** The progress line draws over this long, with no entrance delay. */
  drawMs: 500,
  /** Bigram improvements listed under the chart. */
  improvedRowLimit: 5,
} as const

/** Rows shown on the full weakness report before it stops being a list and starts being a wall. */
export const WEAKNESS_ROW_LIMIT = 24

/** Every fifth row carries a hairline, which is what makes a long list scannable. */
export const WEAKNESS_RULE_EVERY = 5
