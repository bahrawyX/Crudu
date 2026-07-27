import { createStore, del, get, getMany, keys, set } from 'idb-keyval'

import type { InputSource, Metrics, TestConfig, TestResult } from '../engine'

import type { PackedLog } from './pack'
import { packLog, unpackLog } from './pack'
import { LOG_RETENTION_DAYS, SCHEMA_VERSION, metaKey, parseKey, testKey } from './schema'

/**
 * Test history in IndexedDB.
 *
 * Keys mirror the schema in ARCHITECTURE.md 6.3 exactly — `test:{id}`,
 * `key:{char}`, `bigram:{pair}`, `meta:*` — so that moving to Postgres is a sync
 * script that reads local records and INSERTs them, rather than a rewrite.
 *
 * Nothing here is called during a test. IndexedDB is asynchronous, but the
 * packing that precedes it is not, and a few hundred microseconds of packing on
 * the keystroke path is still a few hundred microseconds too many.
 */

const store = createStore('crudu', 'store')

export type StoredTest = {
  readonly id: string
  readonly startedAt: number
  readonly config: TestConfig
  readonly inputSource: InputSource
  readonly derived: Metrics
  /** null once the log has aged past the retention window. */
  readonly log: PackedLog | null
}

export type SaveOutcome = 'saved' | 'quota-exceeded' | 'failed'

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  // Firefox reports NS_ERROR_DOM_QUOTA_REACHED, Safari a bare QuotaExceededError,
  // Chromium a DOMException with code 22.
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    (error instanceof DOMException && error.code === 22)
  )
}

export async function saveTest(result: TestResult): Promise<SaveOutcome> {
  const record: StoredTest = {
    id: result.id,
    startedAt: result.startedAt,
    config: result.config,
    inputSource: result.inputSource,
    derived: result.derived,
    log: packLog(result.keystrokes),
  }

  try {
    await set(testKey(result.id), record, store)
    await set(metaKey('schemaVersion'), SCHEMA_VERSION, store)

    return 'saved'
  } catch (error) {
    // A failed write must never interrupt anything. The results are already on
    // screen and the history that existed a moment ago still exists.
    return isQuotaError(error) ? 'quota-exceeded' : 'failed'
  }
}

export async function loadTests(): Promise<readonly StoredTest[]> {
  try {
    const all = await keys(store)
    const testKeys = all.filter(
      (key): key is string => typeof key === 'string' && parseKey(key)?.namespace === 'test',
    )

    if (testKeys.length === 0) {
      return []
    }

    const records = await getMany<StoredTest | undefined>(testKeys, store)

    return records
      .filter((record): record is StoredTest => record !== undefined)
      .sort((a, b) => b.startedAt - a.startedAt)
  } catch {
    return []
  }
}

export async function loadKeystrokes(id: string): Promise<ReturnType<typeof unpackLog> | null> {
  try {
    const record = await get<StoredTest>(testKey(id), store)

    return record?.log == null ? null : unpackLog(record.log)
  } catch {
    return null
  }
}

export type PruneReport = {
  readonly logsDropped: number
  readonly testsKept: number
}

/**
 * ARCHITECTURE.md 6.2: full keystroke logs are kept for the retention window,
 * derived metrics forever. The record stays and stops carrying its log, so
 * history and personal bests are unaffected and only replay is lost.
 */
export async function pruneLogs(
  now: number,
  retentionDays: number = LOG_RETENTION_DAYS,
): Promise<PruneReport> {
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000
  const tests = await loadTests()
  let logsDropped = 0

  for (const test of tests) {
    if (test.log !== null && test.startedAt < cutoff) {
      await set(testKey(test.id), { ...test, log: null }, store)
      logsDropped += 1
    }
  }

  await set(metaKey('lastPrunedAt'), now, store)

  return { logsDropped, testsKept: tests.length }
}

export async function readMeta<T>(name: string): Promise<T | undefined> {
  return get<T>(metaKey(name), store)
}

export async function writeMeta(name: string, value: unknown): Promise<void> {
  await set(metaKey(name), value, store)
}

/** Test seam. Clears every record this module owns. */
export async function clearAll(): Promise<void> {
  for (const key of await keys(store)) {
    await del(key, store)
  }
}
