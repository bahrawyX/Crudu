import { memo } from 'react'

import type { HistoryRow } from '../../storage/history'
import { describeConfig } from '../../storage/history'

import { WEAKNESS_RULE_EVERY } from '../progress/constants'

/**
 * Recent tests.
 *
 * The prototype has no history screen and no nav entry for one — docs/DESIGN.md
 * 3.8 records that as a gap. This is proposed rather than specified, and it
 * borrows wholesale from the weakness report in 3.6, which is the only list
 * pattern the design does have: a label row, rows with reserved columns, and a
 * hairline every fifth row. See docs/DECISIONS.md 3.1.
 *
 * A test typed on a soft keyboard is marked. It is kept in history and kept out
 * of the comparison, so a phone-typed 40 WPM never reads as a regression
 * against a desk. DECISIONS 3.3.
 */

const DATE = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

type HistoryListProps = {
  readonly rows: readonly HistoryRow[]
  readonly limit?: number
}

export const HistoryList = memo(function HistoryList({ rows, limit }: HistoryListProps) {
  const visible = limit === undefined ? rows : rows.slice(0, limit)

  if (visible.length === 0) {
    return null
  }

  return (
    <section className="history">
      <div className="history-header">
        <span>Recent tests</span>
        <span>{rows.length === 1 ? '1 test' : `${String(rows.length)} tests`}</span>
      </div>

      <div className="history-rows">
        {visible.map((row, index) => (
          <div
            key={row.id}
            className="history-row"
            data-ruled={(index + 1) % WEAKNESS_RULE_EVERY === 0 ? 'true' : 'false'}
          >
            <span className="history-date">{DATE.format(row.startedAt)}</span>
            <span className="history-config">{describeConfig(row.config)}</span>
            <span className="history-wpm">{Math.round(row.wpm)}</span>
            <span className="history-accuracy">{`${String(Math.round(row.accuracy))}%`}</span>
            <span className="history-tags">
              {row.inputSource === 'virtual' ? (
                <span className="tag" data-kind="virtual" title="Typed on a soft keyboard">
                  phone
                </span>
              ) : null}
              {row.isPersonalBest ? (
                <span className="tag" data-kind="best">
                  best
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
})
