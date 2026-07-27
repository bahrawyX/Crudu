import { describe, expect, it } from 'vitest'

import { createWordSource } from '../src/words/source'
import type { TestConfig } from '../src/engine'

/**
 * Plain generation. Phase 4 replaces this with the adaptive generator, so what
 * is pinned here is the contract the engine relies on rather than the sampling.
 */

const config = (overrides: Partial<TestConfig> = {}): TestConfig => ({
  mode: 'time',
  value: 30,
  punctuation: false,
  numbers: false,
  adaptive: false,
  ...overrides,
})

/** Deterministic stand-in for Math.random, cycling a fixed sequence. */
function sequence(values: readonly number[]): () => number {
  let index = 0

  return () => {
    const value = values[index % values.length] ?? 0

    index += 1

    return value
  }
}

describe('word source', () => {
  it('returns exactly the number of words asked for', () => {
    expect(createWordSource(config())(50)).toHaveLength(50)
    expect(createWordSource(config())(0)).toHaveLength(0)
  })

  it('returns plain a-z words when both toggles are off', () => {
    const words = createWordSource(config())(200)

    expect(words.every((word) => /^[a-z]+$/.test(word))).toBe(true)
  })

  it('appends punctuation only when punctuation is on', () => {
    const always = sequence([0, 0])
    const words = createWordSource(config({ punctuation: true }), always)(5)

    expect(words.every((word) => word.endsWith(','))).toBe(true)
  })

  it('leaves words alone when punctuation is off', () => {
    const always = sequence([0, 0])
    const words = createWordSource(config({ punctuation: false }), always)(5)

    expect(words.every((word) => /^[a-z]+$/.test(word))).toBe(true)
  })

  it('substitutes a number only when numbers are on', () => {
    const always = sequence([0])
    const words = createWordSource(config({ numbers: true }), always)(5)

    expect(words.every((word) => /^\d+$/.test(word))).toBe(true)
  })

  it('keeps generated numbers within the two to nine character rule', () => {
    const source = createWordSource(config({ numbers: true }))
    const words = source(500).filter((word) => /^\d+$/.test(word))

    expect(words.length).toBeGreaterThan(0)
    expect(words.every((word) => word.length >= 2 && word.length <= 9)).toBe(true)
  })

  it('draws from the common list rather than inventing words', () => {
    const words = createWordSource(config())(100)
    const unique = new Set(words)

    expect(unique.size).toBeGreaterThan(20)
  })
})
