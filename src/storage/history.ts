import type { InputSource, TestConfig } from '../engine'

import type { StoredTest } from './db'

/**
 * History, personal bests and the rolling median.
 *
 * All pure. It takes the records the database hands back and produces the two
 * comparisons the results screen shows, plus the rows the history list renders.
 */

/** Days in the rolling median window, from ARCHITECTURE.md 8.3. */
export const MEDIAN_WINDOW_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * A personal best is scoped to the exact configuration, so time-30-punctuation
 * and time-30-plain are separate records — and to the input source, so a test
 * thumbed out on a phone is compared against other phone tests rather than
 * against a keyboard.
 *
 * Same reasoning as the bigram exclusion in DECISIONS 1.1: thumb typing and
 * touch typing are different motor tasks, and a comparison across them measures
 * the instrument rather than the person.
 */
export function scopeOf(config: TestConfig, inputSource: InputSource): string {
  return [
    config.mode,
    String(config.value),
    config.punctuation ? 'p' : '-',
    config.numbers ? 'n' : '-',
    config.adaptive ? 'a' : '-',
    inputSource,
  ].join(':')
}

export function scopeOfTest(test: StoredTest): string {
  return scopeOf(test.config, test.inputSource)
}

export function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const middle = sorted.length >> 1

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0
  }

  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

export type HistoryRow = {
  readonly id: string
  readonly startedAt: number
  readonly config: TestConfig
  readonly inputSource: InputSource
  readonly wpm: number
  readonly accuracy: number
  readonly scope: string
  /** The best result ever recorded for this scope. */
  readonly isPersonalBest: boolean
}

/**
 * Newest first, with the personal best marked once per scope.
 *
 * A tie keeps the earlier test as the record, which is the convention every
 * scoreboard uses: you have to beat it, not match it.
 */
export function buildHistory(tests: readonly StoredTest[]): readonly HistoryRow[] {
  const byScope = new Map<string, StoredTest>()
  const countByScope = new Map<string, number>()

  for (const test of tests) {
    const scope = scopeOfTest(test)
    const current = byScope.get(scope)

    countByScope.set(scope, (countByScope.get(scope) ?? 0) + 1)

    if (
      current === undefined ||
      test.derived.wpm > current.derived.wpm ||
      (test.derived.wpm === current.derived.wpm && test.startedAt < current.startedAt)
    ) {
      byScope.set(scope, test)
    }
  }

  return [...tests]
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((test) => {
      const scope = scopeOfTest(test)

      return {
        id: test.id,
        startedAt: test.startedAt,
        config: test.config,
        inputSource: test.inputSource,
        wpm: test.derived.wpm,
        accuracy: test.derived.accuracy,
        scope,
        // A record needs something to have beaten. The only run at a
        // configuration is not a personal best, it is the only data point, and
        // badging it says the opposite of what it means.
        isPersonalBest: (countByScope.get(scope) ?? 0) > 1 && byScope.get(scope)?.id === test.id,
      }
    })
}

/** The best WPM ever recorded for a scope, or null if it has never been run. */
export function personalBest(tests: readonly StoredTest[], scope: string): number | null {
  const matching = tests.filter((test) => scopeOfTest(test) === scope)

  if (matching.length === 0) {
    return null
  }

  return Math.max(...matching.map((test) => test.derived.wpm))
}

export type Comparison = {
  /** Median WPM over the window, or null when there is nothing to compare to. */
  readonly medianWpm: number | null
  readonly medianAccuracy: number | null
  readonly isPersonalBest: boolean
  readonly testsSoFar: number
}

/**
 * What the results screen needs: the seven day median to compare against and
 * whether this run took the record.
 *
 * `tests` must exclude the run being reported. A test that compares against
 * itself is always exactly average and never a personal best.
 */
export function compare(
  previous: readonly StoredTest[],
  current: { readonly wpm: number; readonly config: TestConfig; readonly inputSource: InputSource },
  now: number,
  windowDays: number = MEDIAN_WINDOW_DAYS,
): Comparison {
  const scope = scopeOf(current.config, current.inputSource)
  const sameSource = previous.filter((test) => test.inputSource === current.inputSource)
  const recent = sameSource.filter((test) => test.startedAt >= now - windowDays * DAY_MS)
  const best = personalBest(previous, scope)

  return {
    medianWpm: recent.length === 0 ? null : median(recent.map((test) => test.derived.wpm)),
    medianAccuracy:
      recent.length === 0 ? null : median(recent.map((test) => test.derived.accuracy)),
    isPersonalBest: best !== null && current.wpm > best,
    testsSoFar: previous.length,
  }
}

/** Human label for a configuration, in the config bar's own vocabulary. */
export function describeConfig(config: TestConfig): string {
  const parts = [config.mode, String(config.value)]

  if (config.punctuation) {
    parts.push('punctuation')
  }

  if (config.numbers) {
    parts.push('numbers')
  }

  return parts.join(' ')
}
