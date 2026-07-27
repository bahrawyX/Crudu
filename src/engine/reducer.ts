import { EXTRA_CHARS_LIMIT } from './constants'
import {
  charKeystroke,
  classifyKey,
  editKeystroke,
  isVirtualKey,
  isWordClean,
  missedKeystroke,
} from './keystrokes'
import type {
  EngineAction,
  EngineState,
  KeyInput,
  Keystroke,
  ReduceResult,
  TestConfig,
  WordState,
} from './types'

/**
 * The typing engine. A pure reducer over an immutable state object.
 *
 * No React, no DOM, no clock. Every timestamp arrives from the caller as
 * KeyboardEvent.timeStamp, which is why this file is exercisable from Vitest
 * with synthetic times and why the bigram data is not polluted by scheduling
 * noise. See docs/SPEC.md.
 */

type Applied = {
  readonly state: EngineState
  readonly dirtyWords: readonly number[]
}

const NO_DIRTY: readonly number[] = []

function toWords(text: readonly string[], activeIndex: number): WordState[] {
  return text.map((word, index) => ({
    text: word,
    typed: '',
    status: index === activeIndex ? 'active' : 'pending',
  }))
}

export function createInitialState(
  config: TestConfig,
  words: readonly string[],
  id: string,
  startedAtEpoch: number,
): EngineState {
  return {
    status: 'idle',
    config,
    words: toWords(words, 0),
    wordIndex: 0,
    log: [],
    inputSource: 'physical',
    startedAt: null,
    lastTimeStamp: Number.NEGATIVE_INFINITY,
    elapsedMs: 0,
    pausedTotalMs: 0,
    pauseStartedAt: null,
    pauses: 0,
    id,
    startedAtEpoch,
  }
}

/**
 * Test time at a raw timestamp, paused spans removed. While paused the clock is
 * frozen at the moment of the blur.
 */
function testTimeAt(state: EngineState, rawTimeStamp: number): number {
  if (state.startedAt === null) {
    return 0
  }

  // pauseStartedAt is non-null exactly while the status is 'paused', so it alone
  // decides whether the clock is frozen.
  const reference = state.pauseStartedAt ?? rawTimeStamp

  return Math.max(0, reference - state.startedAt - state.pausedTotalMs)
}

/** SPEC 5.3: a timestamp earlier than the last one seen is clamped, never applied. */
function clampTimeStamp(state: EngineState, rawTimeStamp: number): number {
  return Math.max(rawTimeStamp, state.lastTimeStamp)
}

function durationMs(config: TestConfig): number {
  return config.value * 1000
}

function hasExpired(state: EngineState, elapsedMs: number): boolean {
  return state.config.mode === 'time' && state.startedAt !== null && elapsedMs >= durationMs(state.config)
}

function complete(state: EngineState): EngineState {
  return { ...state, status: 'complete', pauseStartedAt: null }
}

function replaceWords(
  words: readonly WordState[],
  updates: ReadonlyArray<readonly [number, WordState]>,
): WordState[] {
  const next = words.slice()

  for (const [index, word] of updates) {
    next[index] = word
  }

  return next
}

function statusChangedBetween(before: EngineState, after: EngineState): boolean {
  return (
    before.status !== after.status ||
    before.wordIndex !== after.wordIndex ||
    before.words.length !== after.words.length ||
    before.inputSource !== after.inputSource ||
    Math.floor(before.elapsedMs / 1000) !== Math.floor(after.elapsedMs / 1000)
  )
}

export function reduce(state: EngineState, action: EngineAction): ReduceResult {
  const applied = apply(state, action)

  return {
    state: applied.state,
    dirtyWords: applied.dirtyWords,
    statusChanged: action.type === 'reset' || statusChangedBetween(state, applied.state),
  }
}

function apply(state: EngineState, action: EngineAction): Applied {
  switch (action.type) {
    case 'reset':
      return {
        state: createInitialState(action.config, action.words, action.id, action.startedAtEpoch),
        dirtyWords: action.words.map((_word, index) => index),
      }
    case 'appendWords':
      return applyAppendWords(state, action.words)
    case 'pause':
      return applyPause(state, action.timeStamp)
    case 'resume':
      return applyResume(state, action.timeStamp)
    case 'tick':
      return applyTick(state, action.timeStamp)
    case 'key':
      return applyKey(state, action.input)
  }
}

