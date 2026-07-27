import { describe, expect, it } from 'vitest'

import { EXTRA_CHARS_LIMIT, createEngine, createInitialState, reduce } from '../../src/engine'
import type { Engine, KeyInput, Keystroke } from '../../src/engine'

import { cyclingWords, fixedWords, press, softPress, timeConfig, wordsConfig } from './helpers'

function drive(engine: Engine, inputs: readonly KeyInput[]): void {
  for (const input of inputs) {
    engine.input(input)
  }
}

/** Types a literal string, one character every `step` ms from `from`. */
function type(engine: Engine, text: string, from = 0, step = 100): number {
  let at = from

  for (const char of text) {
    engine.input(press(char, at))
    at += step
  }

  return at
}

function wordsEngine(words: readonly string[], count = words.length): Engine {
  return createEngine({
    config: wordsConfig(count),
    wordSource: fixedWords(words),
    id: 'test',
    startedAt: 0,
  })
}

function timeEngine(seconds: number, lead: readonly string[] = []): Engine {
  return createEngine({
    config: timeConfig(seconds),
    wordSource: cyclingWords(['aaaa'], lead),
    id: 'test',
    startedAt: 0,
  })
}

const typedOf = (engine: Engine): readonly string[] =>
  engine.getState().words.map((word) => word.typed)

const kinds = (log: readonly Keystroke[]): readonly string[] => log.map((entry) => entry.kind)

// ---------------------------------------------------------------- rule 1 ----

describe('rule 1: input', () => {
  it('starts the test on the first accepted character, which becomes t = 0', () => {
    const engine = wordsEngine(['the'])

    engine.input(press('t', 5_000))

    expect(engine.getState().status).toBe('running')
    expect(engine.getState().log[0]?.t).toBe(0)
  })

  it('ignores a leading space: no state change, no log entry, no start', () => {
    const engine = wordsEngine(['the'])

    engine.input(press(' ', 1_000))

    expect(engine.getState().status).toBe('idle')
    expect(engine.getState().log).toHaveLength(0)
    expect(engine.getState().wordIndex).toBe(0)
  })

  it('does not log modifier-only keys', () => {
    const engine = wordsEngine(['the'])

    drive(engine, [press('Shift', 0), press('Control', 10), press('F5', 20)])

    expect(engine.getState().log).toHaveLength(0)
    expect(engine.getState().status).toBe('idle')
  })

  it('counts a held key as a character but marks it repeat', () => {
    const engine = wordsEngine(['tt'])

    engine.input(press('t', 0))
    engine.input(press('t', 40, { repeat: true }))

    expect(typedOf(engine)[0]).toBe('tt')
    expect(engine.getState().log[1]?.repeat).toBe(true)
  })

  it('tags the whole test virtual on one soft keystroke, and never reverts', () => {
    const engine = wordsEngine(['ab'])

    engine.input(softPress('a', 0))
    engine.input(press('b', 100))

    expect(engine.getState().inputSource).toBe('virtual')
  })

  it('tags virtual even from a keystroke the classifier throws away', () => {
    const engine = wordsEngine(['ab'])

    engine.input(softPress('Unidentified', 0))

    expect(engine.getState().inputSource).toBe('virtual')
    expect(engine.getState().log).toHaveLength(0)
  })

  it('ignores every input once the test is complete', () => {
    const engine = wordsEngine(['ab'])

    type(engine, 'ab')

    expect(engine.getState().status).toBe('complete')

    engine.input(press('c', 500))

    expect(engine.getState().log).toHaveLength(2)
  })
})

// ---------------------------------------------------------------- rule 2 ----

