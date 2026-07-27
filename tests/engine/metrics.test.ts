import { describe, expect, it } from 'vitest'

import {
  accuracy,
  bigramLatencies,
  computeMetrics,
  consistency,
  countChars,
  netWpm,
  rawWpm,
  wpmSeries,
} from '../../src/engine'
import type { Keystroke } from '../../src/engine'

/** SPEC 6. Every metric is computed from the log and one duration, nothing else. */

type Overrides = Partial<Omit<Keystroke, 'kind'>>

function entry(kind: Keystroke['kind'], overrides: Overrides = {}): Keystroke {
  return { kind, c: '', e: '', t: 0, ok: false, repeat: false, pauses: 0, ...overrides }
}

const correct = (c: string, t: number, extra: Overrides = {}): Keystroke =>
  entry('char', { c, e: c, t, ok: true, ...extra })

const wrong = (c: string, e: string, t: number): Keystroke => entry('char', { c, e, t })

const extraChar = (c: string, t: number): Keystroke => entry('char', { c, e: '', t })

const missed = (e: string, t: number): Keystroke => entry('missed', { e, t })

const backspace = (t: number): Keystroke => entry('backspace', { t })

/** `n` correct characters spaced `step` ms apart, starting at `from`. */
function run(n: number, from: number, step: number, char = 'a'): Keystroke[] {
  return Array.from({ length: n }, (_value, i) => correct(char, from + i * step))
}

describe('rule 6: character counts', () => {
  it('separates correct, incorrect, extra and missed', () => {
    const log = [correct('h', 0), wrong('z', 'e', 100), extraChar('x', 200), missed('o', 300)]

    expect(countChars(log)).toEqual({ correct: 1, incorrect: 1, extra: 1, missed: 1 })
  })

  it('counts no edit as any kind of character', () => {
    expect(countChars([backspace(0), correct('a', 100)])).toEqual({
      correct: 1,
      incorrect: 0,
      extra: 0,
      missed: 0,
    })
  })
})

describe('rule 6: net WPM is correct characters including correct spaces', () => {
  it('divides by five and by minutes', () => {
    // 50 correct characters in 30 seconds: 10 words in half a minute.
    expect(netWpm(run(50, 0, 500), 30_000)).toBe(20)
  })

  it('counts a correct space as a correct character', () => {
    const log = [correct('h', 0), correct('i', 100), correct(' ', 200)]

    expect(netWpm(log, 60_000)).toBeCloseTo(0.6, 10)
  })

  it('excludes an incorrect space', () => {
    const log = [correct('h', 0), correct('i', 100), wrong(' ', ' ', 200)]

    expect(netWpm(log, 60_000)).toBeCloseTo(0.4, 10)
  })

  it('reports zero rather than dividing by a zero duration', () => {
    expect(netWpm(run(5, 0, 10), 0)).toBe(0)
    expect(rawWpm(run(5, 0, 10), 0)).toBe(0)
  })
})

describe('rule 6: raw WPM is everything typed', () => {
  it('includes incorrect and extra characters', () => {
    const log = [correct('a', 0), wrong('z', 'b', 100), extraChar('x', 200)]

    expect(rawWpm(log, 60_000)).toBeCloseTo(0.6, 10)
  })

  it('excludes missed characters, because the user never typed them', () => {
    const log = [correct('a', 0), missed('b', 100), missed('c', 100)]

    expect(rawWpm(log, 60_000)).toBeCloseTo(0.2, 10)
    expect(netWpm(log, 60_000)).toBeCloseTo(0.2, 10)
  })
})

describe('rule 6: accuracy is measured at the moment of the keypress', () => {
  it('counts a corrected error against you', () => {
    const log = [wrong('z', 'h', 0), backspace(100), correct('h', 200)]

    expect(accuracy(log)).toBe(50)
  })

  it('counts missed characters against you', () => {
    const log = [correct('h', 0), missed('i', 100)]

    expect(accuracy(log)).toBe(50)
  })

  it('counts extra characters against you', () => {
    const log = [correct('h', 0), extraChar('x', 100)]

    expect(accuracy(log)).toBe(50)
  })

  it('is 100 when nothing was typed, because nothing was got wrong', () => {
    expect(accuracy([])).toBe(100)
    expect(accuracy([backspace(0)])).toBe(100)
  })
})

describe('rule 6: consistency over per-second raw WPM samples', () => {
  it('reports 100 when every second is identical', () => {
    // Four seconds of six characters each: 72 raw WPM every time.
    const log = [...run(6, 0, 100), ...run(6, 1_000, 100), ...run(6, 2_000, 100)]

    expect(consistency(log)).toBe(100)
  })

  it('computes 100 * (1 - stddev/mean) with a population deviation', () => {
    // Samples 144, 72, 72, 72. Mean 90, variance 972, deviation sqrt(972).
    const log = [
      ...run(12, 0, 50),
      ...run(6, 1_000, 100),
      ...run(6, 2_000, 100),
      ...run(6, 3_000, 100),
    ]

    expect(consistency(log)).toBeCloseTo(100 * (1 - Math.sqrt(972) / 90), 10)
    expect(consistency(log)).toBeCloseTo(65.358_98, 4)
  })

  it('drops the seconds a gap longer than one second overlaps', () => {
    // The same shape, except the first burst is followed by a 2450ms pause. Its
    // second is discarded, leaving three identical seconds and no variance.
    const log = [
      ...run(12, 0, 50),
      ...run(6, 3_000, 100),
      ...run(6, 4_000, 100),
      ...run(6, 5_000, 100),
    ]

    expect(consistency(log)).toBe(100)
  })

  it('reports 100 with fewer than two samples', () => {
    expect(consistency([])).toBe(100)
    expect(consistency(run(4, 0, 100))).toBe(100)
  })

  it('clamps a wildly bursty test at zero rather than going negative', () => {
    const log = [
      correct('a', 0),
      correct('a', 1_000),
      correct('a', 2_000),
      ...run(20, 3_000, 50),
    ]

    expect(consistency(log)).toBe(0)
  })
})

