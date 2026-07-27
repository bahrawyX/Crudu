import { useSyncExternalStore } from 'react'

import { useTestSurface } from './context'

/**
 * Remaining time, or remaining words. Top left, 13px, mono.
 *
 * There is no live WPM here and there will not be one. A number that changes
 * while you type pulls the eye off the text, which is the one thing the screen
 * exists to show. The speed is reported once, on the results screen, when
 * reading it costs nothing.
 *
 * Subscribed to the status channel rather than to any word, so the second
 * rolling over re-renders this and nothing else.
 */
export function Counter() {
  const { engine } = useTestSurface()
  const status = useSyncExternalStore(
    engine.subscribeToStatus,
    engine.getStatusSnapshot,
    engine.getStatusSnapshot,
  )

  const running = status.status === 'running' || status.status === 'paused'
  const label =
    engine.getState().config.mode === 'time'
      ? `${String(Math.ceil(status.remainingMs / 1000))}s`
      : `${String(status.remainingWords)} words`

  return (
    <div className="counter" data-visible={running ? 'true' : 'false'}>
      {label}
    </div>
  )
}