function applyAppendWords(state: EngineState, words: readonly string[]): Applied {
  if (words.length === 0 || state.status === 'complete') {
    return { state, dirtyWords: NO_DIRTY }
  }

  const appended: WordState[] = words.map((text) => ({ text, typed: '', status: 'pending' }))

  return {
    // The new words carry no subscribers yet, so they are not reported dirty.
    // The list length is part of the status snapshot, which does change.
    state: { ...state, words: [...state.words, ...appended] },
    dirtyWords: NO_DIRTY,
  }
}

function applyPause(state: EngineState, rawTimeStamp: number): Applied {
  if (state.status !== 'running') {
    return { state, dirtyWords: NO_DIRTY }
  }

  const timeStamp = clampTimeStamp(state, rawTimeStamp)
  const elapsedMs = testTimeAt(state, timeStamp)

  if (hasExpired(state, elapsedMs)) {
    return { state: complete({ ...state, lastTimeStamp: timeStamp, elapsedMs }), dirtyWords: NO_DIRTY }
  }

  return {
    state: { ...state, status: 'paused', pauseStartedAt: timeStamp, lastTimeStamp: timeStamp, elapsedMs },
    dirtyWords: NO_DIRTY,
  }
}

function applyResume(state: EngineState, rawTimeStamp: number): Applied {
  const pausedAt = state.pauseStartedAt

  // Non-null exactly while paused, so this is also the "are we paused" check.
  if (pausedAt === null) {
    return { state, dirtyWords: NO_DIRTY }
  }

  const timeStamp = clampTimeStamp(state, rawTimeStamp)
  const resumed: EngineState = {
    ...state,
    status: 'running',
    pausedTotalMs: state.pausedTotalMs + (timeStamp - pausedAt),
    pauseStartedAt: null,
    pauses: state.pauses + 1,
    lastTimeStamp: timeStamp,
  }

  return { state: { ...resumed, elapsedMs: testTimeAt(resumed, timeStamp) }, dirtyWords: NO_DIRTY }
}

function applyTick(state: EngineState, rawTimeStamp: number): Applied {
  if (state.status !== 'running') {
    return { state, dirtyWords: NO_DIRTY }
  }

  const timeStamp = clampTimeStamp(state, rawTimeStamp)
  const elapsedMs = testTimeAt(state, timeStamp)
  const ticked: EngineState = { ...state, lastTimeStamp: timeStamp, elapsedMs }

  return { state: hasExpired(state, elapsedMs) ? complete(ticked) : ticked, dirtyWords: NO_DIRTY }
}

function applyKey(state: EngineState, input: KeyInput): Applied {
  if (state.status === 'complete') {
    return { state, dirtyWords: NO_DIRTY }
  }

  // Detection runs before classification. A soft keyboard often reports keys the
  // classifier throws away, and a test wrongly tagged virtual only loses its
  // bigrams, while one wrongly tagged physical corrupts the table for good.
  const source = isVirtualKey(input) ? 'virtual' : state.inputSource
  const timeStamp = clampTimeStamp(state, input.timeStamp)
  const seen: EngineState = { ...state, inputSource: source, lastTimeStamp: timeStamp }

  const action = classifyKey(input)

  if (action.kind === 'ignore') {
    return { state: seen, dirtyWords: NO_DIRTY }
  }

  // DESIGN.md 3.3 says "press any key to resume", so a keystroke that arrives
  // while paused restarts the clock and is then typed, rather than being eaten.
  const active = seen.status === 'paused' ? applyResume(seen, timeStamp).state : seen
  const elapsedMs = testTimeAt(active, timeStamp)

  // SPEC 4.1: a keystroke at or past expiry is discarded, not accepted late.
  if (hasExpired(active, elapsedMs)) {
    return { state: complete({ ...active, elapsedMs }), dirtyWords: NO_DIRTY }
  }

  const timed: EngineState = { ...active, elapsedMs }

  if (action.kind === 'backspace') {
    return applyBackspace(timed, elapsedMs, false)
  }

  if (action.kind === 'delete-word') {
    return applyBackspace(timed, elapsedMs, true)
  }

  return applyCharacter(timed, action.char, elapsedMs, input.repeat)
}

function applyCharacter(
  state: EngineState,
  char: string,
  elapsedMs: number,
  repeat: boolean,
): Applied {
  const word = state.words[state.wordIndex]

  if (word === undefined) {
    return { state, dirtyWords: NO_DIRTY }
  }

  // SPEC 1.4: a space with nothing typed is discarded whole. It does not start
  // the test, it is not logged, and it is not an error.
  if (char === ' ' && word.typed.length === 0) {
    return { state, dirtyWords: NO_DIRTY }
  }

  const started = startIfIdle(state)
  const t = started.startedAt === state.startedAt ? elapsedMs : 0

  return char === ' '
    ? advanceWord(started, word, t)
    : typeCharacter(started, word, char, t, repeat)
}

