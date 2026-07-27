import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'

import type { Engine, TestConfig } from '../../engine'

import { Caret } from './Caret'
import { ConfigBar } from './ConfigBar'
import { CONFIG_BAR, SURFACE } from './constants'
import { TestSurfaceProvider, useTestSurface } from './context'
import { Counter } from './Counter'
import { FocusOverlay } from './FocusOverlay'
import { HiddenInput } from './HiddenInput'
import { Lines } from './Lines'
import { createSurfaceStore } from './surfaceStore'
import type { SurfaceStore } from './surfaceStore'
import { Trace } from './Trace'
import { useSurfaceMetrics } from './useSurfaceMetrics'

/**
 * The test screen.
 *
 * Everything is arranged so that a keystroke costs one <Word> re-render and two
 * style writes. The caret, the trace and the line scroll are written
 * imperatively from the surface store; nothing on that path reads the DOM, and
 * nothing animates in JavaScript.
 */

/** Time mode needs a clock to notice expiry. 100ms is finer than the display. */
const TICK_MS = 100

export type TestScreenProps = {
  readonly engine: Engine
  readonly config: TestConfig
  readonly onRestart: () => void
}

export function TestScreen({ engine, config, onRestart }: TestScreenProps) {
  const metrics = useSurfaceMetrics()
  const store = useMemo<SurfaceStore | null>(
    () => (metrics === null ? null : createSurfaceStore(engine, metrics.capacity)),
    [engine, metrics],
  )
  const firstRun = useRef(true)

  // A configuration change starts a new test with new words. The engine is
  // reset rather than replaced, so every <Word> subscription survives.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false

      return
    }

    onRestart()
  }, [config, onRestart])

  useEffect(() => store?.start(), [store])

  // Escape restarts, as it does in the prototype. The engine ignores it, so the
  // surface has to.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onRestart()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onRestart])

  // The engine owns no clock. Something has to tell it the time ran out, and it
  // is not the keystroke handler's job.
  useEffect(() => {
    const timer = window.setInterval(() => {
      engine.tick(performance.now())
    }, TICK_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [engine])

  if (metrics === null || store === null) {
    return <main className="test-screen" aria-busy="true" />
  }

  const style = {
    '--char-width': `${String(metrics.charWidth)}px`,
    '--line-height': `${String(metrics.lineHeightPx)}px`,
    '--caret-height': `${String(metrics.caretHeightPx)}px`,
    '--surface-font-size': `${String(metrics.fontSizePx)}px`,
    '--surface-width': `${String(metrics.charWidth * metrics.capacity)}px`,
    '--surface-viewport': `${String(
      metrics.lineHeightPx * SURFACE.visibleLines + SURFACE.viewportSlackPx,
    )}px`,
    '--config-fade': `${String(CONFIG_BAR.fadeMs)}ms`,
  } as CSSProperties

  return (
    <TestSurfaceProvider value={{ engine, store, metrics }}>
      <main className="test-screen" style={style}>
        <Counter />
        <TestBlock />
        <FocusOverlay />
        <HiddenInput />
      </main>
    </TestSurfaceProvider>
  )
}

/**
 * The block dims behind a blur while paused, and the hint disappears on the
 * first keystroke. Both follow the status channel, so neither touches a word.
 */
function TestBlock() {
  const { engine } = useTestSurface()
  const status = useSyncExternalStore(
    engine.subscribeToStatus,
    engine.getStatusSnapshot,
    engine.getStatusSnapshot,
  )

  return (
    <div className="test-block" data-paused={status.status === 'paused' ? 'true' : 'false'}>
      <ConfigBar />

      <div className="surface-wrap">
        <div className="surface-viewport">
          <Lines />
          <Caret />
          <Trace />
        </div>
      </div>

      <div className="hint" data-hidden={status.status === 'idle' ? 'false' : 'true'}>
        Start typing
      </div>
    </div>
  )
}
