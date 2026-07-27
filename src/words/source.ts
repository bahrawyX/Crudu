import type { TestConfig, WordSource } from '../engine'

import common from './en-1000.json'

/**
 * Plain word generation: uniform sampling from the top 1000 common words, with
 * punctuation and numbers as independent toggles.
 *
 * Phase 4 replaces this with the adaptive generator. The engine takes a
 * WordSource rather than owning generation, so that substitution costs one line
 * at the call site and nothing inside the reducer.
 *
 * Rates come from docs/design-prototype.html: a number replaces a word 15% of
 * the time, and punctuation is appended to one 20% of the time.
 */

const WORDS = common as readonly string[]

const PUNCTUATION = [',', '.', ';', ':', "'", '-', '(', ')'] as const

const NUMBER_RATE = 0.15
const PUNCTUATION_RATE = 0.2
const NUMBER_MIN = 10
const NUMBER_RANGE = 9000

function pick<T>(list: readonly T[], roll: number): T {
  const value = list[Math.floor(roll * list.length)]

  if (value === undefined) {
    throw new Error('Crudu: cannot sample from an empty list')
  }

  return value
}

export type Random = () => number

export function createWordSource(config: TestConfig, random: Random = Math.random): WordSource {
  return (count) => {
    const out: string[] = []

    for (let i = 0; i < count; i += 1) {
      if (config.numbers && random() < NUMBER_RATE) {
        out.push(String(NUMBER_MIN + Math.floor(random() * NUMBER_RANGE)))
        continue
      }

      const word = pick(WORDS, random())

      out.push(
        config.punctuation && random() < PUNCTUATION_RATE
          ? word + pick(PUNCTUATION, random())
          : word,
      )
    }

    return out
  }
}
