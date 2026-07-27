import type { WordSource } from '../engine'
import common from '../words/en-1000.json'
import full from '../words/en-5000.json'

import type { BigramTable } from './bigrams'
import { COMMON_WORD_DILUTION, MAX_WORD_REPEATS, SCORE_EXPONENT } from './params'
import { scoreAll } from './weakness'

/**
 * Weighted word generation.
 *
 *   score(word) = sum(weakness(b) for b in bigrams(word)) / (word.length - 1)
 *
 * Dividing by the bigram count stops long words dominating purely by size.
 *
 * 65% of a list is sampled with probability proportional to score^1.5, and 35%
 * from the top-1000 common words.
 *
 * That 35% is not padding, and it is not a knob. Interleaved practice beats
 * blocked practice on retention in essentially every motor-learning result, and
 * it keeps the text reading like English rather than like a phonetics exam,
 * which is what decides whether anyone comes back. ARCHITECTURE.md 8.2 step 4.
 */

const COMMON = common as readonly string[]
const POOL = full as readonly string[]

export type Random = () => number

export function bigramsOf(word: string): readonly string[] {
  const pairs: string[] = []

  for (let i = 1; i < word.length; i += 1) {
    pairs.push(word.slice(i - 1, i + 1))
  }

  return pairs
}

export function scoreWord(word: string, weakness: ReadonlyMap<string, number>): number {
  const pairs = bigramsOf(word)

  if (pairs.length === 0) {
    return 0
  }

  const total = pairs.reduce((sum, pair) => sum + (weakness.get(pair) ?? 0), 0)

  return total / pairs.length
}

/** Cumulative-weight sampling. Returns null when every weight is zero. */
function sampleWeighted(
  words: readonly string[],
  weights: readonly number[],
  total: number,
  roll: number,
): string | null {
  if (total <= 0) {
    return null
  }

  let target = roll * total

  for (const [index, weight] of weights.entries()) {
    target -= weight

    if (target <= 0) {
      return words[index] ?? null
    }
  }

  return words[words.length - 1] ?? null
}

export type DrillOptions = {
  readonly table: BigramTable
  readonly random?: Random
  readonly dilution?: number
  readonly exponent?: number
  readonly maxRepeats?: number
}

/**
 * Builds the weighted pool once, then hands out words.
 *
 * The repeat cap is per generated list rather than per call, so a fifty word
 * chunk cannot be nine copies of the same word even when one word scores far
 * above everything else.
 */
export function createDrillSource(options: DrillOptions): WordSource {
  const random = options.random ?? Math.random
  const dilution = options.dilution ?? COMMON_WORD_DILUTION
  const exponent = options.exponent ?? SCORE_EXPONENT
  const maxRepeats = options.maxRepeats ?? MAX_WORD_REPEATS

  const weakness = new Map(scoreAll(options.table).map((score) => [score.pair, score.weakness]))
  const weights = POOL.map((word) => scoreWord(word, weakness) ** exponent)
  const total = weights.reduce((sum, weight) => sum + weight, 0)

  return (count) => {
    const out: string[] = []
    const used = new Map<string, number>()

    const take = (word: string | null): boolean => {
      if (word === null) {
        return false
      }

      const seen = used.get(word) ?? 0

      if (seen >= maxRepeats) {
        return false
      }

      used.set(word, seen + 1)
      out.push(word)

      return true
    }

    while (out.length < count) {
      const wantsCommon = random() < dilution
      const word = wantsCommon
        ? (COMMON[Math.floor(random() * COMMON.length)] ?? null)
        : sampleWeighted(POOL, weights, total, random())

      if (take(word)) {
        continue
      }

      // Rejected for the repeat cap, or the weighted pool is flat because there
      // is no weakness data yet. Fall back to a common word, which is what the
      // cold start is anyway.
      take(COMMON[Math.floor(random() * COMMON.length)] ?? null)
    }

    return out
  }
}
