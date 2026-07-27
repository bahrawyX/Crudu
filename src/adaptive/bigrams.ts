import type { BigramSample, InputSource } from '../engine'

import { EWMA_ALPHA, MIN_BIGRAM_SAMPLES } from './params'

/**
 * Incremental EWMA aggregation over bigram latency.
 *
 * ARCHITECTURE.md 6.1: alpha 0.25 gives roughly a fifteen sample memory, so
 * recent performance dominates and improvement shows within a session or two,
 * but one fumbled keystroke does not reclassify a bigram as weak.
 *
 * A bigram with fewer than eight samples is carried but never used. The mean of
 * three keystrokes is noise wearing a number's clothes.
 */

export type BigramStat = {
  readonly pair: string
  readonly ewmaMs: number
  readonly n: number
  readonly errorRate: number
  readonly lastSeen: number
}

export type BigramTable = ReadonlyMap<string, BigramStat>

/** One test's worth of evidence: latencies for clean pairs, counts for errors. */
export type BigramObservation = {
  readonly samples: readonly BigramSample[]
  /** Pairs where the second keystroke was wrong. Latency is meaningless; the
   * error is not. */
  readonly errors: readonly string[]
  readonly at: number
  readonly inputSource: InputSource
}

function blend(previous: number, next: number, alpha: number): number {
  return previous * (1 - alpha) + next * alpha
}

/**
 * Folds one test into the table.
 *
 * A test typed on a soft keyboard contributes nothing at all. Thumb typing and
 * touch typing are different motor tasks, and a table that mixes them describes
 * neither — DECISIONS 1.1. The engine already withholds the samples; this
 * refuses them again, because the adaptive model is the one thing in the
 * product that cannot be rebuilt from the raw log if it is corrupted.
 */
export function aggregate(
  table: BigramTable,
  observation: BigramObservation,
  alpha: number = EWMA_ALPHA,
): BigramTable {
  if (observation.inputSource === 'virtual') {
    return table
  }

  const next = new Map(table)
  const errorCounts = new Map<string, number>()

  for (const pair of observation.errors) {
    errorCounts.set(pair, (errorCounts.get(pair) ?? 0) + 1)
  }

  const latencies = new Map<string, number[]>()

  for (const sample of observation.samples) {
    const list = latencies.get(sample.pair) ?? []

    list.push(sample.latencyMs)
    latencies.set(sample.pair, list)
  }

  for (const [pair, values] of latencies) {
    const current = next.get(pair)
    const errors = errorCounts.get(pair) ?? 0
    const attempts = values.length + errors

    let ewmaMs = current?.ewmaMs ?? values[0] ?? 0

    for (const value of values) {
      ewmaMs = current === undefined && ewmaMs === value ? value : blend(ewmaMs, value, alpha)
    }

    const n = (current?.n ?? 0) + values.length
    const previousErrorRate = current?.errorRate ?? 0
    const observedErrorRate = attempts === 0 ? 0 : errors / attempts

    next.set(pair, {
      pair,
      ewmaMs,
      n,
      errorRate:
        current === undefined ? observedErrorRate : blend(previousErrorRate, observedErrorRate, alpha),
      lastSeen: observation.at,
    })
  }

  // A pair that was only ever got wrong still deserves a record, so that the
  // error rate is visible once enough clean samples arrive to score it.
  for (const pair of errorCounts.keys()) {
    if (latencies.has(pair)) {
      continue
    }

    const current = next.get(pair)

    next.set(pair, {
      pair,
      ewmaMs: current?.ewmaMs ?? 0,
      n: current?.n ?? 0,
      errorRate: current === undefined ? 1 : blend(current.errorRate, 1, alpha),
      lastSeen: observation.at,
    })
  }

  return next
}

/** Bigrams with enough evidence behind them to be scored. */
export function scorable(
  table: BigramTable,
  minSamples: number = MIN_BIGRAM_SAMPLES,
): readonly BigramStat[] {
  return [...table.values()].filter((stat) => stat.n >= minSamples)
}

/** Serialisable form, for the bigram:{pair} records in IndexedDB. */
export function toRecords(table: BigramTable): readonly BigramStat[] {
  return [...table.values()]
}

export function fromRecords(records: readonly BigramStat[]): BigramTable {
  return new Map(records.map((record) => [record.pair, record]))
}
