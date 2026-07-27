import { useEffect, useRef } from 'react'
import uPlot from 'uplot'

import { fitRange } from '../results/range'

import { PROGRESS } from './constants'

/**
 * The progress screen, per docs/DESIGN.md 3.5.
 *
 * ARCHITECTURE.md 8.3: a seven day rolling median, never the personal best.
 * Personal bests are noise-chasing — you set one on a good day and then watch a
 * number you cannot influence fail to move. The median is the thing that
 * actually shifts when you get better, and visible improvement on something
 * real is the retention mechanic.
 */

export type ProgressPoint = {
  readonly label: string
  readonly medianWpm: number
}

export type ProgressScreenProps = {
  readonly points: readonly ProgressPoint[]
  readonly onNewTest: () => void
}

function readToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function ProgressChart({ points }: { readonly points: readonly ProgressPoint[] }) {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const host = hostRef.current

    if (host === null || points.length < 2) {
      return undefined
    }

    const accent = readToken('--accent')
    const hairline = readToken('--hairline')
    const values = points.map((point) => point.medianWpm)
    const overall = [...values].sort((a, b) => a - b)[values.length >> 1] ?? 0

    const plot = new uPlot(
      {
        width: host.clientWidth || 860,
        height: 220,
        padding: [8, 0, 0, 0],
        cursor: { show: false },
        legend: { show: false },
        scales: { x: { time: false }, y: { range: () => fitRange([...values, overall]) } },
        axes: [{ show: false }, { show: false }],
        series: [{}, { stroke: accent, width: 2, points: { show: false } }],
        hooks: {
          draw: [
            (self) => {
              const y = self.valToPos(overall, 'y', true)

              self.ctx.save()
              self.ctx.strokeStyle = hairline
              self.ctx.lineWidth = 1
              self.ctx.beginPath()
              self.ctx.moveTo(self.bbox.left, y)
              self.ctx.lineTo(self.bbox.left + self.bbox.width, y)
              self.ctx.stroke()
              self.ctx.restore()
            },
          ],
        },
      },
      [points.map((_point, index) => index), values],
      host,
    )

    const resize = (): void => {
      plot.setSize({ width: host.clientWidth || 860, height: 220 })
    }

    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
      plot.destroy()
    }
  }, [points])

  return <div ref={hostRef} className="progress-chart" aria-hidden="true" />
}

export function ProgressScreen({ points, onNewTest }: ProgressScreenProps) {
  // DESIGN.md 3.5: nothing is plotted until three tests exist, and the empty
  // state says so in as many words rather than showing an empty axis.
  if (points.length < PROGRESS.minimumTests) {
    return (
      <main className="screen screen-content">
        <div className="empty-state">
          <div className="empty-title">Nothing plotted yet.</div>
          <div className="empty-body">Run three tests and your first line appears here.</div>
          <button type="button" className="button-primary" onClick={onNewTest}>
            Run a test.
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="screen screen-content">
      <div className="label">{`${String(PROGRESS.rollingMedianDays)} day rolling median`}</div>
      <ProgressChart points={points} />
      <div className="progress-axis">
        <span>{points[0]?.label}</span>
        <span>{points.at(-1)?.label}</span>
      </div>
      <div className="results-actions">
        <button type="button" className="button-text" onClick={onNewTest}>
          Back to the test
        </button>
      </div>
    </main>
  )
}
