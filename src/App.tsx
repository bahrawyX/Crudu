import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import { createEngine } from './engine'
import type { Engine, TestConfig, TestResult } from './engine'
import { ResultsScreen } from './components/results'
import { TestScreen } from './components/test'
import { loadTests } from './storage/db'
import type { StoredTest } from './storage/db'
import { buildHistory, compare } from './storage/history'
import { persistResult, pruneOnBoot } from './storage/session'
import { activeValue, usePrefsStore } from './stores/prefsStore'
import { useUiStore } from './stores/uiStore'
import { createWordSource } from './words/source'

/**
 * The loop: type, see the result, go again.
 *
 * The engine lives here rather than inside the test screen, so that finishing a
 * test swaps the screen without tearing the engine down and losing the log that
 * the results are made of.
 */

function newTest(config: TestConfig) {
  return {
    config,
    wordSource: createWordSource(config),
    id: crypto.randomUUID(),
    startedAt: Date.now(),
  }
}

export function App() {
  const prefs = usePrefsStore()
  const setStorageError = useUiStore((state) => state.setStorageError)
  const storageError = useUiStore((state) => state.storageError)

  const config = useMemo<TestConfig>(
    () => ({
      mode: prefs.mode,
      value: activeValue(prefs),
      punctuation: prefs.punctuation,
      numbers: prefs.numbers,
      adaptive: false,
    }),
    [prefs],
  )

  const [engine] = useState<Engine>(() => createEngine(newTest(config)))
  const [tests, setTests] = useState<readonly StoredTest[]>([])
  const persistedId = useRef<string | null>(null)

  const status = useSyncExternalStore(
    engine.subscribeToStatus,
    engine.getStatusSnapshot,
    engine.getStatusSnapshot,
  )

  // Derived rather than held in state: the engine already caches the result, and
  // mirroring it here would mean a second source of truth that can disagree.
  const result: TestResult | null = status.status === 'complete' ? engine.getResult() : null

  // History is read once, on boot. Pruning follows in an idle callback.
  useEffect(() => {
    void loadTests().then(setTests)
    pruneOnBoot(Date.now())
  }, [])

  const restart = useCallback(() => {
    engine.reset(newTest(config))
  }, [engine, config])

  // The results are already on screen when this runs, and the write itself waits
  // for an idle callback. A quota failure changes what is displayed without
  // ever having delayed it.
  useEffect(() => {
    if (result === null || persistedId.current === result.id) {
      return
    }

    persistedId.current = result.id

    void persistResult(result).then((outcome) => {
      setStorageError(outcome !== 'saved')

      if (outcome === 'saved') {
        void loadTests().then(setTests)
      }
    })
  }, [result, setStorageError])

  const history = useMemo(() => buildHistory(tests), [tests])

  if (result !== null) {
    // The comparison excludes the run being reported: a test compared against
    // itself is always exactly average and never a personal best.
    const previous = tests.filter((test) => test.id !== result.id)

    return (
      <ResultsScreen
        result={result}
        comparison={compare(
          previous,
          { wpm: result.derived.wpm, config: result.config, inputSource: result.inputSource },
          // The test's own start time, not the wall clock: it is the right
          // anchor for a seven day window and it keeps this render pure.
          result.startedAt,
        )}
        bigrams={engine.getBigrams()}
        history={history}
        storageFailed={storageError}
        onRepeat={restart}
        onNew={restart}
      />
    )
  }

  return <TestScreen engine={engine} config={config} onRestart={restart} />
}
