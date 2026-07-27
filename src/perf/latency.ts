import { PERFORMANCE_BUDGET } from './budget'

/**
 * Keydown to paint, measured in the browser.
 *
 * The `event` entry type reports `processingStart`, `processingEnd` and
 * `duration` for discrete input, where duration runs from the hardware
 * timestamp to the next paint after the handler. That is the number
 * ARCHITECTURE.md 10 budgets at 8ms p95, and it is the one users feel.
 *
 * Nothing here runs on the keystroke path. PerformanceObserver delivers entries
 * in its own task, after the frame it measured has already shipped.
 */

export type Percentiles = {
  readonly p50: number
  readonly p95: number
  readonly p99: number
  readonly max: number
}

export type LatencyReport = {
  readonly count: number
  /**
   * Keydown to the next paint, from Event Timing's `duration`.
   *
   * Quantised to 8ms by the specification and bounded below by the display's
   * frame interval, so on a 60Hz screen the only values a correct app can
   * report are 8 and 16. It is what the user feels; it is not a measure of how
   * much work this code did.
   */
  readonly paint: Percentiles
  /**
   * processingEnd - processingStart: the handler itself. Every millisecond here
   * is ours, and this is the number to optimise against.
   */
  readonly processing: Percentiles
  readonly overBudget: number
  readonly budgetMs: number
}

const NO_PERCENTILES: Percentiles = { p50: 0, p95: 0, p99: 0, max: 0 }

const EMPTY: LatencyReport = {
  count: 0,
  paint: NO_PERCENTILES,
  processing: NO_PERCENTILES,
  overBudget: 0,
  budgetMs: PERFORMANCE_BUDGET.keydownToPaintP95Ms,
}

/** Nearest-rank percentile over a sorted array. */
export function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) {
    return 0
  }

  const rank = Math.ceil(fraction * sorted.length)
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1))

  return sorted[index] ?? 0
}

function percentiles(values: readonly number[]): Percentiles {
  const sorted = [...values].sort((a, b) => a - b)

  return {
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: sorted[sorted.length - 1] ?? 0,
  }
}

export type LatencySample = {
  readonly paintMs: number
  readonly processingMs: number
}

export function summarise(samples: readonly LatencySample[], budgetMs: number): LatencyReport {
  if (samples.length === 0) {
    return { ...EMPTY, budgetMs }
  }

  const processing = samples.map((sample) => sample.processingMs)

  return {
    count: samples.length,
    paint: percentiles(samples.map((sample) => sample.paintMs)),
    processing: percentiles(processing),
    overBudget: processing.filter((value) => value > budgetMs).length,
    budgetMs,
  }
}

export type LatencyMonitor = {
  readonly report: () => LatencyReport
  readonly reset: () => void
  readonly stop: () => void
}

const NOOP_MONITOR: LatencyMonitor = {
  report: () => EMPTY,
  reset: () => undefined,
  stop: () => undefined,
}

type EventTimingEntry = PerformanceEntry & {
  readonly processingStart: number
  readonly processingEnd: number
}

/**
 * Starts observing keydown latency. Returns a monitor that is safe to call from
 * a console, and a no-op where PerformanceObserver or the event timing entry
 * type is unavailable.
 */
export function startLatencyMonitor(
  budgetMs: number = PERFORMANCE_BUDGET.keydownToPaintP95Ms,
): LatencyMonitor {
  const supported =
    typeof PerformanceObserver !== 'undefined' &&
    PerformanceObserver.supportedEntryTypes.includes('event')

  if (!supported) {
    return NOOP_MONITOR
  }

  let samples: LatencySample[] = []

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as EventTimingEntry[]) {
      if (entry.name === 'keydown') {
        samples.push({
          paintMs: entry.duration,
          processingMs: entry.processingEnd - entry.processingStart,
        })
      }
    }
  })

  // durationThreshold 0 asks for every event, not just the slow ones. Without it
  // the browser reports only entries over 104ms and a fast app looks like it has
  // no input at all. The cast is because lib.dom has not caught up with the
  // Event Timing spec.
  observer.observe({
    type: 'event',
    buffered: true,
    durationThreshold: 0,
  } as PerformanceObserverInit)

  return {
    report: () => summarise(samples, budgetMs),
    reset: () => {
      samples = []
    },
    stop: () => {
      observer.disconnect()
    },
  }
}

declare global {
  interface Window {
    cruduLatency?: LatencyMonitor
  }
}

/** Exposes the monitor on window in dev, so a trace can be read without a UI. */
export function exposeLatencyMonitor(monitor: LatencyMonitor): void {
  window.cruduLatency = monitor
}
