import { useEffect, useRef } from 'react'
import uPlot from 'uplot'

import type { SecondSample } from '../../engine'

import { RESULTS_ENTRANCE } from './constants'

/**
 * The WPM curve, in uPlot.
 *
 * ARCHITECTURE.md 5.2: Recharts is fine for sixty points rendered once and is
 * not fine for the progress chart, which after three months of daily use holds
 * thousands of points across an SVG DOM. Using one library for both beats using
 * the right library for each, and uPlot is the one that survives both.
 *
 * Drawn on canvas, so the error ticks and the median hairline are strokes in the
 * same paint rather than another few hundred DOM nodes.
 */

type WpmGraphProps = {
  readonly series: readonly SecondSample[]
  readonly medianWpm: number | null
  readonly heightPx?: number
}

function readToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function WpmGraph({ series, medianWpm, heightPx = 180 }: WpmGraphProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const host = hostRef.current

    if (host === null || series.length === 0) {
      return undefined
    }

    // Reading tokens here is a style read on the document root, not a layout
    // read, and it happens once per results screen rather than per keystroke.
    // The rule this file sits outside of is scoped to src/components/test/.
    const accent = readToken('--accent')
    const hairline = readToken('--hairline')
    const error = readToken('--error')

    const seconds = series.map((sample) => sample.second)
    const values = series.map((sample) => sample.wpm)
    const peak = Math.max(60, ...values)

    const plot = new uPlot(
      {
        width: host.clientWidth || 900,
        height: heightPx,
        padding: [8, 0, 0, 0],
        cursor: { show: false },
        legend: { show: false },
        scales: { x: { time: false }, y: { range: [0, peak * 1.1] } },
        axes: [
          { show: false },
          { show: false },
        ],
        series: [
          {},
          {
            stroke: accent,
            width: 2,
            points: { show: false },
          },
        ],
        hooks: {
          draw: [
            (self) => {
              const context = self.ctx

              context.save()

              if (medianWpm !== null) {
                const y = self.valToPos(medianWpm, 'y', true)

                context.strokeStyle = hairline
                context.lineWidth = 1
                context.beginPath()
                context.moveTo(self.bbox.left, y)
                context.lineTo(self.bbox.left + self.bbox.width, y)
                context.stroke()
              }

              // Error ticks sit on the baseline, eight pixels tall, one per
              // second in which something was got wrong.
              //
              // The baseline is where zero is, not where the plotting box ends.
              // Measuring from bbox left them floating a third of the way up the
              // graph with nothing under them, which is what they looked like on
              // a phone before anyone read the code.
              context.strokeStyle = error
              context.lineWidth = 2

              const baseline = self.valToPos(0, 'y', true)

              for (const sample of series) {
                if (!sample.hadError) {
                  continue
                }

                const x = self.valToPos(sample.second, 'x', true)

                context.beginPath()
                context.moveTo(x, baseline)
                context.lineTo(x, baseline - 8)
                context.stroke()
              }

              context.restore()
            },
          ],
        },
      },
      [seconds, values],
      host,
    )

    const resize = (): void => {
      plot.setSize({ width: host.clientWidth || 900, height: heightPx })
    }

    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
      plot.destroy()
    }
  }, [series, medianWpm, heightPx])

  return (
    <div
      ref={hostRef}
      className="wpm-graph"
      style={{
        height: `${String(heightPx)}px`,
        animationDelay: `${String(RESULTS_ENTRANCE.graphDelayMs)}ms`,
      }}
      aria-hidden="true"
    />
  )
}
