import { describe, expect, it } from 'vitest'

import { percentile, summarise } from '../src/perf/latency'
import type { LatencySample } from '../src/perf/latency'

const sample = (paintMs: number, processingMs: number): LatencySample => ({ paintMs, processingMs })

describe('percentile', () => {
  it('uses nearest rank over a sorted array', () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    expect(percentile(sorted, 0.5)).toBe(5)
    expect(percentile(sorted, 0.95)).toBe(10)
    expect(percentile(sorted, 0.99)).toBe(10)
  })

  it('returns zero for an empty set rather than NaN', () => {
    expect(percentile([], 0.95)).toBe(0)
  })

  it('clamps at both ends', () => {
    expect(percentile([4, 5, 6], 0)).toBe(4)
    expect(percentile([4, 5, 6], 1)).toBe(6)
  })
})

describe('summarise', () => {
  it('reports paint and processing separately', () => {
    const samples = [sample(8, 0.2), sample(16, 0.4), sample(8, 0.1), sample(16, 12)]
    const report = summarise(samples, 8)

    expect(report.count).toBe(4)
    expect(report.paint.p50).toBe(8)
    expect(report.paint.max).toBe(16)
    expect(report.processing.p50).toBe(0.2)
    expect(report.processing.max).toBe(12)
  })

  it('counts processing samples over budget, not paint samples', () => {
    // Every paint here is over 8ms and no processing is, which is the normal
    // shape: the frame interval dominates a number we do not control.
    const report = summarise([sample(16, 0.2), sample(16, 0.3), sample(16, 9)], 8)

    expect(report.overBudget).toBe(1)
  })

  it('reports zeroes for an empty run', () => {
    const report = summarise([], 8)

    expect(report.count).toBe(0)
    expect(report.paint).toEqual({ p50: 0, p95: 0, p99: 0, max: 0 })
    expect(report.processing).toEqual({ p50: 0, p95: 0, p99: 0, max: 0 })
    expect(report.budgetMs).toBe(8)
  })
})
