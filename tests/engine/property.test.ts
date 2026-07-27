import { describe, expect, it } from 'vitest'

import {
  PAUSE_THRESHOLD_MS,
  computeMetrics,
  createEngine,
  resultDurationMs,
} from '../../src/engine'
import type { Engine, KeyInput, TestConfig } from '../../src/engine'

import { cyclingWords, fixedWords, timeConfig, wordsConfig } from './helpers'

/**
 * Ten thousand random keystroke sequences.
 *
 * The engine must never throw and never produce a negative or NaN metric,
 * whatever arrives. Real input is messier than any hand-written case: modifier
 * chords, held keys, soft keyboards, blurs in the middle of a word, timestamps
 * that go backwards, and space pressed twenty times in a row.
 *
 * Seeded so a failure is reproducible. The seed is printed with any failure.
 */

const RUNS = 10_000
const MAX_ACTIONS = 30

/** mulberry32. Small, fast, and good enough to shuffle test input. */
function random(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d_2b_79_f5) | 0

    let t = Math.imul(state ^ (state >>> 15), 1 | state)

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t

    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'
const NAMED_KEYS = ['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'Enter', 'Escape', 'Unidentified']
const WORD_POOL = ['the', 'quick', 'brown', 'fox', 'a', 'it', 'zz', 'hello']

type Step =
  | { readonly kind: 'input'; readonly input: KeyInput }
  | { readonly kind: 'pause'; readonly at: number }
  | { readonly kind: 'resume'; readonly at: number }
  | { readonly kind: 'tick'; readonly at: number }

function buildConfig(next: () => number): TestConfig {
  return next() < 0.5 ? wordsConfig(1 + Math.floor(next() * 5)) : timeConfig(1 + Math.floor(next() * 5))
}

function buildKey(next: () => number, at: number): KeyInput {
  const roll = next()
  const key =
    roll < 0.55
      ? (ALPHABET[Math.floor(next() * ALPHABET.length)] ?? 'a')
      : roll < 0.72
        ? ' '
        : roll < 0.88
          ? 'Backspace'
          : (NAMED_KEYS[Math.floor(next() * NAMED_KEYS.length)] ?? 'Shift')

  const virtual = next() < 0.08

  return {
    key,
    code: virtual ? '' : `Key${key.toUpperCase()}`,
    keyCode: virtual ? 229 : 65,
    timeStamp: at,
    repeat: next() < 0.1,
    ctrlKey: next() < 0.1,
    metaKey: next() < 0.05,
    altKey: next() < 0.05,
    shiftKey: next() < 0.2,
  }
}

function buildSteps(next: () => number): readonly Step[] {
  const steps: Step[] = []
  const count = 1 + Math.floor(next() * MAX_ACTIONS)
  let at = Math.floor(next() * 1_000)

  for (let i = 0; i < count; i += 1) {
    // Sometimes go backwards, which a browser should never do but a test can.
    at += next() < 0.05 ? -Math.floor(next() * 500) : Math.floor(next() * 1_400)

    const roll = next()

    if (roll < 0.06) {
      steps.push({ kind: 'pause', at })
      continue
    }

    if (roll < 0.12) {
      steps.push({ kind: 'resume', at })
      continue
    }

    if (roll < 0.18) {
      steps.push({ kind: 'tick', at })
      continue
    }

    steps.push({ kind: 'input', input: buildKey(next, at) })
  }

  return steps
}

function play(engine: Engine, steps: readonly Step[]): void {
  for (const step of steps) {
    if (step.kind === 'input') {
      engine.input(step.input)
      continue
    }

    if (step.kind === 'pause') {
      engine.pause(step.at)
      continue
    }

    if (step.kind === 'resume') {
      engine.resume(step.at)
      continue
    }

    engine.tick(step.at)
  }
}

function isSane(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

describe('property: the engine survives anything', () => {
  it(`never throws and never produces a negative or NaN metric across ${String(RUNS)} runs`, () => {
    for (let seed = 1; seed <= RUNS; seed += 1) {
      const next = random(seed)
      const config = buildConfig(next)
      const pool = WORD_POOL.slice(0, 1 + Math.floor(next() * WORD_POOL.length))
      const engine = createEngine({
        config,
        wordSource: config.mode === 'words' ? fixedWords(pool) : cyclingWords(pool),
        id: `run-${String(seed)}`,
        startedAt: 0,
      })

      const steps = buildSteps(next)

      expect(() => {
        play(engine, steps)
      }, `seed ${String(seed)} threw`).not.toThrow()

      const state = engine.getState()
      const metrics = computeMetrics(state.log, resultDurationMs(state))
      const context = `seed ${String(seed)}`

      expect(isSane(metrics.wpm), `${context}: wpm ${String(metrics.wpm)}`).toBe(true)
      expect(isSane(metrics.raw), `${context}: raw ${String(metrics.raw)}`).toBe(true)
      expect(isSane(metrics.accuracy), `${context}: accuracy`).toBe(true)
      expect(metrics.accuracy, context).toBeLessThanOrEqual(100)
      expect(isSane(metrics.consistency), `${context}: consistency`).toBe(true)
      expect(metrics.consistency, context).toBeLessThanOrEqual(100)

      for (const count of Object.values(metrics.chars)) {
        expect(isSane(count), `${context}: char count`).toBe(true)
      }

      // The log is in test time: never negative, never going backwards.
      let previous = -1

      for (const entry of state.log) {
        expect(entry.t, `${context}: t went backwards`).toBeGreaterThanOrEqual(previous)
        expect(entry.t, `${context}: negative t`).toBeGreaterThanOrEqual(0)
        previous = entry.t
      }

      // The cursor never leaves the list, and the active word is where it says.
      expect(state.wordIndex, context).toBeGreaterThanOrEqual(0)
      expect(state.wordIndex, context).toBeLessThanOrEqual(Math.max(0, state.words.length - 1))

      for (const sample of engine.getBigrams()) {
        expect(sample.latencyMs, `${context}: negative latency`).toBeGreaterThanOrEqual(0)
        expect(sample.latencyMs, `${context}: latency over threshold`).toBeLessThanOrEqual(
          PAUSE_THRESHOLD_MS,
        )
        expect(sample.pair, `${context}: pair length`).toHaveLength(2)
      }

      if (state.inputSource === 'virtual') {
        expect(engine.getBigrams(), `${context}: virtual test kept bigrams`).toEqual([])
      }
    }
  })
})
