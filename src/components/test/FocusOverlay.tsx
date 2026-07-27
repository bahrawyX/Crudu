import { useSyncExternalStore } from 'react'

import { useTestSurface } from './context'

/**
 * Focus-lost. The test pauses, the block goes behind a 4px blur at half
 * opacity, and one line sits over it at full strength.
 *
 * The copy is the prototype's, verbatim. It says "press any key" because any
 * key really does resume: the engine restarts the clock on the keystroke that
 * did it and then types it (SPEC 0, DECISIONS 1.7).
 */
export function FocusOverlay() {
  const { engine } = useTestSurface()
  const status = useSyncExternalStore(
    engine.subscribeToStatus,
    engine.getStatusSnapshot,
    engine.getStatusSnapshot,
  )

  if (status.status !== 'paused') {
    return null
  }

  return (
    <div className="focus-overlay">
      <span>Click or press any key to resume</span>
    </div>
  )
}
