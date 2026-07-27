import type { KeyInput, TestConfig, WordSource } from '../../src/engine'

/**
 * Shared fixtures for the engine suites. Not a test file: vitest collects
 * tests/**\/*.test.ts only.
 */

const CODES: Record<string, string> = {
  ' ': 'Space',
  Backspace: 'Backspace',
}

function codeFor(key: string): string {
  const known = CODES[key]

  if (known !== undefined) {
    return known
  }

  return /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : `Char${key.charCodeAt(0).toString()}`
}

/** A physical keydown. Overrides cover every modifier and the repeat flag. */
export function press(
  key: string,
  timeStamp: number,
  overrides: Partial<KeyInput> = {},
): KeyInput {
  return {
    key,
    code: codeFor(key),
    keyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 8,
    timeStamp,
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides,
  }
}

/** A soft-keyboard keydown: no physical key identity, IME sentinel keyCode. */
export function softPress(key: string, timeStamp: number): KeyInput {
  return press(key, timeStamp, { code: '', keyCode: 229 })
}

export function timeConfig(seconds = 30): TestConfig {
  return { mode: 'time', value: seconds, punctuation: false, numbers: false, adaptive: false }
}

export function wordsConfig(count: number): TestConfig {
  return { mode: 'words', value: count, punctuation: false, numbers: false, adaptive: false }
}

/** Hands out a fixed list once, then nothing. Words mode never asks twice. */
export function fixedWords(words: readonly string[]): WordSource {
  let served = false

  return () => {
    if (served) {
      return []
    }

    served = true

    return words
  }
}

/** Endless supply for time mode, cycling a short list so words stay predictable. */
export function cyclingWords(words: readonly string[], lead: readonly string[] = []): WordSource {
  let index = 0
  let leadIndex = 0

  return (count) => {
    const out: string[] = []

    while (out.length < count) {
      if (leadIndex < lead.length) {
        out.push(lead[leadIndex] ?? '')
        leadIndex += 1
        continue
      }

      out.push(words[index % words.length] ?? '')
      index += 1
    }

    return out
  }
}

/** Types a string as characters, one every `intervalMs`, starting at `from`. */
export function typeSequence(
  text: string,
  from: number,
  intervalMs: number,
): readonly KeyInput[] {
  return [...text].map((char, index) => press(char, from + index * intervalMs))
}
