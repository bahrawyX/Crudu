/**
 * The engine's vocabulary. See docs/SPEC.md for the behaviour these describe.
 *
 * Nothing here imports React, touches the DOM, or reads a clock. The engine is
 * a reducer over an immutable state object and these are its shapes.
 */

export type TestMode = 'time' | 'words'

/** Whether the test was typed on a physical keyboard or a soft one. SPEC 1.7. */
export type InputSource = 'physical' | 'virtual'

export type EngineStatus = 'idle' | 'running' | 'paused' | 'complete'

/** Derived per character, never stored. SPEC 2.1. */
export type CharState = 'pending' | 'correct' | 'incorrect' | 'extra' | 'missed'

/**
 * What produced a log entry. Metrics read this before they read anything else,
 * because each kind counts towards a different subset of them. SPEC 6.1.
 */
export type KeystrokeKind = 'char' | 'missed' | 'backspace' | 'delete-word'

export type TestConfig = {
  readonly mode: TestMode
  /** Seconds in time mode, words in words mode. */
  readonly value: number
  readonly punctuation: boolean
  readonly numbers: boolean
  readonly adaptive: boolean
}

/**
 * A keydown, flattened. The caller maps a KeyboardEvent onto this so that the
 * engine never sees a DOM object and every test can synthesise input.
 *
 * `timeStamp` is KeyboardEvent.timeStamp, never performance.now(). timeStamp is
 * when the browser received the event; performance.now() is when the handler
 * happened to run, which under load is 5 to 30ms of noise injected into every
 * bigram measurement.
 */
export type KeyInput = {
  readonly key: string
  /** '' on most soft keyboards. One half of the virtual-keyboard test. */
  readonly code: string
  /** 229 while an IME is composing. The other half. */
  readonly keyCode: number
  readonly timeStamp: number
  readonly repeat: boolean
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
}

/**
 * One entry in the log, which is the source of truth for every metric and for
 * any future replay. Aggregates are not reversible; this is.
 */
export type Keystroke = {
  readonly kind: KeystrokeKind
  /** The character typed. '' for missed, backspace and delete-word. */
  readonly c: string
  /** The character expected. '' where none was, which is what makes an extra. */
  readonly e: string
  /** Milliseconds from the first accepted character, paused spans removed. */
  readonly t: number
  readonly ok: boolean
  readonly repeat: boolean
  /**
   * How many pauses had completed when this entry was made. A bigram whose two
   * entries disagree here spans a blur and is discarded: paused time is already
   * subtracted from `t`, so the pair would otherwise look impossibly fast.
   */
  readonly pauses: number
}

export type WordStatus = 'pending' | 'active' | 'done'

/**
 * One word. `status` is carried rather than derived from the word index so that
 * a <Word> can render itself from its own snapshot alone, without subscribing
 * to a cursor that changes on every space.
 */
export type WordState = {
  readonly text: string
  readonly typed: string
  readonly status: WordStatus
}

export type EngineState = {
  readonly status: EngineStatus
  readonly config: TestConfig
  readonly words: readonly WordState[]
  readonly wordIndex: number
  readonly log: readonly Keystroke[]
  readonly inputSource: InputSource
  /** Raw timestamp of the first accepted character. null until the test starts. */
  readonly startedAt: number | null
  /** Highest raw timestamp seen, used to clamp non-monotonic input. SPEC 5.3. */
  readonly lastTimeStamp: number
  /** Test time at lastTimeStamp, paused spans removed. */
  readonly elapsedMs: number
  readonly pausedTotalMs: number
  readonly pauseStartedAt: number | null
  readonly pauses: number
  /** Supplied by the caller. The engine cannot generate an id or read a clock. */
  readonly id: string
  readonly startedAtEpoch: number
}

export type EngineAction =
  | { readonly type: 'key'; readonly input: KeyInput }
  | { readonly type: 'pause'; readonly timeStamp: number }
  | { readonly type: 'resume'; readonly timeStamp: number }
  | { readonly type: 'tick'; readonly timeStamp: number }
  | { readonly type: 'appendWords'; readonly words: readonly string[] }
  | {
      readonly type: 'reset'
      readonly config: TestConfig
      readonly words: readonly string[]
      readonly id: string
      readonly startedAtEpoch: number
    }

export type ReduceResult = {
  readonly state: EngineState
  /** Indices whose WordState object was replaced. Usually one, two on a boundary. */
  readonly dirtyWords: readonly number[]
  readonly statusChanged: boolean
}

export type CharCounts = {
  readonly correct: number
  readonly incorrect: number
  readonly extra: number
  readonly missed: number
}

export type Metrics = {
  readonly wpm: number
  readonly raw: number
  readonly accuracy: number
  readonly consistency: number
  readonly chars: CharCounts
}

export type BigramSample = {
  /** Two typed characters. Both were correct, so they are also the expected two. */
  readonly pair: string
  readonly latencyMs: number
}

export type TestResult = {
  readonly id: string
  readonly startedAt: number
  readonly config: TestConfig
  readonly inputSource: InputSource
  readonly keystrokes: readonly Keystroke[]
  readonly derived: Metrics
}

export type EngineChange = {
  readonly dirtyWords: readonly number[]
  readonly statusChanged: boolean
}

/**
 * Everything the chrome needs and no word content, so that the counter can
 * re-render on the second without touching a single <Word>.
 */
export type StatusSnapshot = {
  readonly status: EngineStatus
  readonly elapsedMs: number
  readonly remainingMs: number
  readonly wordIndex: number
  readonly wordCount: number
  readonly remainingWords: number
  readonly inputSource: InputSource
}

/** Supplies words on demand. Phase 4 substitutes the adaptive generator. */
export type WordSource = (count: number) => readonly string[]
