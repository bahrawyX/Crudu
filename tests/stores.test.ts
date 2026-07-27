import { beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_PREFS,
  TIME_VALUES,
  WORD_VALUES,
  activeValue,
  usePrefsStore,
} from '../src/stores/prefsStore'
import { INITIAL_UI_STATE, useUiStore } from '../src/stores/uiStore'

describe('preferences store', () => {
  beforeEach(() => {
    usePrefsStore.getState().reset()
  })

  it('starts on the defaults docs/DESIGN.md declares', () => {
    const state = usePrefsStore.getState()

    expect(state.theme).toBe('light')
    expect(state.mode).toBe('time')
    expect(state.timeValue).toBe(30)
    expect(state.wordCount).toBe(25)
    expect(state.punctuation).toBe(false)
    expect(state.numbers).toBe(false)
    expect(state.stopOnError).toBe(false)
    expect(state.caretBlink).toBe(true)
  })

  it('offers the four durations and four word counts from the config bar', () => {
    expect(TIME_VALUES).toEqual([15, 30, 60, 120])
    expect(WORD_VALUES).toEqual([10, 25, 50, 100])
    expect(TIME_VALUES).toContain(DEFAULT_PREFS.timeValue)
    expect(WORD_VALUES).toContain(DEFAULT_PREFS.wordCount)
  })

  it('sets the value belonging to the active mode and leaves the other alone', () => {
    usePrefsStore.getState().setValue(60)

    expect(usePrefsStore.getState().timeValue).toBe(60)
    expect(usePrefsStore.getState().wordCount).toBe(25)

    usePrefsStore.getState().setMode('words')
    usePrefsStore.getState().setValue(50)

    expect(usePrefsStore.getState().wordCount).toBe(50)
    expect(usePrefsStore.getState().timeValue).toBe(60)
  })

  it('reads back the value for the active mode', () => {
    expect(activeValue(usePrefsStore.getState())).toBe(30)

    usePrefsStore.getState().setMode('words')

    expect(activeValue(usePrefsStore.getState())).toBe(25)
  })

  it('toggles every boolean preference', () => {
    const store = usePrefsStore.getState()

    store.togglePunctuation()
    store.toggleNumbers()
    store.toggleStopOnError()
    store.toggleCaretBlink()

    const next = usePrefsStore.getState()

    expect(next.punctuation).toBe(true)
    expect(next.numbers).toBe(true)
    expect(next.stopOnError).toBe(true)
    expect(next.caretBlink).toBe(false)
  })

  it('switches theme', () => {
    usePrefsStore.getState().setTheme('dark')

    expect(usePrefsStore.getState().theme).toBe('dark')
  })

  it('resets to the defaults', () => {
    const store = usePrefsStore.getState()

    store.setTheme('dark')
    store.setMode('words')
    store.togglePunctuation()
    store.reset()

    const next = usePrefsStore.getState()

    expect(next.theme).toBe(DEFAULT_PREFS.theme)
    expect(next.mode).toBe(DEFAULT_PREFS.mode)
    expect(next.punctuation).toBe(DEFAULT_PREFS.punctuation)
  })
})

describe('interface store', () => {
  beforeEach(() => {
    useUiStore.getState().clearStorageError()
  })

  it('starts with no storage error', () => {
    expect(INITIAL_UI_STATE.storageError).toBe(false)
    expect(useUiStore.getState().storageError).toBe(false)
  })

  it('raises and clears the storage error flag', () => {
    useUiStore.getState().setStorageError(true)

    expect(useUiStore.getState().storageError).toBe(true)

    useUiStore.getState().clearStorageError()

    expect(useUiStore.getState().storageError).toBe(false)
  })
})
