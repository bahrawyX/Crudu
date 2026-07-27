import { VIRTUAL_KEY_CODE } from './constants'
import type { CharState, KeyInput, Keystroke, WordState } from './types'

/**
 * Input classification and log helpers. Pure functions, no DOM, no clock.
 *
 * The test surface calls the predicates here from its beforeinput handler and
 * hands the engine a flattened KeyInput from its keydown handler. Keeping the
 * classification out of the reducer means every rule in SPEC 1 can be tested
 * without building a test state first.
 */

/** What the engine will do with a keydown. SPEC 1.2 and 1.3. */
export type KeyAction =
  | { readonly kind: 'char'; readonly char: string }
  | { readonly kind: 'backspace' }
  | { readonly kind: 'delete-word' }
  | { readonly kind: 'ignore' }

const IGNORE = { kind: 'ignore' } as const
const BACKSPACE = { kind: 'backspace' } as const
const DELETE_WORD = { kind: 'delete-word' } as const

/**
 * beforeinput types the surface must preventDefault. Paste is blocked entirely;
 * so are drop, yank, cut and the autocorrect-style replacements, all of which
 * would insert text the user never typed and whose timing means nothing.
 */
const BLOCKED_INPUT_TYPES = new Set([
  'insertFromPaste',
  'insertFromPasteAsQuotation',
  'insertFromDrop',
  'insertFromYank',
  'insertReplacementText',
  'insertTranspose',
  'insertLink',
  'deleteByCut',
  'deleteByDrag',
])

/** IME composition. The composed text arrives afterwards as ordinary keydowns. */
const COMPOSITION_INPUT_TYPES = new Set(['insertCompositionText', 'deleteCompositionText'])

export function isBlockedInputType(inputType: string): boolean {
  return BLOCKED_INPUT_TYPES.has(inputType)
}

export function isCompositionInputType(inputType: string): boolean {
  return COMPOSITION_INPUT_TYPES.has(inputType)
}

/**
 * A soft keyboard or an IME. An empty `code` means the event carries no
 * physical key identity, and keyCode 229 is the composition sentinel.
 */
export function isVirtualKey(input: Pick<KeyInput, 'code' | 'keyCode'>): boolean {
  return input.code === '' || input.keyCode === VIRTUAL_KEY_CODE
}

/**
 * AltGr. Windows reports it as Control and Alt together, and it produces real
 * characters, so it must not be filtered out with the other Control shortcuts.
 */
function isAltGraph(input: KeyInput): boolean {
  return input.ctrlKey && input.altKey
}

export function classifyKey(input: KeyInput): KeyAction {
  if (input.key === 'Backspace') {
    // Control, Command and Option all bind delete-word on one platform or another.
    return input.ctrlKey || input.metaKey || input.altKey ? DELETE_WORD : BACKSPACE
  }

  // A Control or Command chord is a shortcut, not typing. AltGr is the exception:
  // it sets ctrlKey on Windows while producing an ordinary character.
  if ((input.ctrlKey || input.metaKey) && !isAltGraph(input)) {
    return IGNORE
  }

  // Every named key — Shift, Control, Tab, Enter, Escape, ArrowLeft, F1 — reports
  // a `key` longer than one character. Modifier-only keys need no list of their
  // own; this rejects them along with everything else that is not a character.
  if (input.key.length !== 1) {
    return IGNORE
  }

  return { kind: 'char', char: input.key }
}

/**
 * Per-character state for one word. Derived on demand rather than stored, so a
 * word carries only its expected text, what was typed, and whether the user
 * moved past it.
 */
export function charStates(word: WordState): readonly CharState[] {
  const length = Math.max(word.text.length, word.typed.length)
  const states: CharState[] = []

  for (let i = 0; i < length; i += 1) {
    if (i >= word.text.length) {
      states.push('extra')
      continue
    }

    if (i >= word.typed.length) {
      states.push(word.status === 'done' ? 'missed' : 'pending')
      continue
    }

    states.push(word.typed[i] === word.text[i] ? 'correct' : 'incorrect')
  }

  return states
}

/** A word is locked against backspacing into it only when it is exactly right. */
export function isWordClean(word: WordState): boolean {
  return word.typed === word.text
}

type CharEntry = {
  readonly c: string
  readonly e: string
  readonly t: number
  readonly ok: boolean
  readonly repeat: boolean
  readonly pauses: number
}

export function charKeystroke(entry: CharEntry): Keystroke {
  return { kind: 'char', ...entry }
}

export function missedKeystroke(expected: string, t: number, pauses: number): Keystroke {
  return { kind: 'missed', c: '', e: expected, t, ok: false, repeat: false, pauses }
}

export function editKeystroke(
  kind: 'backspace' | 'delete-word',
  t: number,
  pauses: number,
): Keystroke {
  return { kind, c: '', e: '', t, ok: false, repeat: false, pauses }
}
