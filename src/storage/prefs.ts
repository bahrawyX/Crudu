import type { Prefs } from '../stores/prefsStore'
import { DEFAULT_PREFS } from '../stores/prefsStore'

/**
 * Preferences, and nothing else, in localStorage.
 *
 * ARCHITECTURE.md 6.2 splits storage on purpose. localStorage is synchronous,
 * which is a defect for a 40KB keystroke log and an advantage for a 200 byte
 * settings object: reading it synchronously at boot is what prevents a flash of
 * the wrong theme. Everything that grows lives in IndexedDB.
 */

const KEY = 'crudu.prefs.v1'

const THEMES = new Set(['light', 'dark'])
const MODES = new Set(['time', 'words'])

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Reads one field at a time rather than trusting the shape. Anything stored by
 * an older build, or edited by hand, falls back to the default for that field
 * instead of taking the whole object down.
 */
function coerce(raw: unknown): Prefs {
  if (typeof raw !== 'object' || raw === null) {
    return DEFAULT_PREFS
  }

  const value = raw as Record<string, unknown>
  const theme = value['theme']
  const mode = value['mode']
  const timeValue = value['timeValue']
  const wordCount = value['wordCount']

  return {
    theme: typeof theme === 'string' && THEMES.has(theme) ? (theme as Prefs['theme']) : DEFAULT_PREFS.theme,
    mode: typeof mode === 'string' && MODES.has(mode) ? (mode as Prefs['mode']) : DEFAULT_PREFS.mode,
    timeValue: isFiniteNumber(timeValue) ? timeValue : DEFAULT_PREFS.timeValue,
    wordCount: isFiniteNumber(wordCount) ? wordCount : DEFAULT_PREFS.wordCount,
    punctuation: value['punctuation'] === true,
    numbers: value['numbers'] === true,
    stopOnError: value['stopOnError'] === true,
    caretBlink: value['caretBlink'] !== false,
  }
}

export type StoredPrefs = {
  readonly prefs: Prefs
  /** False when nothing has ever been saved, which is not the same as a default. */
  readonly stored: boolean
}

/** Synchronous by design. Called before the first paint. */
export function readStoredPrefs(): StoredPrefs {
  try {
    const raw = localStorage.getItem(KEY)

    return raw === null
      ? { prefs: DEFAULT_PREFS, stored: false }
      : { prefs: coerce(JSON.parse(raw)), stored: true }
  } catch {
    // A corrupt value, a disabled storage API, or a private window that throws
    // on read. None of them should stop the app from starting.
    return { prefs: DEFAULT_PREFS, stored: false }
  }
}

export function readPrefs(): Prefs {
  return readStoredPrefs().prefs
}

/** Returns false when the write failed, so the caller can surface it. */
export function writePrefs(prefs: Prefs): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))

    return true
  } catch {
    return false
  }
}

/**
 * Applies the theme to <html>. The switch itself is CSS; this only sets the
 * attribute, and it runs before React mounts so the first paint is right.
 *
 * `null` removes the attribute, which is not the same as writing 'light'. With
 * no attribute the stylesheet falls through to prefers-color-scheme, which is
 * what DECISIONS 0.5 requires and what someone who has never opened settings
 * should get.
 */
export function applyTheme(theme: Prefs['theme'] | null): void {
  if (theme === null) {
    document.documentElement.removeAttribute('data-theme')

    return
  }

  document.documentElement.setAttribute('data-theme', theme)
}

export const PREFS_KEY = KEY