describe('rule 2: word boundaries', () => {
  it('advances on space and marks the remainder missed', () => {
    const engine = wordsEngine(['hello', 'there'])

    type(engine, 'hel ')

    const state = engine.getState()

    expect(state.wordIndex).toBe(1)
    expect(state.words[0]?.status).toBe('done')
    expect(state.words[1]?.status).toBe('active')
    expect(kinds(state.log)).toEqual(['char', 'char', 'char', 'char', 'missed', 'missed'])
    expect(state.log.filter((entry) => entry.kind === 'missed').map((entry) => entry.e)).toEqual([
      'l',
      'o',
    ])
  })

  it('logs the missed batch at the timestamp of the space that caused it', () => {
    const engine = wordsEngine(['hello', 'there'])

    type(engine, 'hel ', 0, 100)

    const missed = engine.getState().log.filter((entry) => entry.kind === 'missed')

    expect(missed.every((entry) => entry.t === 300)).toBe(true)
  })

  it('marks the boundary space incorrect when the word was not exactly right', () => {
    const engine = wordsEngine(['hello', 'there'])

    type(engine, 'hel ')

    const space = engine.getState().log[3]

    expect(space?.c).toBe(' ')
    expect(space?.ok).toBe(false)
  })

  it('marks the boundary space correct when the word was exactly right', () => {
    const engine = wordsEngine(['hi', 'there'])

    type(engine, 'hi ')

    expect(engine.getState().log[2]?.ok).toBe(true)
  })

  it('records characters past the end of a word as extra', () => {
    const engine = wordsEngine(['hi', 'there'])

    type(engine, 'hixy')

    const state = engine.getState()

    expect(state.words[0]?.typed).toBe('hixy')
    expect(state.log[2]?.e).toBe('')
    expect(state.log[2]?.ok).toBe(false)
  })

  it('caps extra characters at word length plus ten and discards the rest silently', () => {
    const engine = wordsEngine(['hi', 'there'])

    type(engine, `hi${'x'.repeat(EXTRA_CHARS_LIMIT + 5)}`)

    const state = engine.getState()

    expect(state.words[0]?.typed).toHaveLength(2 + EXTRA_CHARS_LIMIT)
    expect(state.log).toHaveLength(2 + EXTRA_CHARS_LIMIT)
  })
})

// ---------------------------------------------------------------- rule 3 ----

describe('rule 3: backspace', () => {
  it('is always allowed inside the current word', () => {
    const engine = wordsEngine(['hello'])

    type(engine, 'hel')
    engine.input(press('Backspace', 400))

    expect(typedOf(engine)[0]).toBe('he')
    expect(kinds(engine.getState().log).at(-1)).toBe('backspace')
  })

  it('is locked out of a previous word that was typed exactly', () => {
    const engine = wordsEngine(['hi', 'there'])

    type(engine, 'hi ')
    engine.input(press('Backspace', 400))

    const state = engine.getState()

    expect(state.wordIndex).toBe(1)
    expect(kinds(state.log)).not.toContain('backspace')
  })

  it('crosses into a previous word that has an error, marking two words dirty', () => {
    const engine = wordsEngine(['hi', 'there'])
    const dirty: number[][] = []

    engine.subscribe((change) => {
      dirty.push([...change.dirtyWords])
    })

    type(engine, 'hz ')
    engine.input(press('Backspace', 400))

    const state = engine.getState()

    expect(state.wordIndex).toBe(0)
    expect(state.words[0]?.status).toBe('active')
    expect(state.words[1]?.status).toBe('pending')
    expect(dirty.at(-1)).toEqual([0, 1])
  })

  it('crosses into a word left incomplete, because missed characters are errors', () => {
    const engine = wordsEngine(['hello', 'there'])

    type(engine, 'hel ')
    engine.input(press('Backspace', 400))

    expect(engine.getState().wordIndex).toBe(0)
    expect(engine.getState().words[0]?.typed).toBe('hel')
  })

  it('does nothing at the very start of the first word', () => {
    const engine = wordsEngine(['hi'])

    engine.input(press('Backspace', 0))

    expect(engine.getState().log).toHaveLength(0)
    expect(engine.getState().status).toBe('idle')
  })

  it('deletes to the start of the current word on control + backspace', () => {
    const engine = wordsEngine(['hello'])

    type(engine, 'hell')
    engine.input(press('Backspace', 500, { ctrlKey: true }))

    expect(typedOf(engine)[0]).toBe('')
    expect(kinds(engine.getState().log).at(-1)).toBe('delete-word')
  })

  it('deletes the previous word when already at the start, subject to the lock', () => {
    const engine = wordsEngine(['hi', 'there'])

    type(engine, 'hz ')
    engine.input(press('Backspace', 400, { metaKey: true }))

    const state = engine.getState()

    expect(state.wordIndex).toBe(0)
    expect(state.words[0]?.typed).toBe('')
  })

  it('refuses to delete a previous word that is clean', () => {
    const engine = wordsEngine(['hi', 'there'])

    type(engine, 'hi ')
    engine.input(press('Backspace', 400, { ctrlKey: true }))

    expect(engine.getState().wordIndex).toBe(1)
    expect(kinds(engine.getState().log)).not.toContain('delete-word')
  })
})

// ---------------------------------------------------------------- rule 4 ----

