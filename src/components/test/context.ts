import { createContext, useContext } from 'react'

import type { Engine } from '../../engine'

import type { SurfaceStore } from './surfaceStore'

/**
 * The engine instance, the derived surface store, and the four numbers every
 * position on the surface is computed from.
 *
 * `charWidth` is measured once on font load and cached here. Nothing below this
 * context ever measures anything again.
 */

export type SurfaceMetrics = {
  readonly charWidth: number
  readonly fontSizePx: number
  readonly lineHeightPx: number
  readonly caretHeightPx: number
  /** Line width in characters: 62 wide, 32 below the narrow breakpoint. */
  readonly capacity: number
}

export type TestSurfaceValue = {
  readonly engine: Engine
  readonly store: SurfaceStore
  readonly metrics: SurfaceMetrics
}

const TestSurfaceContext = createContext<TestSurfaceValue | null>(null)

export const TestSurfaceProvider = TestSurfaceContext.Provider

export function useTestSurface(): TestSurfaceValue {
  const value = useContext(TestSurfaceContext)

  if (value === null) {
    throw new Error('Crudu: useTestSurface called outside a TestSurfaceProvider')
  }

  return value
}
