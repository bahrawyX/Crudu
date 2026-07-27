import { describe, expect, it, vi } from 'vitest'

import { createSurfaceStore } from '../src/components/test/surfaceStore'
import { createEngine } from '../src/engine'
import type { Engine } from '../src/engine'

import { fixedWords, press, wordsConfig } from './engine/helpers'

/**
 * The store between the engine and the paint.
 *
 * Its three channels exist so that the things which change on every keystroke
 * (the caret) are separate from the things that almost never change (the line
 * layout), and neither drags React through the other.
 */

function surface(words: readonly string[], capacity: number) {
  const engine: Engine = createEngine({
    config: wordsConfig(words.length),
    wordSource: fixedWords(words),
    id: 'surface',
    startedAt: 0,
  })
  const store = createSurfaceStore(engine, capacity)
  const stop = store.start()

  return { engine, store, stop }
}

function type(engine: Engine, text: string, from = 0): void {
  let at = from

  for (const char of text) {
    engine.input(press(char, at))
    at += 100
  }
}

describe('caret channel', () => {
  it('advances one column per character', () => {
    const { engine, store, stop } = surface(['hello', 'there'], 62)

    type(engine, 'he')

    expect(store.getCaret()).toEqual({ column: 2, line: 0, scrollRow: 0 })

    stop()
  })

  it('crosses the word gap on a space', () => {
    const { engine, store, stop } = surface(['hello', 'there'], 62)

    type(engine, 'hello ')

    // 'hello' is five characters, then one for the space.
    expect(store.getCaret().column).toBe(6)

    stop()
  })

  it('notifies on every move and only on a move', () => {
    const { engine, store, stop } = surface(['hello'], 62)
    const listener = vi.fn()

    store.subscribeToCaret(listener)

    type(engine, 'he')

    expect(listener).toHaveBeenCalledTimes(2)

    // A modifier changes nothing, so nothing is notified.
    engine.input(press('Shift', 500))

    expect(listener).toHaveBeenCalledTimes(2)

    stop()
  })
})

describe('line channel', () => {
  it('fires only when the caret changes line', () => {
    const { engine, store, stop } = surface(['aaa', 'bbb', 'ccc'], 7)
    const listener = vi.fn()

    store.subscribeToLine(listener)

    type(engine, 'aaa ')

    // 'aaa bbb' is exactly seven characters, so word two is still on line zero.
    expect(listener).not.toHaveBeenCalled()
    expect(store.getLine()).toBe(0)

    type(engine, 'bbb ', 1_000)

    expect(store.getLine()).toBe(1)
    expect(listener).toHaveBeenCalledTimes(1)

    stop()
  })
})

describe('layout channel', () => {
  it('stays quiet while words render at their expected width', () => {
    const { engine, store, stop } = surface(['hello', 'there'], 62)
    const listener = vi.fn()

    store.subscribeToLayout(listener)

    type(engine, 'hello ther')

    expect(listener).not.toHaveBeenCalled()

    stop()
  })

  it('recomputes when a word grows past its own length', () => {
    const { engine, store, stop } = surface(['hi', 'there'], 62)
    const listener = vi.fn()

    store.subscribeToLayout(listener)

    type(engine, 'hix')

    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getLayout().placements[1]).toEqual({ line: 0, column: 4 })

    stop()
  })

  it('recomputes when the word list grows', () => {
    const engine = createEngine({
      config: { mode: 'time', value: 30, punctuation: false, numbers: false, adaptive: false },
      wordSource: () => ['aa', 'bb'],
      id: 'surface',
      startedAt: 0,
    })
    const store = createSurfaceStore(engine, 62)
    const stop = store.start()
    const listener = vi.fn()

    store.subscribeToLayout(listener)

    type(engine, 'a')

    expect(listener).toHaveBeenCalled()
    expect(store.getWordCount()).toBeGreaterThan(2)

    stop()
  })
})

describe('lifecycle', () => {
  it('does not attach until started, so a discarded store leaks nothing', () => {
    const engine: Engine = createEngine({
      config: wordsConfig(1),
      wordSource: fixedWords(['hello']),
      id: 'surface',
      startedAt: 0,
    })
    const store = createSurfaceStore(engine, 62)
    const listener = vi.fn()

    store.subscribeToCaret(listener)
    type(engine, 'he')

    expect(listener).not.toHaveBeenCalled()
    expect(store.getCaret().column).toBe(0)

    // Starting re-primes from whatever the engine already holds.
    const stop = store.start()

    expect(store.getCaret().column).toBe(2)

    stop()
  })

  it('stops listening once detached', () => {
    const { engine, store, stop } = surface(['hello'], 62)
    const listener = vi.fn()

    store.subscribeToCaret(listener)
    stop()
    type(engine, 'he')

    expect(listener).not.toHaveBeenCalled()
  })

  it('unsubscribes each channel independently', () => {
    const { engine, store, stop } = surface(['hello'], 62)
    const caret = vi.fn()
    const line = vi.fn()
    const layout = vi.fn()

    store.subscribeToCaret(caret)()
    store.subscribeToLine(line)()
    store.subscribeToLayout(layout)()

    type(engine, 'hex')

    expect(caret).not.toHaveBeenCalled()
    expect(line).not.toHaveBeenCalled()
    expect(layout).not.toHaveBeenCalled()

    stop()
  })
})
