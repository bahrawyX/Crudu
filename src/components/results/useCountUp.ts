import { useEffect, useState } from 'react'

import { RESULTS_ENTRANCE } from './constants'

/**
 * Counts a number up from zero over the entrance duration.
 *
 * In JavaScript because it interpolates text content rather than a style, which
 * is the one thing CSS cannot animate. Everything else in the entrance sequence
 * is a keyframe.
 *
 * Ease-out cubic, so it arrives rather than stops.
 */
export function useCountUp(target: number, durationMs = RESULTS_ENTRANCE.countUpMs): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (
      durationMs <= 0 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setValue(target)

      return undefined
    }

    let frame = 0
    const started = performance.now()

    const step = (now: number): void => {
      const progress = Math.min(1, (now - started) / durationMs)
      const eased = 1 - (1 - progress) ** 3

      setValue(target * eased)

      if (progress < 1) {
        frame = requestAnimationFrame(step)
      }
    }

    frame = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(frame)
    }
  }, [target, durationMs])

  return value
}
