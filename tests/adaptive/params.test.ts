import { describe, expect, it } from 'vitest'

import {
  ACCURACY_GATE,
  CALIBRATION_TESTS,
  COMMON_WORD_DILUTION,
  ERROR_RATE_WEIGHT,
  EWMA_ALPHA,
  MAX_WORD_REPEATS,
  MIN_BIGRAM_SAMPLES,
  RECENT_TESTS_FOR_GATE,
  RETIREMENT_APPEARANCES,
  SCORE_EXPONENT,
  TARGET_SET_SIZE,
} from '../../src/adaptive/params'

/**
 * These are pinned, not sanity checked.
 *
 * Every value below is a decision recorded in ARCHITECTURE.md section 8, and
 * each one is individually plausible to "improve". Lowering the dilution makes
 * drills feel more focused and quietly costs retention; raising the alpha makes
 * the app feel responsive and turns one fumbled keystroke into a weak bigram.
 * Failing this suite is the intended outcome of changing one: it forces the
 * change to be argued in a commit body rather than slipped in.
 */
describe('adaptive tuning parameters match ARCHITECTURE.md section 8', () => {
  it('EWMA alpha is 0.25, roughly a 15 sample memory', () => {
    expect(EWMA_ALPHA).toBe(0.25)
  })

  it('ignores a bigram below 8 samples', () => {
    expect(MIN_BIGRAM_SAMPLES).toBe(8)
  })

  it('holds the target set at 15 bigrams', () => {
    expect(TARGET_SET_SIZE).toBe(15)
  })

  it('retires a bigram after 3 consecutive appearances below the user median', () => {
    expect(RETIREMENT_APPEARANCES).toBe(3)
  })

  it('dilutes generated lists with 35 percent common words', () => {
    expect(COMMON_WORD_DILUTION).toBe(0.35)
  })

  it('samples with probability proportional to score to the 1.5', () => {
    expect(SCORE_EXPONENT).toBe(1.5)
  })

  it('doubles the error rate contribution to weakness', () => {
    expect(ERROR_RATE_WEIGHT).toBe(2)
  })

  it('gates escalation on 96 percent accuracy across the last 3 tests', () => {
    expect(ACCURACY_GATE).toBe(0.96)
    expect(RECENT_TESTS_FOR_GATE).toBe(3)
  })

  it('calibrates over the first 3 tests', () => {
    expect(CALIBRATION_TESTS).toBe(3)
  })

  it('caps a word at 3 appearances per generated list', () => {
    expect(MAX_WORD_REPEATS).toBe(3)
  })
})

describe('parameters are internally consistent', () => {
  it('leaves the majority of a generated list to weakness weighting', () => {
    expect(COMMON_WORD_DILUTION).toBeGreaterThan(0)
    expect(COMMON_WORD_DILUTION).toBeLessThan(0.5)
  })

  it('keeps the accuracy gate a fraction, not a percentage', () => {
    expect(ACCURACY_GATE).toBeGreaterThan(0)
    expect(ACCURACY_GATE).toBeLessThanOrEqual(1)
  })

  it('keeps the EWMA alpha a fraction, not a percentage', () => {
    expect(EWMA_ALPHA).toBeGreaterThan(0)
    expect(EWMA_ALPHA).toBeLessThan(1)
  })
})
