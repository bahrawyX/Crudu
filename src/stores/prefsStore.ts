import { create } from 'zustand'

/**
 * User preferences, exactly the set the settings screen in docs/DESIGN.md
 * exposes.
 *
 * Zustand holds UI and settings state only. The typing engine is a plain
 * reducer outside React and outside this store (invariant 1).
 *
 * Persistence is not wired here. Phase 3 adds src/storage/prefs.ts, which reads
 * localStorage synchronously at boot so there is no flash of the wrong theme,
 * and hydrates this store from it.
 */

export type Theme = 'light' | 'dark'
export type TestMode = 'time' | 'words'

/** Durations offered in time mode, in seconds. */
export const TIME_VALUES = [15, 30, 60, 120] as const

/** Word counts offered in words mode. */
export const WORD_VALUES = [10, 25, 50, 100] as const

export type Prefs = {
  readonly theme: Theme
  readonly mode: TestMode
  readonly timeValue: number
  readonly wordCount: number
  readonly punctuation: boolean
  readonly numbers: boolean
  readonly stopOnError: boolean
  readonly caretBlink: boolean
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'light',
  mode: 'time',
  timeValue: 30,
  wordCount: 25,
  punctuation: false,
  numbers: false,
  stopOnError: false,
  caretBlink: true,
}

type PrefsActions = {
  setTheme: (theme: Theme) => void
  setMode: (mode: TestMode) => void
  setValue: (value: number) => void
  togglePunctuation: () => void
  toggleNumbers: () => void
  toggleStopOnError: () => void
  toggleCaretBlink: () => void
  reset: () => void
}

export type PrefsStore = Prefs & PrefsActions

export const usePrefsStore = create<PrefsStore>((set) => ({
  ...DEFAULT_PREFS,
  setTheme: (theme) => {
    set({ theme })
  },
  setMode: (mode) => {
    set({ mode })
  },
  setValue: (value) => {
    set((state) => (state.mode === 'time' ? { timeValue: value } : { wordCount: value }))
  },
  togglePunctuation: () => {
    set((state) => ({ punctuation: !state.punctuation }))
  },
  toggleNumbers: () => {
    set((state) => ({ numbers: !state.numbers }))
  },
  toggleStopOnError: () => {
    set((state) => ({ stopOnError: !state.stopOnError }))
  },
  toggleCaretBlink: () => {
    set((state) => ({ caretBlink: !state.caretBlink }))
  },
  reset: () => {
    set({ ...DEFAULT_PREFS })
  },
}))

/** The value that applies to the current mode. */
export function activeValue(prefs: Prefs): number {
  return prefs.mode === 'time' ? prefs.timeValue : prefs.wordCount
}
