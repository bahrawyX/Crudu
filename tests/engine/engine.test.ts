import { describe, expect, it, vi } from 'vitest'

import { createEngine, resultDurationMs } from '../../src/engine'
import type { Engine } from '../../src/engine'

import { cyclingWords, fixedWords, press, softPress, timeConfig, wordsConfig } from './helpers'

/** SPEC 7 and 8. The subscription surface and the result. */

function wordsEngine(words: readonly string[]): Engine {
  return createEngine({
    config: wordsConfig(words.length),
    wordSource: fixedWords(words),
    id: 'run-1',
    startedAt: 1_700_000_000_000,
  })
}

function type(engine: Engine, text: string, from = 0, step = 100): void {
  let at = from

  for (const char of text) {
    engine.input(press(char, at))
    at += step
  }
}

describe('rule 7: a keystroke marks one word dirty, never the tree', () => {
  it('reports the single index a character touched', () => {
    const engine = wordsEngine(['hello', 'there'])
    const seen: number[][] = []

    engine.subscribe((change) => {
      seen.push([...change.dirtyWords])
    })

    type(engine, 'he')

    expect(seen).toEqual([[0], [0]])
  })

  it('reports two indices when a space crosses a boundary', () => {
    const engine = wordsEngine(['hi', 'there'])
    const seen: number[][] = []

    engine.subscribe((change) => {
      seen.push([...change.dirtyWords])
    })

    type(engine, 'hi ')

    expect(seen.at(-1)).toEqual([0, 1])
  })

  it('calls only the listeners for the words that changed', () => {
    const engine = wordsEngine(['hi', 'there'])
    const first = vi.fn()
    const second = vi.fn()

    engine.subscribeToWord(0, first)
    engine.subscribeToWord(1, second)

    type(engine, 'h')

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()

    type(engine, 'i ', 100)

    expect(second).toHaveBeenCalledTimes(1)
  })

  it('supports several listeners on one word and unsubscribes cleanly', () => {
    const engine = wordsEngine(['hello'])
    const first = vi.fn()
    const second = vi.fn()

    const off = engine.subscribeToWord(0, first)

    engine.subscribeToWord(0, second)

    type(engine, 'h')
    off()
    type(engine, 'e', 100)

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(2)
  })

  it('forgets a word entirely once its last listener goes', () => {
    const engine = wordsEngine(['hello'])
    const listener = vi.fn()
    const off = engine.subscribeToWord(0, listener)

    type(engine, 'h')
    off()
    type(engine, 'e', 100)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('notifies status listeners when a boundary is crossed', () => {
    const engine = wordsEngine(['hi', 'there'])
    const status = vi.fn()

    engine.subscribeToStatus(status)
    type(engine, 'hi ')

    expect(status).toHaveBeenCalled()
    expect(engine.getStatusSnapshot().wordIndex).toBe(1)
  })

  it('unsubscribes the change and status listeners too', () => {
    const engine = wordsEngine(['hello'])
    const change = vi.fn()
    const status = vi.fn()

    engine.subscribe(change)()
    engine.subscribeToStatus(status)()

    type(engine, 'he')

    expect(change).not.toHaveBeenCalled()
    expect(status).not.toHaveBeenCalled()
  })
})

describe('rule 7: snapshots are identity stable', () => {
  it('returns the same word object until that word changes', () => {
    const engine = wordsEngine(['hi', 'there'])
    const before = engine.getWordSnapshot(1)

    type(engine, 'h')

    expect(engine.getWordSnapshot(1)).toBe(before)
    expect(engine.getWordSnapshot(0)).not.toBe(before)
  })

  it('returns undefined for an index that does not exist', () => {
    expect(wordsEngine(['hi']).getWordSnapshot(9)).toBeUndefined()
  })

  it('returns the same status object until the status actually changes', () => {
    const engine = wordsEngine(['hello'])

    type(engine, 'h')

    const snapshot = engine.getStatusSnapshot()

    type(engine, 'e', 100)

    expect(engine.getStatusSnapshot()).toBe(snapshot)
  })

  it('does not emit a status change for an ordinary keystroke', () => {
    const engine = wordsEngine(['hello'])
    const status = vi.fn()

    type(engine, 'h')
    engine.subscribeToStatus(status)
    type(engine, 'e', 100)

    expect(status).not.toHaveBeenCalled()
  })

  it('reports remaining time and remaining words', () => {
    const engine = createEngine({
      config: timeConfig(30),
      wordSource: cyclingWords(['aaaa']),
      id: 'run-1',
      startedAt: 0,
    })

    type(engine, 'aaaa ', 0, 100)

    const snapshot = engine.getStatusSnapshot()

    expect(snapshot.remainingMs).toBe(30_000 - 400)
    expect(snapshot.remainingWords).toBe(snapshot.wordCount - 1)
    expect(snapshot.inputSource).toBe('physical')
  })

  it('reports no remaining time in words mode', () => {
    expect(wordsEngine(['hi']).getStatusSnapshot().remainingMs).toBe(0)
  })

  it('keeps topping up a source that hands out less than a full chunk', () => {
    // A generator is free to return fewer words than asked for. The engine has
    // to keep asking rather than assume one call filled the runway.
    const engine = createEngine({
      config: timeConfig(60),
      wordSource: () => ['aaaa', 'bbbb'],
      id: 'run-3',
      startedAt: 0,
    })

    expect(engine.getState().words).toHaveLength(2)

    type(engine, 'aa', 0, 100)

    expect(engine.getState().words.length).toBeGreaterThan(2)
  })
})

describe('rule 8: the result', () => {
  it('is null until the test completes', () => {
    const engine = wordsEngine(['hi'])

    type(engine, 'h')

    expect(engine.getResult()).toBeNull()
  })

  it('carries the log, the config and the derived metrics', () => {
    const engine = wordsEngine(['hi'])

    type(engine, 'hi', 0, 250)

    const result = engine.getResult()

    expect(result?.id).toBe('run-1')
    expect(result?.startedAt).toBe(1_700_000_000_000)
    expect(result?.config.mode).toBe('words')
    expect(result?.inputSource).toBe('physical')
    expect(result?.keystrokes).toHaveLength(2)
    expect(result?.derived.chars).toEqual({ correct: 2, incorrect: 0, extra: 0, missed: 0 })
  })

  it('is cached, so a history view does not recompute it', () => {
    const engine = wordsEngine(['hi'])

    type(engine, 'hi')

    expect(engine.getResult()).toBe(engine.getResult())
  })

  it('tags a virtual test and withholds its bigrams', () => {
    const engine = wordsEngine(['hi'])

    engine.input(softPress('h', 0))
    engine.input(press('i', 150))

    expect(engine.getResult()?.inputSource).toBe('virtual')
    expect(engine.getBigrams()).toEqual([])
  })

  it('reports bigrams for a physical test', () => {
    const engine = wordsEngine(['hi'])

    type(engine, 'hi', 0, 150)

    expect(engine.getBigrams()).toEqual([{ pair: 'hi', latencyMs: 150 }])
  })

  it('measures time mode by its configuration and words mode by its log', () => {
    const engine = wordsEngine(['hi'])

    type(engine, 'hi', 0, 250)

    expect(resultDurationMs(engine.getState())).toBe(250)

    const timed = createEngine({
      config: timeConfig(15),
      wordSource: cyclingWords(['aaaa']),
      id: 'run-2',
      startedAt: 0,
    })

    expect(resultDurationMs(timed.getState())).toBe(15_000)
  })

  it('reports a zero duration for a words test with no keystrokes', () => {
    expect(resultDurationMs(wordsEngine(['hi']).getState())).toBe(0)
  })
})

describe('reset', () => {
  it('clears the log, the words and the result', () => {
    const engine = wordsEngine(['hi'])

    type(engine, 'hi')
    expect(engine.getResult()).not.toBeNull()

    engine.reset({ wordSource: fixedWords(['go']), id: 'run-2' })

    const state = engine.getState()

    expect(state.status).toBe('idle')
    expect(state.log).toHaveLength(0)
    expect(state.id).toBe('run-2')
    expect(state.words.map((word) => word.text)).toEqual(['go'])
    expect(engine.getResult()).toBeNull()
  })

  it('keeps the previous options when called with none', () => {
    const engine = createEngine({
      config: wordsConfig(1),
      wordSource: cyclingWords(['hi']),
      id: 'run-1',
      startedAt: 42,
    })

    type(engine, 'hi')
    engine.reset()

    const state = engine.getState()

    expect(state.id).toBe('run-1')
    expect(state.startedAtEpoch).toBe(42)
    expect(state.config.mode).toBe('words')
    expect(state.words).toHaveLength(1)
  })

  it('accepts a new config and a new start time', () => {
    const engine = wordsEngine(['hi'])

    engine.reset({ config: timeConfig(15), wordSource: cyclingWords(['aaaa']), startedAt: 99 })

    const state = engine.getState()

    expect(state.config.mode).toBe('time')
    expect(state.startedAtEpoch).toBe(99)
    expect(state.words).toHaveLength(50)
  })

  it('marks every word dirty', () => {
    const engine = wordsEngine(['hi', 'go'])
    const seen: number[][] = []

    engine.subscribe((change) => {
      seen.push([...change.dirtyWords])
    })

    engine.reset({ wordSource: fixedWords(['a', 'b', 'c']) })

    expect(seen.at(-1)).toEqual([0, 1, 2])
  })
})
