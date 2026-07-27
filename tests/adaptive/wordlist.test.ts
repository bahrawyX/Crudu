import { describe, expect, it } from 'vitest'

import en1000 from '../../src/words/en-1000.json'
import en5000 from '../../src/words/en-5000.json'

/**
 * The word lists are generated, so this suite guards the generator rather than
 * the data. A regenerated list that smuggles in an apostrophe, a digit or a
 * twelve-character word would change what the test surface asks people to type
 * without anyone noticing, because nothing else in the codebase looks at these
 * files until phase 4 samples them.
 */

const ALLOWED = /^[a-z]+$/
const MIN_LENGTH = 2
const MAX_LENGTH = 9

const lists = [
  { name: 'en-1000', words: en1000 as string[], expected: 1000 },
  { name: 'en-5000', words: en5000 as string[], expected: 5000 },
]

describe.each(lists)('$name', ({ words, expected }) => {
  it('holds exactly the expected number of words', () => {
    expect(words).toHaveLength(expected)
  })

  it('contains a-z only', () => {
    const offenders = words.filter((word) => !ALLOWED.test(word))

    expect(offenders).toEqual([])
  })

  it('contains nothing shorter than 2 or longer than 9 characters', () => {
    const offenders = words.filter(
      (word) => word.length < MIN_LENGTH || word.length > MAX_LENGTH,
    )

    expect(offenders).toEqual([])
  })

  it('contains no duplicates', () => {
    expect(new Set(words).size).toBe(words.length)
  })

  it('is ordered by frequency, not alphabetically', () => {
    const alphabetical = [...words].sort()

    expect(words).not.toEqual(alphabetical)
    expect(words[0]).toBe('the')
  })
})

describe('the two lists are consistent with each other', () => {
  it('makes en-1000 the exact prefix of en-5000', () => {
    expect((en5000 as string[]).slice(0, 1000)).toEqual(en1000 as string[])
  })
})

describe('the lists are usable as bigram training material', () => {
  it('covers every letter of the alphabet in the top 1000', () => {
    const letters = new Set((en1000 as string[]).join(''))

    expect(letters.size).toBe(26)
  })

  it('contains the same-finger bigrams ARCHITECTURE.md 2 calls out as slow', () => {
    const text = ` ${(en5000 as string[]).join(' ')} `

    for (const pair of ['ol', 'ed', 'un', 'ce', 'rt', 'sa', 'we']) {
      expect(text.includes(pair), `no word in en-5000 contains "${pair}"`).toBe(true)
    }
  })
})
