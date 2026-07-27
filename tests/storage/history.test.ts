import { describe, expect, it } from 'vitest'

import type { InputSource, TestConfig } from '../../src/engine'
import type { StoredTest } from '../../src/storage/db'
import {
  buildHistory,
  compare,
  describeConfig,
  median,
  personalBest,
  scopeOf,
} from '../../src/storage/history'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_700_000_000_000

function config(overrides: Partial<TestConfig> = {}): TestConfig {
  return { mode: 'time', value: 30, punctuation: false, numbers: false, adaptive: false, ...overrides }
}

function test(
  id: string,
  wpm: number,
  daysAgo = 0,
  overrides: { config?: TestConfig; inputSource?: InputSource; accuracy?: number } = {},
): StoredTest {
  return {
    id,
    startedAt: NOW - daysAgo * DAY,
    config: overrides.config ?? config(),
    inputSource: overrides.inputSource ?? 'physical',
    derived: {
      wpm,
      raw: wpm + 4,
      accuracy: overrides.accuracy ?? 96,
      consistency: 80,
      chars: { correct: 0, incorrect: 0, extra: 0, missed: 0 },
    },
    log: null,
  }
}

describe('median', () => {
  it('takes the middle of an odd set and the mean of the middle two of an even one', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(median([])).toBe(0)
  })
})

describe('scope', () => {
  it('separates two configurations that differ only in punctuation', () => {
    expect(scopeOf(config(), 'physical')).not.toBe(scopeOf(config({ punctuation: true }), 'physical'))
  })

  it('separates a phone from a keyboard', () => {
    expect(scopeOf(config(), 'physical')).not.toBe(scopeOf(config(), 'virtual'))
  })

  it('describes a configuration in the config bar vocabulary', () => {
    expect(describeConfig(config())).toBe('time 30')
    expect(describeConfig(config({ punctuation: true, numbers: true }))).toBe(
      'time 30 punctuation numbers',
    )
  })
})

describe('personal bests', () => {
  const tests = [
    test('a', 70),
    test('b', 82),
    test('c', 75),
    test('d', 90, 0, { config: config({ punctuation: true }) }),
    test('e', 120, 0, { inputSource: 'virtual' }),
  ]

  it('is the best at that exact configuration', () => {
    expect(personalBest(tests, scopeOf(config(), 'physical'))).toBe(82)
  })

  it('keeps punctuation separate from plain', () => {
    expect(personalBest(tests, scopeOf(config({ punctuation: true }), 'physical'))).toBe(90)
  })

  it('keeps a phone record out of the keyboard record', () => {
    expect(personalBest(tests, scopeOf(config(), 'virtual'))).toBe(120)
    expect(personalBest(tests, scopeOf(config(), 'physical'))).toBe(82)
  })

  it('is null for a configuration never run', () => {
    expect(personalBest(tests, scopeOf(config({ numbers: true }), 'physical'))).toBeNull()
  })
})

describe('history rows', () => {
  it('marks one best per scope, newest first', () => {
    const rows = buildHistory([test('a', 70, 2), test('b', 82, 1), test('c', 75, 0)])

    expect(rows.map((row) => row.id)).toEqual(['c', 'b', 'a'])
    expect(rows.filter((row) => row.isPersonalBest).map((row) => row.id)).toEqual(['b'])
  })

  it('gives the record to the earlier test on a tie', () => {
    const rows = buildHistory([test('older', 80, 3), test('newer', 80, 1)])

    expect(rows.find((row) => row.isPersonalBest)?.id).toBe('older')
  })

  it('marks a best in each scope independently', () => {
    const rows = buildHistory([
      test('desk', 80),
      test('desk2', 70, 1),
      test('phone', 40, 0, { inputSource: 'virtual' }),
      test('phone2', 38, 1, { inputSource: 'virtual' }),
    ])

    expect(rows.filter((row) => row.isPersonalBest).map((row) => row.id)).toEqual(['desk', 'phone'])
  })

  it('does not badge the only run at a configuration', () => {
    // A record needs something to have beaten. One data point is not a best.
    expect(buildHistory([test('only', 80)])[0]?.isPersonalBest).toBe(false)
  })

  it('carries the input source through so history can mark it', () => {
    const rows = buildHistory([test('phone', 40, 0, { inputSource: 'virtual' })])

    expect(rows[0]?.inputSource).toBe('virtual')
  })
})

describe('comparison', () => {
  it('takes the median over the window and ignores what falls outside it', () => {
    const previous = [test('a', 60, 1), test('b', 70, 2), test('c', 200, 30)]

    expect(compare(previous, { wpm: 80, config: config(), inputSource: 'physical' }, NOW).medianWpm).toBe(
      65,
    )
  })

  it('compares a phone run against phone runs only', () => {
    const previous = [
      test('desk1', 80, 1),
      test('desk2', 84, 2),
      test('phone1', 38, 1, { inputSource: 'virtual' }),
      test('phone2', 42, 2, { inputSource: 'virtual' }),
    ]

    const phone = compare(previous, { wpm: 44, config: config(), inputSource: 'virtual' }, NOW)

    expect(phone.medianWpm).toBe(40)
    expect(phone.isPersonalBest).toBe(true)
  })

  it('reports no median at all when the window is empty', () => {
    const comparison = compare([], { wpm: 80, config: config(), inputSource: 'physical' }, NOW)

    expect(comparison.medianWpm).toBeNull()
    expect(comparison.medianAccuracy).toBeNull()
    expect(comparison.isPersonalBest).toBe(false)
    expect(comparison.testsSoFar).toBe(0)
  })

  it('is not a personal best on the very first test at a configuration', () => {
    // Nothing to beat is not the same as having beaten something.
    const comparison = compare(
      [test('other', 90, 1, { config: config({ punctuation: true }) })],
      { wpm: 20, config: config(), inputSource: 'physical' },
      NOW,
    )

    expect(comparison.isPersonalBest).toBe(false)
  })

  it('does not count a tie as a record', () => {
    const comparison = compare(
      [test('a', 80, 1)],
      { wpm: 80, config: config(), inputSource: 'physical' },
      NOW,
    )

    expect(comparison.isPersonalBest).toBe(false)
  })
})

describe('scale', () => {
  it('builds history from 500 tests in well under 100ms', () => {
    const tests = Array.from({ length: 500 }, (_value, i) =>
      test(`t${String(i)}`, 40 + (i % 60), i % 120, {
        config: config({ punctuation: i % 3 === 0 }),
        inputSource: i % 17 === 0 ? 'virtual' : 'physical',
      }),
    )

    const started = performance.now()
    const rows = buildHistory(tests)
    const comparison = compare(
      tests,
      { wpm: 90, config: config(), inputSource: 'physical' },
      NOW,
    )
    const elapsed = performance.now() - started

    expect(rows).toHaveLength(500)
    expect(comparison.medianWpm).not.toBeNull()
    expect(elapsed).toBeLessThan(100)
  })
})
