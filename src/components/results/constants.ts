/**
 * The results entrance sequence.
 *
 * ARCHITECTURE.md section 7 zone C: the results screen is the emotional payoff
 * of the loop and the only place worth spending animation budget. One
 * orchestrated moment lands harder than motion sprinkled across the whole app,
 * so these offsets describe a single 700ms sequence rather than four
 * independent animations.
 */
export const RESULTS_ENTRANCE = {
  /** Total wall time of the sequence. */
  totalMs: 700,
  /** Numbers count up from zero over this long, starting immediately. */
  countUpMs: 400,
  /** The graph draws left to right, starting here. */
  graphDelayMs: 150,
  graphDrawMs: 400,
  /** Secondary stats rise in here. */
  secondaryDelayMs: 350,
  /** The weakness card follows one stagger step later. */
  cardDelayMs: 390,
  cardStaggerMs: 40,
  riseMs: 180,
  riseDistancePx: 12,
} as const

/** Stat blocks shown under the graph, in order, per docs/DESIGN.md. */
export const SECONDARY_STATS = ['raw wpm', 'consistency', 'characters', 'time'] as const
