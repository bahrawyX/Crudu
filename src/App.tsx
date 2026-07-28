import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import {
  CALIBRATION_TESTS,
  aggregate,
  calibration,
  createDrillSource,
  fromRecords,
  refreshTargets,
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
import { Header } from './components/ui/Header'
import type { RouteName } from './routes/paths'
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

type View = RouteName

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
  const lastWords = useRef<readonly string[]>([])
  const persistedId = useRef<string | null>(null)
  const restartControl = useRef<HTMLButtonElement | null>(null)

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
    lastWords.current = engine.getState().words.map((word) => word.text)
  }, [engine, nextTest])

  /**
   * Shift+Tab repeats the identical test: the same words, not merely the same
   * configuration. Keeping the list is what makes the second run a comparison
   * of the typing rather than of the luck of the draw.
   */
  const repeat = useCallback(() => {
    const words = lastWords.current

    setView('test')
    engine.reset({
      config,
      wordSource: () => words,
      id: crypto.randomUUID(),
      startedAt: Date.now(),
    })
  }, [engine, config])

  useEffect(() => {
    lastWords.current = engine.getState().words.map((word) => word.text)
  }, [engine])

  // A user who has to reach for the mouse in a typing app has been failed.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Tab' && event.shiftKey) {
        event.preventDefault()
        repeat()

        return
      }

      /*
       * The restart control is first in the document, and the typing input is
       * last, so a plain Tab off the input left the document rather than
       * reaching it. Sending the first Tab to the front is what "first in tab
       * order" was always meant to mean; from there traversal carries on
       * normally into the header and the chips.
       */
      if (
        event.key === 'Tab' &&
        restartControl.current !== null &&
        document.activeElement?.classList.contains('hidden-input') === true
      ) {
        event.preventDefault()
        restartControl.current.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [repeat])

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
  const targets = useMemo(() => refreshTargets(table), [table])

  const chrome = (screen: RouteName, body: ReactNode): ReactNode => (
    <>
      {/*
       * First in tab order, ahead of the header, so Tab then Enter restarts from
       * anywhere. It reveals itself on focus: the design has no restart button,
       * and a permanent one would put a second thing on a screen whose whole
       * argument is that there is only the text.
       */}
      <button type="button" className="restart-control" ref={restartControl} onClick={restart}>
        Restart test
      </button>
      <Header current={screen} hidden={status.status === 'running'} onNavigate={setView} />
      {body}
    </>
  )

  if (view === 'weakness') {
    // The report shows every tracked pair, including the under-sampled ones, and
    // marks them. scoreAll's default eight sample floor drops them before the
    // screen ever sees them, so the 'Needs more data' state in DESIGN.md 3.6
    // would be unreachable. The drill still uses the filtered scores.
    return chrome('weakness', <WeaknessReport scores={scoreAll(table, 1)} onNewTest={restart} />)
  }

  if (view === 'progress') {
    return chrome(
      'progress',
      <ProgressScreen points={progressPoints(tests, 7)} onNewTest={restart} />,
    )
  }

  if (view === 'settings') {
    // The settings screen is deferred. An honest placeholder beats a nav entry
    // that goes nowhere, and every control it would hold is on the test screen.
    return chrome(
      'settings',
      <main className="screen screen-panel">
        <div className="empty-state" data-height="half">
          <div className="empty-title">Nothing to set yet.</div>
          <div className="empty-body">
            Mode, duration, punctuation and numbers are on the test screen.
          </div>
          <button type="button" className="button-primary" onClick={restart}>
            Run a test.
          </button>
        </div>
      </main>,
    )
  }

  if (result !== null) {
    const previous = tests.filter((test) => test.id !== result.id)

    return chrome(
      'test',
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
      />,
    )
  }

  return chrome(
    'test',
    <TestScreen
      engine={engine}
      config={config}
      onRestart={restart}
      {...(drilling ? { targets, onStopDrilling: prefs.toggleAdaptive } : {})}
    />,
  )
}
