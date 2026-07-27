import { describe, expect, it } from 'vitest'

import {
  GUTTER_PX,
  MIN_CHARACTER_MEASURE,
  NARROW_BREAKPOINT_PX,
  SCREEN_WIDTH,
  fitCharacterMeasure,
  isNarrowViewport,
} from '../src/components/ui/measure'

/**
 * One rule for every screen, rather than one per component. docs/DECISIONS.md
 * 3.2 states the policy; this pins it.
 */

describe('the single breakpoint', () => {
  it('is 620px, and 620 itself is narrow', () => {
    expect(NARROW_BREAKPOINT_PX).toBe(620)
    expect(isNarrowViewport(620)).toBe(true)
    expect(isNarrowViewport(621)).toBe(false)
  })
})

describe('pixel measures come from docs/DESIGN.md 1.4', () => {
  it('keeps the three widths the design gives', () => {
    expect(SCREEN_WIDTH).toEqual({ shell: 1200, content: 860, panel: 520 })
  })
})

describe('character measures fit the viewport', () => {
  const CHAR_28 = 16.8

  it('gives the design measure when there is room for it', () => {
    // 62 characters at 16.8px needs 1090px of line, plus 48px of gutter.
    expect(fitCharacterMeasure(62, CHAR_28, 1_400)).toBe(62)
  })

  it('gives what fits in the gap the design does not cover', () => {
    // The whole range between the breakpoint and about 1090px.
    expect(fitCharacterMeasure(62, CHAR_28, 800)).toBe(44)
    expect(fitCharacterMeasure(62, CHAR_28, 1_000)).toBe(56)
  })

  it('never goes below the floor, however narrow the viewport', () => {
    expect(fitCharacterMeasure(32, CHAR_28, 100)).toBe(MIN_CHARACTER_MEASURE)
  })

  it('never exceeds the design measure, however wide the viewport', () => {
    expect(fitCharacterMeasure(32, 12, 4_000)).toBe(32)
  })

  it('survives a character width of zero rather than dividing by it', () => {
    expect(fitCharacterMeasure(62, 0, 1_400)).toBe(MIN_CHARACTER_MEASURE)
  })

  it('takes a gutter on both sides', () => {
    expect(GUTTER_PX).toBe(24)
    expect(fitCharacterMeasure(999, 10, 1_000)).toBe(Math.floor((1_000 - 48) / 10))
  })
})
