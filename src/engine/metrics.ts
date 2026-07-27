import {
  CHARS_PER_WORD,
  CONSISTENCY_SAMPLE_MS,
  MIN_CONSISTENCY_SAMPLES,
  PAUSE_THRESHOLD_MS,
} from './constants'
import type { BigramSample, CharCounts, InputSource, Keystroke, Metrics } from './types'

/**
 * Every metric, computed from the keystroke log and one duration.
 *
 * Nothing here reads word state. The log is the source of truth, aggregates are
 * not reversible, and anything derivable from the log stays derivable — which is
 * what makes the WPM curve, the per-key stats and the bigram table all fall out
 * of one array. See ARCHITECTURE.md 6.1 and docs/SPEC.md 6.
 */

const PERCENT = 100

function charEntries(log: readonly Keystroke[]): Keystroke[] {
  return log.filter((entry) => entry.kind === 'char')
}

export function countChars(log: readonly Keystroke[]): CharCounts {
  let correct = 0
  let incorrect = 0
  let extra = 0
  let missed = 0

  for (const entry of log) {
    if (entry.kind === 'missed') {
      missed += 1
      continue
    }

    if (entry.kind !== 'char') {
      continue
    }

    if (entry.ok) {
      correct += 1
      continue
    }

    // An entry with no expected character is one typed past the end of the word.
    if (entry.e === '') {
      extra += 1
      continue
    }

    incorrect += 1
  }

  return { correct, incorrect, extra, missed }
}

function perMinute(characters: number, duration: number): number {
  if (duration <= 0) {
    return 0
  }

  return characters / CHARS_PER_WORD / (duration / 60_000)
}

/** Correct characters, including correct spaces, per five characters per minute. */
export function netWpm(log: readonly Keystroke[], durationMs: number): number {
  return perMinute(countChars(log).correct, durationMs)
}

/**
 * Every character typed. Missed characters are excluded: the user never typed
 * them, so they cannot contribute to a measure of how much was typed.
 */
export function rawWpm(log: readonly Keystroke[], durationMs: number): number {
  const { correct, incorrect, extra } = countChars(log)

  return perMinute(correct + incorrect + extra, durationMs)
}

/**
 * Correct keypresses over total keypresses, measured at the moment of the
 * keypress. A corrected error still counts: the entry that recorded it is still
 * in the log, and backspacing does not remove it.
 */
export function accuracy(log: readonly Keystroke[]): number {
  const { correct, incorrect, extra, missed } = countChars(log)
  const total = correct + incorrect + extra + missed

  if (total === 0) {
    return PERCENT
  }

  return (correct / total) * PERCENT
}

/** Spans of test time in which the user paused rather than slowed down. */
function gapWindows(chars: readonly Keystroke[]): ReadonlyArray<readonly [number, number]> {
  const windows: Array<readonly [number, number]> = []
  let previous: Keystroke | null = null

  for (const current of chars) {
    if (previous !== null && current.t - previous.t > PAUSE_THRESHOLD_MS) {
      windows.push([previous.t, current.t])
    }

    previous = current
  }

  return windows
}

/**
 * 100 * (1 - stddev/mean) over per-second raw WPM samples.
 *
 * A second is sampled when it holds at least one character and is not overlapped
 * by a gap longer than a second. Population standard deviation, because these
 * are all the seconds there were rather than a sample of a larger set. Fewer
 * than two samples has no variance to measure and reports 100.
 */
