import { useEffect, useRef } from 'react'

import { CARET } from './constants'
import { useTestSurface } from './context'

/**
 * The caret writes its own transform.
 *
 * It moves eight times a second and it is the only thing on screen the eye is
 * locked to, so it does not go through React at all: the store notifies, and
 * this handler sets one style property. That is a style write, never a read.
 *
 * translate3d, never left or top. transform and opacity are the only two
 * properties the browser can animate off the main thread; animating left forces
 * layout on every keystroke (ARCHITECTURE.md 4.3, invariant 4).
 */
export function Caret() {
  const { store, metrics } = useTestSurface()
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const element = ref.current

    if (element === null) {
      return undefined
    }

    let idleTimer: number | undefined

    const paint = (): void => {
      const caret = store.getCaret()
      const x = caret.column * metrics.charWidth
      const y =
        (caret.line - caret.scrollRow) * metrics.lineHeightPx +
        (metrics.lineHeightPx - metrics.caretHeightPx) / 2

      element.style.transform = `translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0)`
    }

    // Blinking under a moving hand is visual noise, so it stops on the first
    // keystroke and comes back once the user has actually stopped.
    const onMove = (): void => {
      paint()
      element.dataset['blink'] = 'off'
      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => {
        element.dataset['blink'] = 'on'
      }, CARET.blinkResumeAfterIdleMs)
    }

    paint()

    const unsubscribe = store.subscribeToCaret(onMove)

    return () => {
      unsubscribe()
      window.clearTimeout(idleTimer)
    }
  }, [store, metrics])

  return <div ref={ref} className="caret" data-blink="on" aria-hidden="true" />
}
