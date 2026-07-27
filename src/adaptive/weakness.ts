import type { BigramStat, BigramTable } from './bigrams'
import { scorable } from './bigrams'
import { ERROR_RATE_WEIGHT, MIN_BIGRAM_SAMPLES, RETIREMENT_APPEARANCES, TARGET_SET_SIZE } from './params'

/**
 * Weakness scoring, normalised against the user's own typing.
 *
 *   z        = (bigram.ewmaMs - userMedianMs) / userStdDevMs
 *   weakness = max(0, z) * (1 + errorRate * 2)
 *
 * ARCHITECTURE.md 8.2: normalising against the user's own median is the whole
 * idea. It targets *your* relative weaknesses rather than the universally hard
 * bigrams, so the app stays useful as you improve and your bottleneck moves.
 * A global baseline would drill everyone on `ol` forever and would stop being
 * true about anybody the moment they got good.
 */

export type UserBaseline = {
  readonly medianMs: number
  readonly stdDevMs: number
  readonly sampleCount: number
}

export type WeaknessScore = {
  readonly pair: string
  readonly weakness: number
  readonly ewmaMs: number
  readonly n: number
  readonly errorRate: number
}

function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const middle = sorted.length >> 1

  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

/** The user's own centre and spread, over every bigram with enough evidence. */
export function baselineOf(
  table: BigramTable,
  minSamples: number = MIN_BIGRAM_SAMPLES,
): UserBaseline {
  const stats = scorable(table, minSamples)
  const latencies = stats.map((stat) => stat.ewmaMs)

  if (latencies.length === 0) {
    return { medianMs: 0, stdDevMs: 0, sampleCount: 0 }
  }

  const mean = latencies.reduce((total, value) => total + value, 0) / latencies.length
  const variance =
    latencies.reduce((total, value) => total + (value - mean) ** 2, 0) / latencies.length

  return {
    medianMs: median(latencies),
    stdDevMs: Math.sqrt(variance),
    sampleCount: latencies.length,
  }
}

export function weaknessOf(stat: BigramStat, baseline: UserBaseline): number {
  // With no spread there is nothing to be relatively slow at, and dividing by
  // zero would make every bigram infinitely weak.
  if (baseline.stdDevMs <= 0) {
    return 0
  }

  const z = (stat.ewmaMs - baseline.medianMs) / baseline.stdDevMs

  return Math.max(0, z) * (1 + stat.errorRate * ERROR_RATE_WEIGHT)
}

/** Every scorable bigram, weakest first. */
export function scoreAll(
  table: BigramTable,
  minSamples: number = MIN_BIGRAM_SAMPLES,
): readonly WeaknessScore[] {
  const baseline = baselineOf(table, minSamples)

  return scorable(table, minSamples)
    .map((stat) => ({
      pair: stat.pair,
      weakness: weaknessOf(stat, baseline),
      ewmaMs: stat.ewmaMs,
      n: stat.n,
      errorRate: stat.errorRate,
    }))
    .sort((a, b) => b.weakness - a.weakness || b.ewmaMs - a.ewmaMs)
}

export type TargetSet = {
  readonly pairs: readonly string[]
  /** Consecutive appearances below the median, per pair. */
  readonly improving: ReadonlyMap<string, number>
}

export const EMPTY_TARGETS: TargetSet = { pairs: [], improving: new Map() }

/**
 * Retirement. ARCHITECTURE.md 8.2 step 5: when a targeted bigram's EWMA drops
 * below the user's median across three consecutive appearances, drop it and
 * pull in the next. The set stays at fifteen, always current, always just past
 * the edge of comfort.
 *
 * The counter resets the moment a pair comes back above the median, so one good
 * run does not retire something that is still slow.
 */
export function refreshTargets(
  table: BigramTable,
  previous: TargetSet = EMPTY_TARGETS,
  size: number = TARGET_SET_SIZE,
  appearances: number = RETIREMENT_APPEARANCES,
): TargetSet {
  const baseline = baselineOf(table)
  const improving = new Map(previous.improving)
  const retired = new Set<string>()

  for (const pair of previous.pairs) {
    const stat = table.get(pair)

    if (stat === undefined) {
      continue
    }

    if (stat.ewmaMs < baseline.medianMs) {
      const streak = (improving.get(pair) ?? 0) + 1

      improving.set(pair, streak)

      if (streak >= appearances) {
        retired.add(pair)
        improving.delete(pair)
      }

      continue
    }

    improving.set(pair, 0)
  }

  const ranked = scoreAll(table).filter((score) => score.weakness > 0 && !retired.has(score.pair))
  const kept = previous.pairs.filter(
    (pair) => !retired.has(pair) && ranked.some((score) => score.pair === pair),
  )
  const pairs = [...kept]

  for (const score of ranked) {
    if (pairs.length >= size) {
      break
    }

    if (!pairs.includes(score.pair)) {
      pairs.push(score.pair)
    }
  }

  return { pairs: pairs.slice(0, size), improving }
}
