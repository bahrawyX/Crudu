import { describe, expect, it } from 'vitest'

import { createEngine } from '../../src/engine'
import type { Engine, KeyInput } from '../../src/engine'

import { cyclingWords, press, timeConfig } from './helpers'

/**
 * One fixed 50-character sequence with fixed timestamps, against values worked
 * out by hand below rather than read off the implementation.
 *
 * If a metric changes, this fails, and the arithmetic here says what the answer
 * should have been.
 */

// Ten four-letter words. The user types all ten, plus a space after each, which
// is 40 letters + 10 spaces = 50 keystrokes exactly.
const WORDS = [
  'that',
  'with',
  'have',
  'this',
  'from',
  'they',
  'been',
  'more',
  'were',
  'when',
] as const

// Two deliberate errors, both at index 1 of their word: 'have' typed 'hzve',
// 'been' typed 'bxen'.
const MISTYPED = new Map<number, string>([
  [2, 'hzve'],
  [6, 'bxen'],
])

/**
 * Timing. The first 25 keystrokes land 150ms apart from t = 0, the last 25 land
 * 250ms apart. Raw timestamps are offset by 1000 to prove that t is measured
 * from the first keystroke rather than from zero.
 */
const ORIGIN = 1_000
const FAST_COUNT = 25
const FAST_STEP = 150
const SLOW_STEP = 250

function timeOf(index: number): number {
  if (index < FAST_COUNT) {
    return index * FAST_STEP
  }

  return (FAST_COUNT - 1) * FAST_STEP + (index - FAST_COUNT + 1) * SLOW_STEP
}

function sequence(): readonly KeyInput[] {
  const inputs: KeyInput[] = []

  WORDS.forEach((word, wordIndex) => {
    const typed = MISTYPED.get(wordIndex) ?? word

    for (const char of `${typed} `) {
      inputs.push(press(char, ORIGIN + timeOf(inputs.length)))
    }
  })

  return inputs
}

function run(): Engine {
  const engine = createEngine({
    config: timeConfig(10),
    wordSource: cyclingWords(['aaaa'], WORDS),
    id: 'golden',
    startedAt: 0,
  })

  for (const input of sequence()) {
    engine.input(input)
  }

  // The clock runs out one keystroke after the last one landed.
  engine.tick(ORIGIN + 10_000)

  return engine
}

describe('a known 50-character sequence with known timestamps', () => {
  const engine = run()
  const result = engine.getResult()

  it('produces exactly fifty character keystrokes', () => {
    expect(sequence()).toHaveLength(50)
    expect(engine.getState().log.filter((entry) => entry.kind === 'char')).toHaveLength(50)
  })

  it('runs the last keystroke at t = 9850 and completes at 10000', () => {
    expect(timeOf(49)).toBe(9_850)
    expect(engine.getState().status).toBe('complete')
  })

  /*
   * Character counts, by hand.
   *
   *   40 letters typed, of which 2 are wrong          -> 38 correct, 2 incorrect
   *   10 spaces typed, of which 2 terminate a word
   *   that was not exactly right                      ->  8 correct, 2 incorrect
   *   nothing typed past a word end                   ->  0 extra
   *   every word fully typed before its space         ->  0 missed
   *
   *   correct = 38 + 8 = 46,  incorrect = 2 + 2 = 4,  total = 50
   */
  it('counts 46 correct and 4 incorrect characters', () => {
    expect(result?.derived.chars).toEqual({
      correct: 46,
      incorrect: 4,
      extra: 0,
      missed: 0,
    })
  })

  /*
   * accuracy = correct / (correct + incorrect + extra + missed)
   *          = 46 / 50 = 0.92 -> 92%
   */
  it('reports 92% accuracy', () => {
    expect(result?.derived.accuracy).toBe(92)
  })

  /*
   * Time mode, so the duration is the configured 10 seconds = 1/6 minute.
   *
   *   net WPM = 46 / 5 / (1/6) = 9.2 * 6  = 55.2
   *   raw WPM = 50 / 5 / (1/6) = 10  * 6  = 60
   */
  it('reports 55.2 net WPM and 60 raw WPM', () => {
    expect(result?.derived.wpm).toBeCloseTo(55.2, 10)
    expect(result?.derived.raw).toBe(60)
  })

  /*
   * Consistency. Keystrokes fall into ten one-second buckets:
   *
   *   fast phase, t = 0,150,...,3600      slow phase, t = 3850,4100,...,9850
   *   bucket 0 (   0- 999): 7             bucket 3: 1   (3850)
   *   bucket 1 (1000-1999): 7             bucket 4: 4
   *   bucket 2 (2000-2999): 6             bucket 5: 4
   *   bucket 3 (3000-3999): 5             bucket 6: 4
   *                                       bucket 7: 4
   *                                       bucket 8: 4
   *                                       bucket 9: 4
   *
   *   combined: 7, 7, 6, 6, 4, 4, 4, 4, 4, 4   (sums to 50)
   *
   * No gap exceeds 1000ms, so every bucket is sampled. Sample value is
   * chars / 5 * 60 = chars * 12:
   *
   *   84, 84, 72, 72, 48, 48, 48, 48, 48, 48
   *
   *   mean     = 600 / 10 = 60
   *   variance = (24^2*2 + 12^2*2 + 12^2*6) / 10
   *            = (1152 + 288 + 864) / 10 = 230.4
   *   stddev   = sqrt(230.4) = 15.178932...
   *
   *   consistency = 100 * (1 - 15.178932 / 60) = 74.70178...
   */
  it('reports 74.70178 consistency', () => {
    expect(result?.derived.consistency).toBeCloseTo(74.701_78, 4)
  })

  /*
   * Bigrams. 49 adjacent pairs. The four keystrokes that are not ok sit at log
   * indices 11 and 14 (word 'have') and 31 and 34 (word 'been'). Each kills the
   * pair it opens and the pair it closes:
   *
   *   pairs ending at   11, 14, 31, 34  -> 4 dropped
   *   pairs starting at 11, 14, 31, 34  -> 4 dropped, at indices 12, 15, 32, 35
   *
   *   49 - 8 = 41 kept
   */
  it('keeps 41 of the 49 adjacent pairs', () => {
    const bigrams = engine.getBigrams()

    expect(bigrams).toHaveLength(41)
    expect(bigrams.every((sample) => sample.latencyMs <= 250)).toBe(true)
  })

  it('labels the first pair from the first two characters typed', () => {
    expect(engine.getBigrams()[0]).toEqual({ pair: 'th', latencyMs: 150 })
  })

  it('measures the boundary transition into the second word', () => {
    // 'that' then a space, so 't ' at the fast 150ms step.
    expect(engine.getBigrams().find((sample) => sample.pair === 't ')).toEqual({
      pair: 't ',
      latencyMs: 150,
    })
  })
})
