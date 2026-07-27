import { useEffect, useRef } from 'react'

import { useTestSurface } from './context'

/**
 * The trace: a hairline under the active line, filled to where the caret is.
 *
 * scaleX from a left origin, on the same 90ms curve as the caret, so the two
 * read as one mechanism rather than two things that happen to move together.
 * Never width — width is a layout property and this runs on every keystroke.
 *
 * The track moves between lines by transform as well, for the same reason.
 */
export function Trace() {
  const { store, metrics } = useTestSurface()
  const trackRef = useRef<HTMLDivElement | null>(null)
  const fillRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const track = trackRef.current
    const fill = fillRef.current

    if (track === null || fill === null) {
      return undefined
    }

    const paint = (): void => {
      const caret = store.getCaret()
      const row = caret.line - caret.scrollRow
      const y = (row + 1) * metrics.lineHeightPx - 4
      const progress = Math.min(1, caret.column / metrics.capacity)

      track.style.transform = `translate3d(0, ${y.toFixed(3)}px, 0)`
      fill.style.transform = `scaleX(${progress.toFixed(5)})`
    }

    paint()

    return store.subscribeToCaret(paint)
  }, [store, metrics])

  return (
    <div ref={trackRef} className="trace-track" aria-hidden="true">
      <span ref={fillRef} className="trace" />
    </div>
  )
}