describe('rule 6: bigram latency', () => {
  it('is the interval between two adjacent correct keystrokes', () => {
    const log = [correct('o', 0), correct('l', 180)]

    expect(bigramLatencies(log, 'physical')).toEqual([{ pair: 'ol', latencyMs: 180 }])
  })

  it('includes the space, which is a transition like any other', () => {
    const log = [correct('e', 0), correct(' ', 120), correct('t', 250)]

    expect(bigramLatencies(log, 'physical').map((sample) => sample.pair)).toEqual(['e ', ' t'])
  })

  it('discards a pair where either keystroke was wrong', () => {
    const log = [correct('o', 0), wrong('k', 'l', 180), correct('d', 320)]

    expect(bigramLatencies(log, 'physical')).toEqual([])
  })

  it('discards a pair where either keystroke was a repeat', () => {
    const log = [correct('o', 0), correct('l', 180, { repeat: true }), correct('d', 320)]

    expect(bigramLatencies(log, 'physical')).toEqual([])
  })

  it('discards a pair separated by more than a second', () => {
    const log = [correct('o', 0), correct('l', 1_001)]

    expect(bigramLatencies(log, 'physical')).toEqual([])
  })

  it('keeps a pair separated by exactly a second', () => {
    expect(bigramLatencies([correct('o', 0), correct('l', 1_000)], 'physical')).toHaveLength(1)
  })

  it('discards a pair interrupted by a backspace', () => {
    const log = [correct('o', 0), backspace(50), correct('l', 180)]

    expect(bigramLatencies(log, 'physical')).toEqual([])
  })

  it('discards a pair interrupted by a batch of missed characters', () => {
    const log = [correct(' ', 0), missed('l', 0), correct('t', 120)]

    expect(bigramLatencies(log, 'physical')).toEqual([])
  })

  it('discards a pair that spans a pause', () => {
    const log = [correct('o', 0), correct('l', 30, { pauses: 1 })]

    expect(bigramLatencies(log, 'physical')).toEqual([])
  })

  it('returns nothing at all for a test typed on a virtual keyboard', () => {
    const log = [correct('o', 0), correct('l', 180), correct('d', 320)]

    expect(bigramLatencies(log, 'physical')).toHaveLength(2)
    expect(bigramLatencies(log, 'virtual')).toEqual([])
  })

  it('forms no pair from a single keystroke', () => {
    expect(bigramLatencies([correct('o', 0)], 'physical')).toEqual([])
  })
})

describe('the WPM curve the results graph draws', () => {
  it('reports net WPM for every second from the first keystroke to the last', () => {
    // Six correct in second 0, three in second 2, none in second 1.
    const log = [...run(6, 0, 100), ...run(3, 2_000, 100)]

    expect(wpmSeries(log)).toEqual([
      { second: 0, wpm: 72, hadError: false },
      { second: 1, wpm: 0, hadError: false },
      { second: 2, wpm: 36, hadError: false },
    ])
  })

  it('keeps an empty second rather than closing the gap', () => {
    // A line that skipped the pause would flatter a test the user walked away
    // from. The graph shows the gap because the gap happened.
    expect(wpmSeries([correct('a', 0), correct('b', 5_000)])).toHaveLength(6)
  })

  it('flags the seconds something was got wrong', () => {
    const log = [correct('a', 0), wrong('z', 'b', 100), correct('c', 1_100)]
    const series = wpmSeries(log)

    expect(series[0]?.hadError).toBe(true)
    expect(series[1]?.hadError).toBe(false)
  })

  it('counts only correct characters, so the curve is net rather than raw', () => {
    const log = [correct('a', 0), wrong('z', 'b', 100), extraChar('x', 200)]

    expect(wpmSeries(log)[0]?.wpm).toBe(12)
  })

  it('is empty for a log with no characters in it', () => {
    expect(wpmSeries([])).toEqual([])
    expect(wpmSeries([backspace(0)])).toEqual([])
  })
})

describe('computeMetrics assembles the five figures', () => {
  it('reports every metric from one log and one duration', () => {
    const log = [correct('h', 0), correct('i', 200), wrong('z', ' ', 400), missed('x', 400)]

    expect(computeMetrics(log, 60_000)).toEqual({
      wpm: 0.4,
      raw: 0.6,
      accuracy: 50,
      consistency: 100,
      chars: { correct: 2, incorrect: 1, extra: 0, missed: 1 },
    })
  })
})
