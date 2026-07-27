import { ACCURACY_GATE, CALIBRATION_TESTS, RECENT_TESTS_FOR_GATE } from './params'

/**
 * The accuracy gate, and the cold start.
 *
 * ARCHITECTURE.md 8.2 step 6: difficulty escalates only when the last three
 * tests each cleared 96%. An error costs roughly a full second once noticing,
 * backspacing, retyping and re-finding your place are counted, so someone at
 * 95% is losing more time to correction than they would lose by slowing down.
 * Chasing raw WPM at low accuracy is the most common way people waste months,
 * and the product must refuse to reward it.
 */

export type GateState = {
  readonly open: boolean
  /** How many of the last three cleared the threshold. */
  readonly cleared: number
  readonly required: number
}

export function accuracyGate(
  recentAccuracies: readonly number[],
  threshold: number = ACCURACY_GATE * 100,
  window: number = RECENT_TESTS_FOR_GATE,
): GateState {
  const recent = recentAccuracies.slice(0, window)
  const cleared = recent.filter((accuracy) => accuracy >= threshold).length

  return {
    open: recent.length >= window && cleared === window,
    cleared,
    required: window,
  }
}

export type Calibration = {
  readonly calibrating: boolean
  readonly remaining: number
  /** The exact line docs/DESIGN.md 3.4 puts on the results card. */
  readonly copy: string
}

/**
 * ARCHITECTURE.md 8.2 step 1: the first three tests run plain common-word
 * English. A bigram needs eight samples before its EWMA means anything, and
 * generating drills from noise would make the app feel arbitrary exactly when a
 * new user is deciding whether it works.
 *
 * The remaining count is shown honestly rather than hidden.
 */
export function calibration(
  testsCompleted: number,
  required: number = CALIBRATION_TESTS,
): Calibration {
  const remaining = Math.max(0, required - testsCompleted)

  if (remaining === 0) {
    return { calibrating: false, remaining: 0, copy: '' }
  }

  const count = remaining === 1 ? 'One more test' : 'Two more tests'

  return {
    calibrating: true,
    remaining,
    copy: `Calibrating. ${count} before drills unlock.`,
  }
}
