import { useMemo } from 'react'

import { MIN_BIGRAM_SAMPLES } from '../../adaptive'
import type { Calibration, WeaknessScore } from '../../adaptive'
import { wpmSeries } from '../../engine'
import type { TestResult } from '../../engine'
import type { Comparison, HistoryRow } from '../../storage/history'

import { RESULTS_ENTRANCE, SECONDARY_STATS } from './constants'
import { HistoryList } from './HistoryList'
import { useCountUp } from './useCountUp'
import { WpmGraph } from './WpmGraph'

/**
 * The results screen, per docs/DESIGN.md 3.4.
 *
 * One orchestrated 700ms entrance: numbers count up over 400ms, the graph draws
 * from 150ms, the secondary stats rise at 350ms and the card follows one 40ms
 * stagger later. This is the emotional payoff of the loop and the only place
 * worth spending animation budget, so it is one moment rather than four.
 */

const HISTORY_ROWS_ON_RESULTS = 10

export type ResultsScreenProps = {
  readonly result: TestResult
  readonly comparison: Comparison
  readonly weakness: readonly WeaknessScore[]
  readonly calibration: Calibration
  readonly history: readonly HistoryRow[]
  readonly storageFailed: boolean
  readonly onRepeat: () => void
  readonly onNew: () => void
  readonly onDrill: () => void
  readonly onProgress: () => void
}

function delta(
  current: number,
  median: number | null,
): { readonly label: string; readonly up: boolean } {
  if (median === null) {
    return { label: 'first plotted test', up: false }
  }

  const difference = Math.round(current) - Math.round(median)

  return {
    label: `${difference >= 0 ? '+' : ''}${String(difference)} vs 7 day median`,
    up: difference >= 0,
  }
}

export function ResultsScreen({
  result,
  comparison,
  weakness,
  calibration,
  history,
  storageFailed,
  onRepeat,
  onNew,
  onDrill,
  onProgress,
}: ResultsScreenProps) {
  const series = useMemo(() => wpmSeries(result.keystrokes), [result])
  const top = useMemo(
    () => weakness.filter((score) => score.n >= MIN_BIGRAM_SAMPLES).slice(0, 3),
    [weakness],
  )
  const averageMs = useMemo(
    () =>
      weakness.length === 0
        ? 0
        : Math.round(weakness.reduce((sum, score) => sum + score.ewmaMs, 0) / weakness.length),
    [weakness],
  )

  const wpm = useCountUp(result.derived.wpm)
  const accuracy = useCountUp(result.derived.accuracy)

  const wpmDelta = delta(result.derived.wpm, comparison.medianWpm)
  const accuracyDelta = delta(result.derived.accuracy, comparison.medianAccuracy)

  const secondary: Record<(typeof SECONDARY_STATS)[number], string> = {
    'raw wpm': String(Math.round(result.derived.raw)),
    consistency: `${String(Math.round(result.derived.consistency))}%`,
    characters: String(
      result.derived.chars.correct + result.derived.chars.incorrect + result.derived.chars.extra,
    ),
    time: `${String(series.length)}s`,
  }

  return (
    <main className="screen screen-content results">
      <div className="results-headline">
        <div>
          <div className="results-number" data-best={comparison.isPersonalBest ? 'true' : 'false'}>
            {Math.round(wpm)}
          </div>
          <div className="results-label-row">
            <span className="label">wpm</span>
            <span className="delta" data-up={wpmDelta.up ? 'true' : 'false'}>
              {wpmDelta.label}
            </span>
          </div>
          {comparison.isPersonalBest ? (
            <div className="results-best">Best at this setting</div>
          ) : null}
        </div>

        <div>
          <div className="results-number">{`${String(Math.round(accuracy))}%`}</div>
          <div className="results-label-row">
            <span className="label">accuracy</span>
            <span className="delta" data-up={accuracyDelta.up ? 'true' : 'false'}>
              {accuracyDelta.label}
            </span>
          </div>
        </div>
      </div>

      <WpmGraph series={series} medianWpm={comparison.medianWpm} />

      <div
        className="results-secondary"
        style={{ animationDelay: `${String(RESULTS_ENTRANCE.secondaryDelayMs)}ms` }}
      >
        {SECONDARY_STATS.map((label) => (
          <div key={label}>
            <div className="label">{label}</div>
            <div className="stat-value">{secondary[label]}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ animationDelay: `${String(RESULTS_ENTRANCE.cardDelayMs)}ms` }}>
        {calibration.calibrating ? (
          <div className="card-body">{calibration.copy}</div>
        ) : (
          <div>
            <div className="label">Slowest transitions</div>
            <div className="weakness-rows">
              {top.map((row) => (
                <div key={row.pair} className="weakness-row">
                  <span className="weakness-pair">{row.pair}</span>
                  <span className="card-body">
                    {`${String(Math.round(row.ewmaMs))}ms, against your average of ${String(averageMs)}ms`}
                  </span>
                </div>
              ))}
              {top.length === 0 ? (
                <div className="card-body">
                  {result.inputSource === 'virtual'
                    ? 'No transitions recorded. Soft keyboards are not measured for drills.'
                    : `Not enough clean transitions yet. ${String(MIN_BIGRAM_SAMPLES)} samples per pair are needed.`}
                </div>
              ) : null}
            </div>
            <button type="button" className="button-primary" onClick={onDrill}>
              Drill these
            </button>
          </div>
        )}
      </div>

      {storageFailed ? (
        <div className="storage-error">Could not save that test. Your history is intact.</div>
      ) : null}

      <div className="results-actions">
        <button type="button" className="button-text" onClick={onRepeat}>
          Repeat test
        </button>
        <button type="button" className="button-text" onClick={onNew}>
          New test
        </button>
        <button type="button" className="button-text" onClick={onProgress}>
          Progress
        </button>
      </div>

      <HistoryList rows={history} limit={HISTORY_ROWS_ON_RESULTS} />
    </main>
  )
}