export function consistency(log: readonly Keystroke[]): number {
  const chars = charEntries(log)
  const windows = gapWindows(chars)
  const buckets = new Map<number, number>()

  for (const entry of chars) {
    const bucket = Math.floor(entry.t / CONSISTENCY_SAMPLE_MS)

    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1)
  }

  const samples: number[] = []

  for (const [bucket, count] of buckets) {
    const start = bucket * CONSISTENCY_SAMPLE_MS
    const end = start + CONSISTENCY_SAMPLE_MS
    const overlapped = windows.some(([from, to]) => from < end && to > start)

    if (!overlapped) {
      samples.push((count / CHARS_PER_WORD) * (60_000 / CONSISTENCY_SAMPLE_MS))
    }
  }

  if (samples.length < MIN_CONSISTENCY_SAMPLES) {
    return PERCENT
  }

  const mean = samples.reduce((total, value) => total + value, 0) / samples.length
  const variance =
    samples.reduce((total, value) => total + (value - mean) ** 2, 0) / samples.length
  const deviation = Math.sqrt(variance)

  return Math.min(PERCENT, Math.max(0, PERCENT * (1 - deviation / mean)))
}

/**
 * keydown(n) - keydown(n-1) over pairs adjacent in the log.
 *
 * Anything between two characters — a backspace, a delete-word, a batch of
 * missed characters — means there is no pair, because the user did something
 * else in between and the interval no longer describes a transition.
 */
export function bigramLatencies(
  log: readonly Keystroke[],
  inputSource: InputSource,
): readonly BigramSample[] {
  // SPEC 1.7. Thumb-typing latency does not describe touch-typing weakness, and
  // feeding it into the bigram table would corrupt the adaptive model.
  if (inputSource === 'virtual') {
    return []
  }

  const samples: BigramSample[] = []
  let previous: Keystroke | null = null

  for (const current of log) {
    const before = previous

    previous = current

    if (before === null) {
      continue
    }

    if (before.kind !== 'char' || current.kind !== 'char') {
      continue
    }

    if (!before.ok || !current.ok) {
      continue
    }

    // A held key produces meaningless latency on whichever side it falls.
    if (before.repeat || current.repeat) {
      continue
    }

    // Paused time is already subtracted from t, so a pair straddling a blur
    // would otherwise read as impossibly fast.
    if (before.pauses !== current.pauses) {
      continue
    }

    const latencyMs = current.t - before.t

    if (latencyMs > PAUSE_THRESHOLD_MS) {
      continue
    }

    samples.push({ pair: before.c + current.c, latencyMs })
  }

  return samples
}

export type SecondSample = {
  /** Whole seconds since the first keystroke. */
  readonly second: number
  /** Net WPM within that second: correct characters, over five, per minute. */
  readonly wpm: number
  /** Whether anything was got wrong in that second. Drawn as a baseline tick. */
  readonly hadError: boolean
}

/**
 * The WPM curve the results graph draws.
 *
 * Every second from the first keystroke to the last is present, including the
 * ones with nothing in them: a gap drawn as a gap is the truth, and a line that
 * skips it would flatter a test the user walked away from.
 */
export function wpmSeries(log: readonly Keystroke[]): readonly SecondSample[] {
  const chars = charEntries(log)
  const last = chars.at(-1)

  if (last === undefined) {
    return []
  }

  const total = Math.floor(last.t / CONSISTENCY_SAMPLE_MS) + 1
  const correct = new Map<number, number>()
  const errored = new Set<number>()

  for (const entry of chars) {
    const second = Math.floor(entry.t / CONSISTENCY_SAMPLE_MS)

    if (entry.ok) {
      correct.set(second, (correct.get(second) ?? 0) + 1)
    } else {
      errored.add(second)
    }
  }

  return Array.from({ length: total }, (_value, second) => ({
    second,
    wpm: ((correct.get(second) ?? 0) / CHARS_PER_WORD) * (60_000 / CONSISTENCY_SAMPLE_MS),
    hadError: errored.has(second),
  }))
}

export function computeMetrics(log: readonly Keystroke[], durationMs: number): Metrics {
  const chars = countChars(log)

  return {
    wpm: perMinute(chars.correct, durationMs),
    raw: perMinute(chars.correct + chars.incorrect + chars.extra, durationMs),
    accuracy: accuracy(log),
    consistency: consistency(log),
    chars,
  }
}