describe('rule 4: test end', () => {
  it('ends time mode on the timestamp, mid-word', () => {
    const engine = timeEngine(1, ['abcd'])

    type(engine, 'ab', 0, 100)
    engine.tick(1_200)

    const state = engine.getState()

    expect(state.status).toBe('complete')
    expect(state.words[0]?.status).toBe('active')
  })

  it('discards a keystroke that arrives at or after expiry', () => {
    const engine = timeEngine(1, ['abcd'])

    type(engine, 'ab', 0, 100)
    engine.input(press('c', 1_000))

    expect(engine.getState().status).toBe('complete')
    expect(engine.getState().log).toHaveLength(2)
  })

  it('leaves the untyped characters of the partial word pending, never missed', () => {
    const engine = timeEngine(1, ['abcd'])

    type(engine, 'ab', 0, 100)
    engine.tick(1_500)

    expect(engine.getState().log.some((entry) => entry.kind === 'missed')).toBe(false)
  })

  it('ends words mode on the final character, with no trailing space', () => {
    const engine = wordsEngine(['hi', 'go'], 2)

    type(engine, 'hi go')

    expect(engine.getState().status).toBe('complete')
    expect(engine.getState().log).toHaveLength(5)
  })

  it('does not end words mode on an incorrect final character', () => {
    const engine = wordsEngine(['hi', 'go'], 2)

    type(engine, 'hi gz')

    expect(engine.getState().status).toBe('running')

    engine.input(press('Backspace', 600))
    engine.input(press('o', 700))

    expect(engine.getState().status).toBe('complete')
  })

  it('ends words mode when space is pressed on the last word', () => {
    const engine = wordsEngine(['hi', 'go'], 2)

    type(engine, 'hi g ')

    expect(engine.getState().status).toBe('complete')
    expect(engine.getState().words[1]?.status).toBe('done')
  })

  it('generates time-mode words lazily and tops up as the cursor advances', () => {
    const engine = timeEngine(60)

    expect(engine.getState().words).toHaveLength(50)

    type(engine, 'aaaa ')

    expect(engine.getState().words.length).toBeGreaterThan(50)
  })

  it('stops topping up once a word source runs dry', () => {
    const engine = createEngine({
      config: timeConfig(60),
      wordSource: fixedWords(['aa', 'bb']),
      id: 'test',
      startedAt: 0,
    })

    // The trailing space runs off the end of the list, which is the only way a
    // time-mode test can finish early: there is nothing left to type.
    type(engine, 'aa bb ')

    expect(engine.getState().status).toBe('complete')
    expect(engine.getState().words).toHaveLength(2)
  })

  it('survives a word source that returns nothing at all', () => {
    const engine = createEngine({
      config: wordsConfig(0),
      wordSource: fixedWords([]),
      id: 'test',
      startedAt: 0,
    })

    engine.input(press('a', 0))
    engine.input(press('Backspace', 100))

    expect(engine.getState().log).toHaveLength(0)
  })
})

// ---------------------------------------------------------------- rule 5 ----

describe('rule 5: timing', () => {
  it('takes every timestamp from the caller', () => {
    const engine = wordsEngine(['abc'])

    drive(engine, [press('a', 10_000), press('b', 10_250), press('c', 10_600)])

    expect(engine.getState().log.map((entry) => entry.t)).toEqual([0, 250, 600])
  })

  it('excludes paused spans from elapsed time', () => {
    const engine = timeEngine(30, ['abcd'])

    engine.input(press('a', 1_000))
    engine.pause(2_000)
    engine.resume(12_000)
    engine.input(press('b', 12_500))

    expect(engine.getState().log[1]?.t).toBe(1_500)
    expect(engine.getState().pausedTotalMs).toBe(10_000)
  })

  it('freezes the clock while paused', () => {
    const engine = timeEngine(30, ['abcd'])

    engine.input(press('a', 1_000))
    engine.pause(2_000)
    engine.tick(9_000)

    expect(engine.getStatusSnapshot().elapsedMs).toBe(1_000)
    expect(engine.getState().status).toBe('paused')
  })

  it('resumes on a keystroke, because the design says press any key to resume', () => {
    const engine = timeEngine(30, ['abcd'])

    engine.input(press('a', 1_000))
    engine.pause(2_000)
    engine.input(press('b', 12_000))

    const state = engine.getState()

    expect(state.status).toBe('running')
    expect(state.words[0]?.typed).toBe('ab')
    expect(state.log[1]?.t).toBe(1_000)
  })

  it('ignores a pause that arrives when nothing is running', () => {
    const engine = wordsEngine(['abc'])

    engine.pause(500)

    expect(engine.getState().status).toBe('idle')
  })

  it('ignores a resume that arrives when nothing is paused', () => {
    const engine = wordsEngine(['abc'])

    engine.input(press('a', 0))
    engine.resume(500)

    expect(engine.getState().status).toBe('running')
    expect(engine.getState().pauses).toBe(0)
  })

  it('completes rather than pausing when the blur lands after expiry', () => {
    const engine = timeEngine(1, ['abcd'])

    engine.input(press('a', 0))
    engine.pause(2_000)

    expect(engine.getState().status).toBe('complete')
  })

  it('ignores a tick while paused or idle', () => {
    const engine = timeEngine(1, ['abcd'])

    engine.tick(50_000)

    expect(engine.getState().status).toBe('idle')

    engine.input(press('a', 0))
    engine.pause(100)
    engine.tick(50_000)

    expect(engine.getState().status).toBe('paused')
  })

  it('clamps a timestamp that goes backwards', () => {
    const engine = wordsEngine(['abc'])

    drive(engine, [press('a', 1_000), press('b', 1_500), press('c', 900)])

    const times = engine.getState().log.map((entry) => entry.t)

    expect(times).toEqual([0, 500, 500])
    expect(times.every((t) => t >= 0)).toBe(true)
  })
})

