import { useEffect, useState } from 'react'

import { measureCharWidth, whenFontReady } from './charWidth'
import { CARET, SURFACE } from './constants'
import type { SurfaceMetrics } from './context'

/**
 * The four numbers every position on the surface is computed from.
 *
 * Returns null until the mono face has actually loaded. Nothing renders before
 * then, which is the guarantee that a font swap cannot shift character
 * positions mid test: by the time a character exists on screen, the width it
 * was placed at was measured from the font it is drawn in.
 */

const FAMILY = "'IBM Plex Mono', ui-monospace, monospace"

/** Narrowest line worth reading. Below this the surface would be unusable. */
const MIN_CAPACITY = 20

/**
 * How many characters actually fit.
 *
 * docs/DESIGN.md specifies a 62 character measure, which at 28px IBM Plex Mono
 * needs about 1090px of viewport. Between the 620px breakpoint and that width
 * the prototype simply overflows, because it lets CSS wrap and never asks how
 * wide the line is. This does ask, once, from window.innerWidth — which is a
 * viewport property, not a per-element layout read, and is sampled at mount and
 * on resize rather than on a keystroke.
 */
function fittedCapacity(designCapacity: number, charWidth: number, gutterPx: number): number {
  const usable = window.innerWidth - gutterPx * 2

  return Math.max(MIN_CAPACITY, Math.min(designCapacity, Math.floor(usable / charWidth)))
}

function watchViewport(onChange: () => void): () => void {
  // matchMedia is a media-query subscription, not a layout read. resize fires
  // outside the keystroke path and only changes the line measure.
  const query = window.matchMedia(`(max-width: ${String(SURFACE.narrowBreakpointPx)}px)`)

  query.addEventListener('change', onChange)
  window.addEventListener('resize', onChange)

  return () => {
    query.removeEventListener('change', onChange)
    window.removeEventListener('resize', onChange)
  }
}

const GUTTER_PX = 24

function sameMetrics(a: SurfaceMetrics | null, b: SurfaceMetrics): boolean {
  return (
    a !== null &&
    a.charWidth === b.charWidth &&
    a.fontSizePx === b.fontSizePx &&
    a.lineHeightPx === b.lineHeightPx &&
    a.capacity === b.capacity
  )
}

export function useSurfaceMetrics(): SurfaceMetrics | null {
  const [metrics, setMetrics] = useState<SurfaceMetrics | null>(null)

  useEffect(() => {
    let cancelled = false

    const resolve = (): void => {
      const narrow = window.innerWidth <= SURFACE.narrowBreakpointPx
      const fontSizePx = narrow ? SURFACE.fontSizeNarrowPx : SURFACE.fontSizePx
      const lineHeightPx = narrow ? SURFACE.lineHeightNarrowPx : SURFACE.lineHeightPx
      const designCapacity = narrow ? SURFACE.measureNarrowCh : SURFACE.measureCh
      const font = { sizePx: fontSizePx, weight: SURFACE.fontWeight, family: FAMILY }

      void whenFontReady(font).then(() => {
        if (cancelled) {
          return
        }

        const charWidth = measureCharWidth(font)
        const next: SurfaceMetrics = {
          charWidth,
          fontSizePx,
          lineHeightPx,
          caretHeightPx: fontSizePx + CARET.heightSlackPx,
          capacity: fittedCapacity(designCapacity, charWidth, GUTTER_PX),
        }

        // Identity matters: a new object rebuilds the surface store.
        setMetrics((current) => (sameMetrics(current, next) ? current : next))
      })
    }

    resolve()

    const stop = watchViewport(resolve)

    return () => {
      cancelled = true
      stop()
    }
  }, [])

  return metrics
}
