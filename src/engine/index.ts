/**
 * Public surface of the typing engine.
 *
 * Nothing under src/engine/ may import React. The engine is a plain TypeScript
 * reducer that React subscribes to via useSyncExternalStore, and that
 * separation is the reason a keystroke costs one word re-render instead of a
 * three hundred node tree walk. The rule is enforced twice: by the
 * no-restricted-syntax block in eslint.config.js, and by
 * tests/engine/invariants.test.ts.
 *
 * Behaviour is specified in docs/SPEC.md.
 */

export {
  CHARS_PER_WORD,
  CONSISTENCY_SAMPLE_MS,
  EXTRA_CHARS_LIMIT,
  MIN_CONSISTENCY_SAMPLES,
  PAUSE_THRESHOLD_MS,
  VIRTUAL_KEY_CODE,
  WORD_CHUNK_SIZE,
  WORD_LOW_WATER,
} from './constants'

export { createEngine, resultDurationMs } from './engine'
export type { Engine, EngineOptions } from './engine'

export {
  charStates,
  classifyKey,
  isBlockedInputType,
  isCompositionInputType,
  isVirtualKey,
  isWordClean,
} from './keystrokes'
export type { KeyAction } from './keystrokes'

export {
  accuracy,
  bigramLatencies,
  computeMetrics,
  consistency,
  countChars,
  netWpm,
  rawWpm,
  wpmSeries,
} from './metrics'
export type { SecondSample } from './metrics'

export { createInitialState, reduce } from './reducer'

export type {
  BigramSample,
  CharCounts,
  CharState,
  EngineAction,
  EngineChange,
  EngineState,
  EngineStatus,
  InputSource,
  KeyInput,
  Keystroke,
  KeystrokeKind,
  Metrics,
  ReduceResult,
  StatusSnapshot,
  TestConfig,
  TestMode,
  TestResult,
  WordSource,
  WordState,
  WordStatus,
} from './types'
