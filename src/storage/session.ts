import type { TestResult } from '../engine'

import type { SaveOutcome } from './db'
import { pruneLogs, readMeta, saveTest, writeMeta } from './db'

/**
 * When persistence happens, which matters more than how.
 *
 * ARCHITECTURE.md 4.2: never write to storage during a test. The keystrokes sit
 * in memory for the whole run and go to disk exactly once, after the results
 * screen has already painted, inside an idle callback. A user who restarts
 * immediately never waits for it.
 */

/** requestIdleCallback is still unimplemented in Safari. */
function whenIdle(callback: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(callback, { timeout: 2_000 })

    return
  }

  setTimeout(callback, 0)
}

/**
 * Queues the write. Resolves with what happened, so the caller can surface a
 * quota failure without ever blocking on the success case.
 */
export function persistResult(result: TestResult): Promise<SaveOutcome> {
  return new Promise((resolve) => {
    whenIdle(() => {
      void saveTest(result).then(resolve)
    })
  })
}

const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000

/**
 * Prunes at most once a day, on boot, off the critical path.
 *
 * Retention is a one-line config now and a migration later, which is the whole
 * reason it exists from day one rather than from the day the quota fills.
 */
export function pruneOnBoot(now: number): void {
  whenIdle(() => {
    void (async () => {
      const last = await readMeta<number>('lastPrunedAt')

      if (typeof last === 'number' && now - last < PRUNE_INTERVAL_MS) {
        return
      }

      await pruneLogs(now)
      await writeMeta('lastPrunedAt', now)
    })()
  })
}
