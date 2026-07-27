import { MIN_BIGRAM_SAMPLES } from '../../adaptive'
import type { WeaknessScore } from '../../adaptive'

import { WEAKNESS_ROW_LIMIT, WEAKNESS_RULE_EVERY } from './constants'

/**
 * The full weakness report, per docs/DESIGN.md 3.6.
 *
 * Under-sampled pairs are shown rather than hidden, and marked rather than
 * trusted: the row drops to --muted-strong, the bar fill with it, and the note
 * says so. Hiding them would make the list look more certain than it is.
 */

export type WeaknessReportProps = {
  readonly scores: readonly WeaknessScore[]
  readonly onNewTest: () => void
}

export function WeaknessReport({ scores, onNewTest }: WeaknessReportProps) {
  const rows = [...scores].sort((a, b) => b.ewmaMs - a.ewmaMs).slice(0, WEAKNESS_ROW_LIMIT)
  const slowest = Math.max(1, ...rows.map((row) => row.ewmaMs))

  if (rows.length === 0) {
    return (
      <main className="screen screen-content">
        <div className="empty-state" data-height="half">
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
      <div className="history-header">
        <span>Tracked transitions, slowest first</span>
        <span>{rows.length === 1 ? '1 pair' : `${String(scores.length)} pairs`}</span>
      </div>

      <div className="weakness-report">
        {rows.map((row, index) => {
          const thin = row.n < MIN_BIGRAM_SAMPLES

          return (
            <div
              key={row.pair}
              className="report-row"
              data-thin={thin ? 'true' : 'false'}
              data-ruled={(index + 1) % WEAKNESS_RULE_EVERY === 0 ? 'true' : 'false'}
            >
              <span className="report-pair">{row.pair}</span>
              <span className="report-track">
                <span
                  className="report-bar"
                  style={{ width: `${String((row.ewmaMs / slowest) * 100)}%` }}
                />
              </span>
              <span className="report-latency">{`${String(Math.round(row.ewmaMs))}ms`}</span>
              <span className="report-note">
                {thin ? 'Needs more data' : `${String(row.n)} samples`}
              </span>
            </div>
          )
        })}
      </div>
      <div className="results-actions">
        <button type="button" className="button-text" onClick={onNewTest}>
          Back to the test
        </button>
      </div>
    </main>
  )
}
