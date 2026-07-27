/**
 * Line breaking, done in JavaScript.
 *
 * The browser never wraps anything on the test surface. Each line is its own
 * nowrap row, filled by the greedy algorithm below, which means the column of a
 * character is exactly the number of characters before it on its line and the
 * caret can be positioned by multiplication.
 *
 * Letting CSS wrap would mean asking the DOM where a word ended up, and that is
 * a layout read on the keystroke path (invariant 3).
 */

export type WordPlacement = {
  /** Line index this word starts on. */
  readonly line: number
  /** Column of the word's first character, counted in characters. */
  readonly column: number
}

export type SurfaceLayout = {
  readonly placements: readonly WordPlacement[]
  /** Word index each line starts at. `lineStarts.length` is the line count. */
  readonly lineStarts: readonly number[]
}

const EMPTY: SurfaceLayout = { placements: [], lineStarts: [] }

/**
 * A word occupies as many columns as it renders characters, which is its
 * expected length until the user types past the end of it.
 */
export function renderedLength(text: string, typed: string): number {
  return Math.max(text.length, typed.length)
}

/**
 * Greedy wrap. A word goes on the current line when it and the single space
 * before it still fit within `capacity` characters; otherwise it opens a new one.
 * A word longer than the whole line gets a line to itself and overflows it,
 * which cannot happen with the shipped list but must not crash if it does.
 */
export function layoutWords(lengths: readonly number[], capacity: number): SurfaceLayout {
  if (lengths.length === 0) {
    return EMPTY
  }

  const placements: WordPlacement[] = []
  const lineStarts: number[] = [0]
  let line = 0
  let column = 0

  lengths.forEach((length, index) => {
    const separator = column === 0 ? 0 : 1

    if (column > 0 && column + separator + length > capacity) {
      line += 1
      column = 0
      lineStarts.push(index)
      placements.push({ line, column: 0 })
      column = length

      return
    }

    placements.push({ line, column: column + separator })
    column += separator + length
  })

  return { placements, lineStarts }
}

/** Where the caret sits: the column after everything typed in the active word. */
export function caretColumn(layout: SurfaceLayout, wordIndex: number, typedLength: number): number {
  return (layout.placements[wordIndex]?.column ?? 0) + typedLength
}

export function caretLine(layout: SurfaceLayout, wordIndex: number): number {
  return layout.placements[wordIndex]?.line ?? 0
}

/**
 * The active line holds position one row down from the top of the three-line
 * viewport, so completed lines scroll up past it and the eye never moves.
 */
export function scrollRowFor(line: number): number {
  return Math.max(0, line - 1)
}

/** Word indices on one line, as a half-open range. */
export function lineRange(
  layout: SurfaceLayout,
  line: number,
  wordCount: number,
): readonly [number, number] {
  const start = layout.lineStarts[line] ?? wordCount
  const end = layout.lineStarts[line + 1] ?? wordCount

  return [start, end]
}
