import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import {
  CALIBRATION_TESTS,
  aggregate,
  calibration,
  createDrillSource,
  fromRecords,
  scoreAll,
  toRecords,
} from './adaptive'
import type { BigramTable } from './adaptive'
import { createEngine } from './engine'
import type { Engine, TestConfig, TestResult } from './engine'
import { ProgressScreen, WeaknessReport } from './components/progress'
import type { ProgressPoint } from './components/progress'
import { ResultsScreen } from './components/results'
import { TestScreen } from './components/test'
import { loadBigrams, loadTests, saveBigrams } from './storage/db'
import type { StoredTest } from './storage/db'
import { buildHistory, compare, median } from './storage/history'
import { persistResult, pruneOnBoot } from './storage/session'
import { activeValue, usePrefsStore } from './stores/prefsStore'
import { useUiStore } from './stores/uiStore'
import { createWordSource } from './words/source'

/**
 * The loop: type, see the result, drill what is slow, go again.
 *
 * The engine lives here rather than inside the test screen, so that finishing a
 * test swaps the screen without tearing the engine down and losing the log the
 * results are made of.
 */

type View = 'test' | 'weakness' | 'progress'

const DAY_MS = 24 * 60 * 60 * 1000
const DATE = new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric' })

/** The seven day rolling median, one point per day that has tests in it. */
function progressPoints(tests: readonly StoredTest[], windowDays: number): readonly ProgressPoint[] {
  const physical = tests.filter((test) => test.inputSource === 'physical')
  const byDay = new Map<number, number[]>()

  for (const test of physical) {
    const day = Math.floor(test.startedAt / DAY_MS)
    const list = byDay.get(day) ?? []

    list.push(test.derived.wpm)
    byDay.set(day, list)
  }

  const days = [...byDay.keys()].sort((a, b) => a - b)

  return days.map((day, index) => {
    const window = days
      .slice(Math.max(0, index - (windowDays - 1)), index + 1)
      .flatMap((each) => byDay.get(each) ?? [])

    return { label: DATE.format(day * DAY_MS), medianWpm: median(window) }
  })
}

export function App() {
  const prefs = usePrefsStore()
  const setStorageError = useUiStore((state) => state.setStorageError)
  const storageError = useUiStore((state) => state.storageError)

  const [tests, setTests] = useState<readonly StoredTest[]>([])
  const [table, setTable] = useState<BigramTable>(() => new Map())
  const [view, setView] = useState<View>('test')
  const persistedId = useRef<string | null>(null)

  const drilling = prefs.adaptive && tests.length >= CALIBRATION_TESTS

  const config = useMemo<TestConfig>(
    () => ({
      mode: prefs.mode,
      value: activeValue(prefs),
      punctuation: prefs.punctuation,
      numbers: prefs.numbers,
      adaptive: drilling,
    }),
    [prefs, drilling],
  )

  // Cold start: the first three tests are plain common-word English. A bigram
  // needs eight samples before its EWMA means anything, and generating drills
  // from noise would make the app feel arbitrary exactly when someone is
  // deciding whether it works. ARCHITECTURE.md 8.2 step 1.
  const nextTest = useCallback(
    (): Parameters<typeof createEngine>[0] => ({
      config,
      wordSource: config.adaptive ? createDrillSource({ table }) : createWordSource(config),
      id: crypto.randomUUID(),
      startedAt: Date.now(),
    }),
    [config, table],
  )

  const [engine] = useState<Engine>(() =>
    createEngine({
      config,
      wordSource: createWordSource(config),
      id: crypto.randomUUID(),
      startedAt: Date.now(),
    }),
  )

  const status = useSyncExternalStore(
    engine.subscribeToStatus,
    engine.getStatusSnapshot,
    engine.getStatusSnapshot,
  )

  const result: TestResult | null = status.status === 'complete' ? engine.getResult() : null

  useEffect(() => {
    void loadTests().then(setTests)
    void loadBigrams().then((records) => {
      setTable(fromRecords(records))
    })
    pruneOnBoot(Date.now())
  }, [])

  const restart = useCallback(() => {
    setView('test')
    engine.reset(nextTest())
  }, [engine, nextTest])

  useEffect(() => {
    if (result === null || persistedId.current === result.id) {
      return
    }

    persistedId.current = result.id

    // The results are on screen already. The write waits for an idle callback,
    // and the bigram table folds in the same pass — the engine has already
    // withheld anything typed on a soft keyboard or across a blur.
    void persistResult(result).then((outcome) => {
      setStorageError(outcome !== 'saved')

      if (outcome !== 'saved') {
        return
      }

      void loadTests().then(setTests)
      setTable((current) => {
        const next = aggregate(current, {
          samples: engine.getBigrams(),
          errors: [],
          at: result.startedAt,
          inputSource: result.inputSource,
        })

        void saveBigrams(toRecords(next))

        return next
      })
    })
  }, [result, engine, setStorageError])

  const history = useMemo(() => buildHistory(tests), [tests])
  const scores = useMemo(() => scoreAll(table), [table])

  if (view === 'weakness') {
    return <WeaknessReport scores={scores} onNewTest={restart} />
  }

  if (view === 'progress') {
    return <ProgressScreen points={progressPoints(tests, 7)} onNewTest={restart} />
  }

  if (result !== null) {
    const previous = tests.filter((test) => test.id !== result.id)

    return (
      <ResultsScreen
        result={result}
        comparison={compare(
          previous,
          { wpm: result.derived.wpm, config: result.config, inputSource: result.inputSource },
          result.startedAt,
        )}
        weakness={scores}
        calibration={calibration(previous.length)}
        history={history}
        storageFailed={storageError}
        onRepeat={restart}
        onNew={restart}
        onDrill={() => {
          setView('weakness')
        }}
        onProgress={() => {
          setView('progress')
        }}
      />
    )
  }

  return <TestScreen engine={engine} config={config} onRestart={restart} />
}
