/**
 * Tuning parameters for the adaptive engine, straight from ARCHITECTURE.md
 * section 8.
 *
 * These are the numbers most likely to be "improved" by someone who has not
 * read the reasoning, so each carries it. tests/adaptive/params.test.ts pins
 * every value: changing one fails the suite, which forces the change to be a
 * decision rather than a drift.
 */

/**
 * EWMA smoothing factor for bigram latency. 0.25 gives roughly a 15 sample
 * memory, so recent performance dominates and improvement shows up within a
 * session or two, but one fumbled keystroke does not reclassify a bigram as
 * weak. This is the number to retune once there is real data.
 */
export const EWMA_ALPHA = 0.25

/** A bigram's EWMA means nothing below this many samples. Ignore it entirely. */
export const MIN_BIGRAM_SAMPLES = 8

/** The targeting set is held at this size: always current, always just past comfort. */
export const TARGET_SET_SIZE = 15

/**
 * A targeted bigram retires once its EWMA sits below the user's median across
 * this many consecutive appearances.
 */
export const RETIREMENT_APPEARANCES = 3

/**
 * Fraction of a generated list drawn from the plain top-1000 common words
 * rather than from weakness-weighted sampling.
 *
 * This is not padding. Interleaved practice beats blocked practice on retention
 * in essentially every motor-learning result, and it keeps generated text
 * reading like English rather than like a phonetics exam. Do not lower it to
 * make drills more focused.
 */
export const COMMON_WORD_DILUTION = 0.35

/** Weakness-weighted sampling draws with probability proportional to score^this. */
export const SCORE_EXPONENT = 1.5

/** Error rate multiplier in weakness = max(0, z) * (1 + errorRate * this). */
export const ERROR_RATE_WEIGHT = 2

/**
 * Difficulty escalates only when the last RECENT_TESTS_FOR_GATE tests each
 * cleared this accuracy. An error costs roughly a full second once noticing,
 * backspacing, retyping and re-finding your place are counted, so speed bought
 * with errors is a loss and the product must not reward it.
 */
export const ACCURACY_GATE = 0.96

/** How many recent tests the accuracy gate looks at. */
export const RECENT_TESTS_FOR_GATE = 3

/**
 * Tests run plain common-word English and are labelled calibrating until this
 * many have completed. The remaining count is shown honestly rather than hidden.
 */
export const CALIBRATION_TESTS = 3

/** No single word may appear more than this many times in one generated list. */
export const MAX_WORD_REPEATS = 3
