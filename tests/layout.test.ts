import { describe, expect, it } from 'vitest'

import {
  caretColumn,
  caretLine,
  layoutWords,
  lineRange,
  renderedLength,
  scrollRowFor,
} from '../src/components/test/layout'

/**
 * Line breaking is done here rather than by the browser, so the column of a
 * character is exactly the number of characters before it and the caret can be
 * positioned by multiplication instead of measurement (invariant 3).
 *
 * That only holds if this agrees with what is on screen, which is why the rules
 * are pinned rather than sampled.
 */

const lengths = (words: readonly string[]): number[] => words.map((word) => word.length)

describe('rendered length', () => {
  it('is the expected length until the user types past the end', () => {
    expect(renderedLength('have', 'ha')).toBe(4)
    expect(renderedLength('have', 'have')).toBe(4)
    expect(renderedLength('have', 'havex')).toBe(5)
  })
})

describe('greedy wrap', () => {
  it('places words one space apart on a line', () => {
    // "the quick" is 3 + 1 + 5 = 9 characters.
    const layout = layoutWords(lengths(['the', 'quick']), 20)

    expect(layout.placements).toEqual([
      { line: 0, column: 0 },
      { line: 0, column: 4 },
    ])
    expect(layout.lineStarts).toEqual([0])
  })

  it('fills a line exactly to capacity without wrapping', () => {
    // 3 + 1 + 5 = 9 in a 9 character line.
    const layout = layoutWords(lengths(['the', 'quick']), 9)

    expect(layout.lineStarts).toEqual([0])
  })

  it('wraps the word that would take it one character over', () => {
    const layout = layoutWords(lengths(['the', 'quick']), 8)

    expect(layout.placements).toEqual([
      { line: 0, column: 0 },
      { line: 1, column: 0 },
    ])
    expect(layout.lineStarts).toEqual([0, 1])
  })

  it('gives a word longer than the line its own line rather than looping', () => {
    const layout = layoutWords(lengths(['a', 'extraordinary', 'b']), 5)

    expect(layout.placements.map((placement) => placement.line)).toEqual([0, 1, 2])
  })

  it('handles an empty list', () => {
    expect(layoutWords([], 62)).toEqual({ placements: [], lineStarts: [] })
  })

  it('lays out a full 62 character line the way the surface renders it', () => {
    const words = ['the', 'quick', 'brown', 'fox', 'jumps', 'over', 'the', 'lazy', 'dog']
    const layout = layoutWords(lengths(words), 62)

    // 3+1+5+1+5+1+3+1+5+1+4+1+3+1+4+1+3 = 43, comfortably one line.
    expect(layout.lineStarts).toEqual([0])
    expect(layout.placements.at(-1)).toEqual({ line: 0, column: 40 })
  })
})

describe('caret position', () => {
  const layout = layoutWords(lengths(['the', 'quick', 'brown']), 10)

  it('is the word column plus what has been typed', () => {
    expect(caretColumn(layout, 0, 2)).toBe(2)
    expect(caretColumn(layout, 1, 3)).toBe(7)
  })

  it('reports the line the word sits on', () => {
    expect(caretLine(layout, 0)).toBe(0)
    expect(caretLine(layout, 2)).toBe(1)
  })

  it('falls back to the origin for a word that does not exist', () => {
    expect(caretColumn(layout, 99, 0)).toBe(0)
    expect(caretLine(layout, 99)).toBe(0)
  })
})

describe('scrolling', () => {
  it('holds the active line one row down, so completed lines pass above it', () => {
    expect(scrollRowFor(0)).toBe(0)
    expect(scrollRowFor(1)).toBe(0)
    expect(scrollRowFor(2)).toBe(1)
    expect(scrollRowFor(9)).toBe(8)
  })
})

describe('line ranges', () => {
  const words = ['the', 'quick', 'brown', 'fox']
  const layout = layoutWords(lengths(words), 10)

  it('returns the half-open range of words on a line', () => {
    expect(lineRange(layout, 0, words.length)).toEqual([0, 2])
    expect(lineRange(layout, 1, words.length)).toEqual([2, 4])
  })

  it('returns an empty range past the end', () => {
    expect(lineRange(layout, 9, words.length)).toEqual([4, 4])
  })
})
