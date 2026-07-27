import type { TargetSet } from '../../adaptive'

/**
 * The drill banner.
 *
 * Proposed, not designed. docs/DESIGN.md has no drill screen at all — the
 * differentiator has no surface that says you are using it, which is how a
 * feature nobody notices becomes a feature nobody values. Recorded in
 * docs/DECISIONS.md 5.3.
 *
 * It is a banner rather than a screen because a drill *is* the test screen with
 * different words in it. Building a second surface would mean two
 * implementations of the caret, the trace and the line scroll, and the one thing
 * phase 2 spent its whole budget on is that there is exactly one of those.
 *
 * It sits where the config bar sits, in the same 13px muted-strong register, and
 * lists the transitions being targeted in the mono face at the size the results
 * card uses for a pair. Nothing new is invented: every value is a token that
 * already existed.
 */

export type DrillBannerProps = {
  readonly targets: TargetSet
  readonly hidden: boolean
  readonly onStop: () => void
}

/** Enough to read at a glance. The target set is fifteen; nobody scans fifteen. */
const SHOWN = 5

export function DrillBanner({ targets, hidden, onStop }: DrillBannerProps) {
  if (targets.pairs.length === 0) {
    return null
  }

  return (
    <div className="drill-banner" data-hidden={hidden ? 'true' : 'false'}>
      <span className="label">Drilling</span>

      <span className="drill-pairs">
        {targets.pairs.slice(0, SHOWN).map((pair) => (
          <span key={pair} className="drill-pair">
            {pair}
          </span>
        ))}
        {targets.pairs.length > SHOWN ? (
          <span className="label">{`+${String(targets.pairs.length - SHOWN)} more`}</span>
        ) : null}
      </span>

      <button type="button" className="button-text" onClick={onStop}>
        Plain English
      </button>
    </div>
  )
}