/** The first accepted character is t = 0 and moves the test to running. */
function startIfIdle(state: EngineState): EngineState {
  if (state.status !== 'idle') {
    return state
  }

  return { ...state, status: 'running', startedAt: state.lastTimeStamp, elapsedMs: 0 }
}

function typeCharacter(
  state: EngineState,
  word: WordState,
  char: string,
  t: number,
  repeat: boolean,
): Applied {
  // SPEC 2.3: past word.length + 10 the character is dropped in silence. No
  // state change, no log entry, no penalty.
  if (word.typed.length >= word.text.length + EXTRA_CHARS_LIMIT) {
    return { state, dirtyWords: NO_DIRTY }
  }

  const expected = word.text[word.typed.length] ?? ''
  const typed = word.typed + char
  const next: WordState = { ...word, typed }
  const log: Keystroke[] = [
    ...state.log,
    charKeystroke({
      c: char,
      e: expected,
      t,
      ok: expected !== '' && char === expected,
      repeat,
      pauses: state.pauses,
    }),
  ]

  const withWord: EngineState = {
    ...state,
    words: replaceWords(state.words, [[state.wordIndex, next]]),
    log,
  }

  // SPEC 4.2: words mode ends on the character that finishes the final word. An
  // incorrect final character does not end it; the user can still fix it.
  const finished =
    state.config.mode === 'words' &&
    state.wordIndex === state.words.length - 1 &&
    typed === word.text

  return { state: finished ? complete(withWord) : withWord, dirtyWords: [state.wordIndex] }
}

function advanceWord(state: EngineState, word: WordState, t: number): Applied {
  const clean = isWordClean(word)
  const log: Keystroke[] = [
    ...state.log,
    charKeystroke({ c: ' ', e: ' ', t, ok: clean, repeat: false, pauses: state.pauses }),
  ]

  // SPEC 2.2: the characters the user skipped are logged, one entry each, at the
  // timestamp of the space that skipped them.
  for (const missed of word.text.slice(word.typed.length)) {
    log.push(missedKeystroke(missed, t, state.pauses))
  }

  const done: WordState = { ...word, status: 'done' }
  const nextIndex = state.wordIndex + 1
  const next = state.words[nextIndex]

  // No next word means there is nothing left to type, in either mode.
  if (next === undefined) {
    return {
      state: complete({ ...state, words: replaceWords(state.words, [[state.wordIndex, done]]), log }),
      dirtyWords: [state.wordIndex],
    }
  }

  const advanced: EngineState = {
    ...state,
    words: replaceWords(state.words, [
      [state.wordIndex, done],
      [nextIndex, { ...next, status: 'active' }],
    ]),
    wordIndex: nextIndex,
    log,
  }

  return { state: advanced, dirtyWords: [state.wordIndex, nextIndex] }
}

function applyBackspace(state: EngineState, elapsedMs: number, wholeWord: boolean): Applied {
  const word = state.words[state.wordIndex]

  if (word === undefined) {
    return { state, dirtyWords: NO_DIRTY }
  }

  const kind = wholeWord ? 'delete-word' : 'backspace'
  // testTimeAt already returns 0 before the test starts, so no guard is needed.
  const t = elapsedMs

  if (word.typed.length > 0) {
    const typed = wholeWord ? '' : word.typed.slice(0, -1)

    return {
      state: {
        ...state,
        words: replaceWords(state.words, [[state.wordIndex, { ...word, typed }]]),
        log: [...state.log, editKeystroke(kind, t, state.pauses)],
      },
      dirtyWords: [state.wordIndex],
    }
  }

  const previousIndex = state.wordIndex - 1
  const previous = state.words[previousIndex]

  // SPEC 3: a correct word is locked. Anything else — a wrong character, an
  // extra, or a character missed by an early space — unlocks it.
  if (previous === undefined || isWordClean(previous)) {
    return { state, dirtyWords: NO_DIRTY }
  }

  const reopened: WordState = {
    ...previous,
    typed: wholeWord ? '' : previous.typed,
    status: 'active',
  }

  return {
    state: {
      ...state,
      words: replaceWords(state.words, [
        [state.wordIndex, { ...word, status: 'pending' }],
        [previousIndex, reopened],
      ]),
      wordIndex: previousIndex,
      log: [...state.log, editKeystroke(kind, t, state.pauses)],
    },
    dirtyWords: [previousIndex, state.wordIndex],
  }
}
