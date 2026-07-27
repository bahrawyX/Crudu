import { WORD_LOW_WATER } from './constants'
import { computeMetrics } from './metrics'
import { createInitialState, reduce } from './reducer'
import type {
  BigramSample,
  EngineChange,
  EngineState,
  KeyInput,
  StatusSnapshot,
  TestConfig,
  TestResult,
  WordSource,
  WordState,
} from './types'
import { bigramLatencies } from './metrics'

/**
 * The engine instance: the pure reducer, plus the subscription plumbing React
 * needs and the word source the reducer must not have.
 *
 * This file is the only place that holds mutable state. It never imports React.
 * React subscribes through useSyncExternalStore at word granularity, which is
 * why a keystroke re-renders one <Word> rather than a three hundred node tree.
 * See ARCHITECTURE.md 4.2 and docs/SPEC.md 7.
 */

export type EngineOptions = {
  readonly config: TestConfig
  readonly wordSource: WordSource
  readonly id: string
  readonly startedAt: number
}

export type Engine = {
  input: (input: KeyInput) => void
  pause: (timeStamp: number) => void
  resume: (timeStamp: number) => void
  tick: (timeStamp: number) => void
  reset: (next?: Partial<EngineOptions>) => void
  subscribe: (listener: (change: EngineChange) => void) => () => void
  subscribeToWord: (index: number, listener: () => void) => () => void
  subscribeToStatus: (listener: () => void) => () => void
  getWordSnapshot: (index: number) => WordState | undefined
  getStatusSnapshot: () => StatusSnapshot
  getState: () => EngineState
  getResult: () => TestResult | null
  getBigrams: () => readonly BigramSample[]
}

const EMPTY_WORD_LIST: readonly string[] = []

export function createEngine(options: EngineOptions): Engine {
  let config = options.config
  let wordSource = options.wordSource
  let id = options.id
  let startedAt = options.startedAt

  let state = createInitialState(config, initialWords(config, wordSource), id, startedAt)
  let statusSnapshot = toStatusSnapshot(state)
  let result: TestResult | null = null

  const changeListeners = new Set<(change: EngineChange) => void>()
  const statusListeners = new Set<() => void>()
  const wordListeners = new Map<number, Set<() => void>>()

  function dispatch(action: Parameters<typeof reduce>[1]): EngineChange {
    const outcome = reduce(state, action)

    state = outcome.state

    if (outcome.statusChanged) {
      statusSnapshot = toStatusSnapshot(state)
    }

    return { dirtyWords: outcome.dirtyWords, statusChanged: outcome.statusChanged }
  }

  /** SPEC 4.3: top up whenever fewer than a chunk remains ahead of the cursor. */
  function refill(): EngineChange | null {
    if (config.mode !== 'time' || state.status === 'complete') {
      return null
    }

    if (state.words.length - state.wordIndex >= WORD_LOW_WATER) {
      return null
    }

    const words = wordSource(WORD_LOW_WATER)

    if (words.length === 0) {
      return null
    }

    return dispatch({ type: 'appendWords', words })
  }

  function emit(change: EngineChange): void {
    for (const index of change.dirtyWords) {
      const listeners = wordListeners.get(index)

      if (listeners !== undefined) {
        for (const listener of listeners) {
          listener()
        }
      }
    }

    if (change.statusChanged) {
      for (const listener of statusListeners) {
        listener()
      }
    }

    if (change.dirtyWords.length > 0 || change.statusChanged) {
      for (const listener of changeListeners) {
        listener(change)
      }
    }
  }

  function run(action: Parameters<typeof reduce>[1]): void {
    const change = dispatch(action)
    const topUp = refill()

    if (state.status === 'complete') {
      result = null
    }

    emit(
      topUp === null
        ? change
        : {
            dirtyWords: [...change.dirtyWords, ...topUp.dirtyWords],
            statusChanged: change.statusChanged || topUp.statusChanged,
          },
    )
  }

  return {
    input: (input) => {
      run({ type: 'key', input })
    },
    pause: (timeStamp) => {
      run({ type: 'pause', timeStamp })
    },
    resume: (timeStamp) => {
      run({ type: 'resume', timeStamp })
    },
    tick: (timeStamp) => {
      run({ type: 'tick', timeStamp })
    },
    reset: (next) => {
      config = next?.config ?? config
      wordSource = next?.wordSource ?? wordSource
      id = next?.id ?? id
      startedAt = next?.startedAt ?? startedAt
      result = null

      run({
        type: 'reset',
        config,
        words: initialWords(config, wordSource),
        id,
        startedAtEpoch: startedAt,
      })
    },
    subscribe: (listener) => {
      changeListeners.add(listener)

      return () => {
        changeListeners.delete(listener)
      }
    },
    subscribeToWord: (index, listener) => {
      const listeners = wordListeners.get(index) ?? new Set<() => void>()

      listeners.add(listener)
      wordListeners.set(index, listeners)

      return () => {
        listeners.delete(listener)

        if (listeners.size === 0) {
          wordListeners.delete(index)
        }
      }
    },
    subscribeToStatus: (listener) => {
      statusListeners.add(listener)

      return () => {
        statusListeners.delete(listener)
      }
    },
    // Identity is stable until the word actually changes. useSyncExternalStore
    // compares snapshots by identity and loops forever on a fresh object.
    getWordSnapshot: (index) => state.words[index],
    getStatusSnapshot: () => statusSnapshot,
    getState: () => state,
    getResult: () => {
      if (state.status !== 'complete') {
        return null
      }

      result ??= buildResult(state)

      return result
    },
    getBigrams: () => bigramLatencies(state.log, state.inputSource),
  }
}

function initialWords(config: TestConfig, wordSource: WordSource): readonly string[] {
  const requested = config.mode === 'words' ? config.value : WORD_LOW_WATER

  return requested > 0 ? wordSource(requested) : EMPTY_WORD_LIST
}

/** SPEC 6.2. Time mode is measured by its configuration, words mode by its log. */
export function resultDurationMs(state: EngineState): number {
  if (state.config.mode === 'time') {
    return state.config.value * 1000
  }

  return state.log.at(-1)?.t ?? 0
}

function buildResult(state: EngineState): TestResult {
  return {
    id: state.id,
    startedAt: state.startedAtEpoch,
    config: state.config,
    inputSource: state.inputSource,
    keystrokes: [...state.log],
    derived: computeMetrics(state.log, resultDurationMs(state)),
  }
}

function toStatusSnapshot(state: EngineState): StatusSnapshot {
  const remainingMs =
    state.config.mode === 'time' ? Math.max(0, state.config.value * 1000 - state.elapsedMs) : 0

  return {
    status: state.status,
    elapsedMs: state.elapsedMs,
    remainingMs,
    wordIndex: state.wordIndex,
    wordCount: state.words.length,
    remainingWords: Math.max(0, state.words.length - state.wordIndex),
    inputSource: state.inputSource,
  }
}
