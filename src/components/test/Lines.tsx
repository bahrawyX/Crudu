import { memo, useEffect, useRef, useSyncExternalStore } from 'react'

import { useTestSurface } from './context'
import type { SurfaceLayout } from './layout'
import { lineRange } from './layout'
import { Word } from './Word'

/**
 * The word rows.
 *
 * The browser wraps nothing here. Each line is a nowrap flex row whose gap is
 * exactly one character, so a character's column is the number of characters
 * before it on its line and the caret needs no measurement (invariant 3).
 *
 * This component re-renders when the line layout changes or when the caret
 * reaches a new line, roughly once every ten words. A keystroke inside a word
 * does not reach it: the word list is identical, and only the <Word> at the
 * cursor re-renders.
 */

/** Lines mounted ahead of the caret. Three are visible; the rest is runway. */
const LOOKAHEAD = 4

type LineProps = {
  readonly line: number
  readonly layout: SurfaceLayout
  readonly wordCount: number
}

const Line = memo(function Line({ line, layout, wordCount }: LineProps) {
  const [start, end] = lineRange(layout, line, wordCount)
  const length = Math.max(0, end - start)

  return (
    <div className="surface-line">
      {Array.from({ length }, (_value, offset) => (
        <Word key={start + offset} index={start + offset} />
      ))}
    </div>
  )
})

export function Lines() {
  const { store, metrics } = useTestSurface()
  const layout = useSyncExternalStore(store.subscribeToLayout, store.getLayout, store.getLayout)
  const caretLine = useSyncExternalStore(store.subscribeToLine, store.getLine, store.getLine)
  const ref = useRef<HTMLDivElement | null>(null)

  const wordCount = store.getWordCount()
  const visibleLines = Math.min(layout.lineStarts.length, caretLine + 1 + LOOKAHEAD)

  useEffect(() => {
    const element = ref.current

    if (element === null) {
      return undefined
    }

    // Completed lines scroll up and the active line holds its position. The
    // whole block moves by one transform rather than by re-laying anything out.
    const paint = (): void => {
      const offset = -store.getCaret().scrollRow * metrics.lineHeightPx

      element.style.transform = `translate3d(0, ${offset.toFixed(3)}px, 0)`
    }

    paint()

    return store.subscribeToLine(paint)
  }, [store, metrics])

  return (
    <div ref={ref} className="surface-lines">
      {Array.from({ length: visibleLines }, (_value, line) => (
        <Line key={line} line={line} layout={layout} wordCount={wordCount} />
      ))}
    </div>
  )
}
