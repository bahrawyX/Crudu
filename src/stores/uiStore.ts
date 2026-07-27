import { create } from 'zustand'

/**
 * Transient interface state. Nothing here survives a reload and nothing here is
 * a preference.
 *
 * Kept separate from prefsStore so that phase 3 can persist preferences wholesale
 * without accidentally writing ephemeral flags to localStorage.
 */

export type UiState = {
  /**
   * A write to IndexedDB failed, most likely QuotaExceededError. The settings
   * screen surfaces "Could not save that test. Your history is intact." while
   * this is set. Storage errors must never interrupt a test.
   */
  readonly storageError: boolean
}

type UiActions = {
  setStorageError: (failed: boolean) => void
  clearStorageError: () => void
}

export type UiStore = UiState & UiActions

export const INITIAL_UI_STATE: UiState = {
  storageError: false,
}

export const useUiStore = create<UiStore>((set) => ({
  ...INITIAL_UI_STATE,
  setStorageError: (failed) => {
    set({ storageError: failed })
  },
  clearStorageError: () => {
    set({ storageError: false })
  },
}))
