import { describe, expect, it } from 'vitest'

import { aggregate, scoreAll } from '../../src/adaptive'
import type { BigramTable } from '../../src/adaptive'
import { createEngine } from '../../src/engine'
import type { Engine } from '../../src/engine'

import { fixedWords, press, softPress, wordsConfig } from '../engine/helpers'

/**
 * The two exclusions, verified through the real engine rather than assumed.
 *
 * Both rules already exist — DECISIONS 1.1 for soft keyboards, 1.6 for pairs
 * that span a blur — and both are the kind of rule that is easy to implement in
 * one layer and lose in the next. What matters is not that the engine drops
 * them but that nothing downstream puts them back, so these drive keystrokes in
 * and read the bigram table out.
 */

function engineFor(words: readonly string[]): Engine {
  return createEngine({
    config: wordsConfig(words.length),
    wordSource: fixedWords(words),
    id: 'e2e',
    startedAt: 0,
  })
}

function observe(engine: Engine, at = 0) {
  return {
    samples: engine.getBigrams(),
    errors: [],
    at,
    inputSource: engine.getState().inputSource,
  }
}

describe('a soft keyboard reaches the bigram table nowhere', () => {
  it('drops the samples at the engine', () => {
    const engine = engineFor(['old'])

    engine.input(softPress('o', 0))
    engine.input(press('l', 150))
    engine.input(press('d', 300))

    expect(engine.getState().inputSource).toBe('virtual')
    expect(engine.getBigrams()).toEqual([])
  })

  it('and the aggregator refuses them again even if they arrive', () => {
    // Belt and braces: hand the aggregator real samples with a virtual tag.
    const table = aggregate(new Map(), {
      samples: [
        { pair: 'ol', latencyMs: 300 },
        { pair: 'ld', latencyMs: 280 },
      ],
      errors: [],
      at: 0,
      inputSource: 'virtual',
    })

    expect(table.size).toBe(0)
  })

  it(`leaves a physical test's samples alone, so the guard is not a mute button`, () => {
    const engine = engineFor(['old'])

    engine.input(press('o', 0))
    engine.input(press('l', 150))
    engine.input(press('d', 300))

    const table = aggregate(new Map(), observe(engine))

    expect([...table.keys()]).toEqual(['ol', 'ld'])
  })
})

describe('a pair that spans a blur never becomes a fast transition', () => {
  it('is dropped even though the gap in test time is tiny', () => {
    const engine = engineFor(['old'])

    engine.input(press('o', 1_000))
    // Two minutes of blur. Paused time is subtracted from t, so without the
    // pause-count rule the pair would read about 20ms apart and enter the table
    // as the fastest transition this user has ever made.
    engine.pause(1_100)
    engine.resume(121_100)
    engine.input(press('l', 121_120))
    engine.input(press('d', 121_300))

    const samples = engine.getBigrams()

    expect(samples.map((sample) => sample.pair)).toEqual(['ld'])
    expect(samples.some((sample) => sample.pair === 'ol')).toBe(false)
  })

  it('does not poison the aggregate that follows it', () => {
    const engine = engineFor(['old'])

    engine.input(press('o', 1_000))
    engine.pause(1_100)
    engine.resume(121_100)
    engine.input(press('l', 121_120))
    engine.input(press('d', 121_300))

    const table: BigramTable = aggregate(new Map(), observe(engine))

    expect(table.has('ol')).toBe(false)
    expect(table.get('ld')?.ewmaMs).toBe(180)
  })

  it('keeps the pair when the same gap happens without a blur', () => {
    // The distinction is the blur, not the interval: a 20ms gap between two
    // correct keystrokes is a real transition and belongs in the table.
    const engine = engineFor(['old'])

    engine.input(press('o', 1_000))
    engine.input(press('l', 1_020))
    engine.input(press('d', 1_200))

    expect(engine.getBigrams().map((sample) => sample.pair)).toEqual(['ol', 'ld'])
  })
})

describe('the exclusions change what gets drilled', () => {
  it('a phone session cannot make a transition look weak', () => {
    const physical = engineFor(['old'])

    physical.input(press('o', 0))
    physical.input(press('l', 120))
    physical.input(press('d', 240))

    const virtual = engineFor(['old'])

    virtual.input(softPress('o', 0))
    virtual.input(press('l', 900))
    virtual.input(press('d', 1_800))

    let table: BigramTable = new Map()

    for (let i = 0; i < 10; i += 1) {
      table = aggregate(table, observe(physical, i))
      table = aggregate(table, observe(virtual, i))
    }

    // Thumb latency would have dragged `ol` towards 900ms and made it the
    // weakest pair this user has. It never arrives.
    expect(table.get('ol')?.ewmaMs ?? 0).toBeLessThan(200)
    expect(scoreAll(table).every((score) => score.ewmaMs < 200)).toBe(true)
  })
})
