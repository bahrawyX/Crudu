import { describe, expect, it } from 'vitest'

import { fitRange } from '../src/components/results/range'

/**
 * Nobody's WPM is usefully compared against zero. Anchoring the axis there
 * crushes a 62-to-78 spread into the top fifth of the box, where a ten word per
 * minute swing reads as a flat line.
 */

describe('fitRange', () => {
  it('brackets the data rather than starting at zero', () => {
    const [low, high] = fitRange([62, 70, 78])

    expect(low).toBeGreaterThan(0)
    expect(low).toBeLessThan(62)
    expect(high).toBeGreaterThan(78)
  })

  it('leaves the extremes off the frame', () => {
    const [low, high] = fitRange([60, 90])

    expect(low).toBeLessThan(60)
    expect(high).toBeGreaterThan(90)
  })

  it('gives a flat series something to be drawn into', () => {
    const [low, high] = fitRange([70, 70, 70])

    expect(high - low).toBeGreaterThan(0)
    expect(low).toBeLessThan(70)
    expect(high).toBeGreaterThan(70)
  })

  it('never goes below zero, however small the values', () => {
    expect(fitRange([1, 2])[0]).toBe(0)
  })

  it('handles an empty series', () => {
    expect(fitRange([])).toEqual([0, 10])
  })
})