// ------------------------------------------------------- reducer directly ----

describe('the reducer is pure and total', () => {
  it('reports every index dirty on reset', () => {
    const state = createInitialState(wordsConfig(3), ['a', 'b', 'c'], 'one', 0)
    const outcome = reduce(state, {
      type: 'reset',
      config: wordsConfig(2),
      words: ['x', 'y'],
      id: 'two',
      startedAtEpoch: 5,
    })

    expect(outcome.dirtyWords).toEqual([0, 1])
    expect(outcome.statusChanged).toBe(true)
    expect(outcome.state.id).toBe('two')
    expect(outcome.state.startedAtEpoch).toBe(5)
  })

  it('reports no change for an action that does nothing', () => {
    const state = createInitialState(wordsConfig(1), ['a'], 'one', 0)
    const outcome = reduce(state, { type: 'resume', timeStamp: 10 })

    expect(outcome.state).toBe(state)
    expect(outcome.dirtyWords).toEqual([])
    expect(outcome.statusChanged).toBe(false)
  })

  it('ignores an empty append', () => {
    const state = createInitialState(timeConfig(30), ['a'], 'one', 0)

    expect(reduce(state, { type: 'appendWords', words: [] }).state).toBe(state)
  })

  it('ignores an append once the test is complete', () => {
    const state = createInitialState(wordsConfig(1), ['a'], 'one', 0)
    const running = reduce(state, { type: 'key', input: press('a', 0) }).state

    expect(running.status).toBe('complete')
    expect(reduce(running, { type: 'appendWords', words: ['b'] }).state.words).toHaveLength(1)
  })

  it('appends without marking any existing word dirty', () => {
    const state = createInitialState(timeConfig(30), ['a'], 'one', 0)
    const outcome = reduce(state, { type: 'appendWords', words: ['b', 'c'] })

    expect(outcome.dirtyWords).toEqual([])
    expect(outcome.statusChanged).toBe(true)
    expect(outcome.state.words).toHaveLength(3)
  })

  it('does not report a status change for an ordinary keystroke inside a word', () => {
    const state = createInitialState(wordsConfig(1), ['abc'], 'one', 0)
    const first = reduce(state, { type: 'key', input: press('a', 0) })
    const second = reduce(first.state, { type: 'key', input: press('b', 100) })

    expect(second.statusChanged).toBe(false)
    expect(second.dirtyWords).toEqual([0])
  })

  it('reports a status change when the elapsed second rolls over', () => {
    const state = createInitialState(timeConfig(30), ['abc'], 'one', 0)
    const first = reduce(state, { type: 'key', input: press('a', 0) })
    const second = reduce(first.state, { type: 'key', input: press('b', 1_100) })

    expect(second.statusChanged).toBe(true)
  })

  it('reports a status change when the input source flips', () => {
    const state = createInitialState(wordsConfig(1), ['abc'], 'one', 0)
    const first = reduce(state, { type: 'key', input: press('a', 0) })
    const second = reduce(first.state, { type: 'key', input: softPress('b', 100) })

    expect(second.statusChanged).toBe(true)
  })
})
