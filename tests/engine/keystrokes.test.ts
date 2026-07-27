import { describe, expect, it } from 'vitest'

import {
  charStates,
  classifyKey,
  isBlockedInputType,
  isCompositionInputType,
  isVirtualKey,
  isWordClean,
} from '../../src/engine'
import type { WordState } from '../../src/engine'

import { press } from './helpers'

/** SPEC 1. Input classification, without needing a state to classify against. */

describe('rule 1: printable characters, space, backspace and delete-word', () => {
  it.each(['a', 'Z', '5', '.', ' ', '-'])('accepts %s as a character', (key) => {
    expect(classifyKey(press(key, 0))).toEqual({ kind: 'char', char: key })
  })

  it('accepts a bare Backspace', () => {
    expect(classifyKey(press('Backspace', 0))).toEqual({ kind: 'backspace' })
  })

  it.each([
    ['control', { ctrlKey: true }],
    ['command', { metaKey: true }],
    ['option', { altKey: true }],
  ])('reads %s + Backspace as delete-word', (_label, modifier) => {
    expect(classifyKey(press('Backspace', 0, modifier))).toEqual({ kind: 'delete-word' })
  })
})

describe('rule 1: modifier-only keys are ignored and not logged', () => {
  it.each([
    'Shift',
    'Control',
    'Alt',
    'Meta',
    'CapsLock',
    'Tab',
    'Enter',
    'Escape',
    'ArrowLeft',
    'F1',
    'Dead',
    'Unidentified',
  ])('ignores %s', (key) => {
    expect(classifyKey(press(key, 0))).toEqual({ kind: 'ignore' })
  })
})

describe('rule 1: modifier combinations', () => {
  it('ignores control + a character, which is a shortcut', () => {
    expect(classifyKey(press('a', 0, { ctrlKey: true }))).toEqual({ kind: 'ignore' })
  })

  it('ignores command + a character', () => {
    expect(classifyKey(press('a', 0, { metaKey: true }))).toEqual({ kind: 'ignore' })
  })

  it('accepts control + alt, which is AltGr and produces a real character', () => {
    expect(classifyKey(press('€', 0, { ctrlKey: true, altKey: true }))).toEqual({
      kind: 'char',
      char: '€',
    })
  })

  it('accepts alt alone, which is AltGr or an accent on macOS', () => {
    expect(classifyKey(press('é', 0, { altKey: true }))).toEqual({ kind: 'char', char: 'é' })
  })

  it('accepts shift, because key already carries the shifted character', () => {
    expect(classifyKey(press('A', 0, { shiftKey: true }))).toEqual({ kind: 'char', char: 'A' })
  })
})

describe('rule 1: paste and drop are blocked entirely', () => {
  it.each([
    'insertFromPaste',
    'insertFromPasteAsQuotation',
    'insertFromDrop',
    'insertFromYank',
    'insertReplacementText',
    'insertTranspose',
    'insertLink',
    'deleteByCut',
    'deleteByDrag',
  ])('blocks %s', (inputType) => {
    expect(isBlockedInputType(inputType)).toBe(true)
  })

  it.each(['insertText', 'deleteContentBackward', 'insertCompositionText'])(
    'does not block %s',
    (inputType) => {
      expect(isBlockedInputType(inputType)).toBe(false)
    },
  )
})

describe('rule 1: IME composition is ignored', () => {
  it.each(['insertCompositionText', 'deleteCompositionText'])('detects %s', (inputType) => {
    expect(isCompositionInputType(inputType)).toBe(true)
  })

  it.each(['insertText', 'insertFromPaste'])('leaves %s alone', (inputType) => {
    expect(isCompositionInputType(inputType)).toBe(false)
  })
})

describe('rule 1: virtual keyboard detection', () => {
  it('detects an empty code', () => {
    expect(isVirtualKey({ code: '', keyCode: 65 })).toBe(true)
  })

  it('detects keyCode 229, the IME composition sentinel', () => {
    expect(isVirtualKey({ code: 'KeyA', keyCode: 229 })).toBe(true)
  })

  it('leaves an ordinary physical keydown alone', () => {
    expect(isVirtualKey({ code: 'KeyA', keyCode: 65 })).toBe(false)
  })
})

describe('rule 2: character states are derived, never stored', () => {
  const word = (typed: string, status: WordState['status']): WordState => ({
    text: 'have',
    typed,
    status,
  })

  it('marks typed characters correct or incorrect', () => {
    expect(charStates(word('hzv', 'active'))).toEqual([
      'correct',
      'incorrect',
      'correct',
      'pending',
    ])
  })

  it('marks untyped characters pending while the word is still active', () => {
    expect(charStates(word('ha', 'active'))).toEqual([
      'correct',
      'correct',
      'pending',
      'pending',
    ])
  })

  it('marks untyped characters missed once the word has been advanced past', () => {
    expect(charStates(word('ha', 'done'))).toEqual(['correct', 'correct', 'missed', 'missed'])
  })

  it('marks characters past the end extra', () => {
    expect(charStates(word('havexy', 'active'))).toEqual([
      'correct',
      'correct',
      'correct',
      'correct',
      'extra',
      'extra',
    ])
  })

  it('leaves a pending word entirely pending', () => {
    expect(charStates(word('', 'pending'))).toEqual([
      'pending',
      'pending',
      'pending',
      'pending',
    ])
  })
})

describe('rule 3: a word is locked only when it is exactly right', () => {
  it('locks an exact word', () => {
    expect(isWordClean({ text: 'have', typed: 'have', status: 'done' })).toBe(true)
  })

  it.each([
    ['a wrong character', 'hzve'],
    ['a missing character', 'hav'],
    ['an extra character', 'haves'],
  ])('unlocks a word with %s', (_label, typed) => {
    expect(isWordClean({ text: 'have', typed, status: 'done' })).toBe(false)
  })
})
