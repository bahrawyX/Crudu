export { aggregate, fromRecords, scorable, toRecords } from './bigrams'
export type { BigramObservation, BigramStat, BigramTable } from './bigrams'

export { accuracyGate, calibration } from './gate'
export type { Calibration, GateState } from './gate'

export { bigramsOf, createDrillSource, scoreWord } from './generator'
export type { DrillOptions, Random } from './generator'

export {
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
} from './params'

export { EMPTY_TARGETS, baselineOf, refreshTargets, scoreAll, weaknessOf } from './weakness'
export type { TargetSet, UserBaseline, WeaknessScore } from './weakness'
