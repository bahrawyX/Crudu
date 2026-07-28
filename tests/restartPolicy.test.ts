import { describe, expect, it } from 'vitest'

import { createRestartPolicy, sameConfig } from '../src/components/test/restartPolicy'
import type { TestConfig } from '../src/engine'

/**
 * The test screen restarts on a configuration change. Before this policy existed
 * it restarted on a configuration *object*, and App hands it a new one every time
 * the bigram table is replaced — which happens on boot, unprompted, the moment
 * IndexedDB resolves.
 *
 * These drive the boot sequence that was captured from the browser in batch 5c,
 * so a spurious reset fails here in milliseconds rather than surfacing as a
 * thirty second timeout in e2e/views.spec.ts.
 */

const BASE: TestConfig = {
  mode: 'time',
  value: 30,
  punctuation: false,
  numbers: false,
  adaptive: false,
}

/** What App's useMemo produces: the same settings in a different object. */
function rerender(config: TestConfig): TestConfig {
  return { ...config }
}

describe('sameConfig', () => {
  it('ignores identity and reads the values', () => {
    expect(sameConfig(BASE, rerender(BASE))).toBe(true)
  })

  it.each([
    ['mode', { mode: 'words' } as const],
    ['value', { value: 60 } as const],
    ['punctuation', { punctuation: true } as const],
    ['numbers', { numbers: true } as const],
    ['adaptive', { adaptive: true } as const],
  ])('sees a change of %s', (_field, patch) => {
    expect(sameConfig(BASE, { ...BASE, ...patch })).toBe(false)
  })
})

describe('the restart policy', () => {
  it('does not restart on the configuration it mounted with', () => {
    const policy = createRestartPolicy(BASE)

    expect(policy.shouldRestart(BASE)).toBe(false)
  })

  /**
   * The defect. loadBigrams resolves, App calls setTable with a fresh Map,
   * nextTest and restart are rebuilt, config is rebuilt, and every setting in it
   * is identical. Nothing about the test the user is typing has changed.
   */
  it('does not restart when a re-render only changes the object', () => {
    const policy = createRestartPolicy(BASE)

    expect(policy.shouldRestart(rerender(BASE))).toBe(false)
    expect(policy.shouldRestart(rerender(BASE))).toBe(false)
    expect(policy.shouldRestart(rerender(BASE))).toBe(false)
  })

  it('restarts once when drilling turns on, and not again', () => {
    const policy = createRestartPolicy(BASE)
    const drilling = { ...BASE, adaptive: true }

    // loadTests resolves with a seeded history, so drilling flips and the word
    // source has to change. That one is a real restart.
    expect(policy.shouldRestart(drilling)).toBe(true)

    // Everything downstream of it is not. This is the assertion that would have
    // caught a loop: a settled screen restarting on every subsequent render.
    expect(policy.shouldRestart(rerender(drilling))).toBe(false)
    expect(policy.shouldRestart(rerender(drilling))).toBe(false)
  })

  it('restarts once per genuine change across a whole session', () => {
    const policy = createRestartPolicy(BASE)
    const sequence: readonly TestConfig[] = [
      rerender(BASE),
      { ...BASE, adaptive: true },
      rerender({ ...BASE, adaptive: true }),
      { ...BASE, adaptive: true, mode: 'words', value: 25 },
      rerender({ ...BASE, adaptive: true, mode: 'words', value: 25 }),
      rerender({ ...BASE, adaptive: true, mode: 'words', value: 25 }),
    ]

    const restarts = sequence.filter((config) => policy.shouldRestart(config)).length

    expect(restarts).toBe(2)
  })

  it('restarts again when a setting returns to an earlier value', () => {
    const policy = createRestartPolicy(BASE)

    expect(policy.shouldRestart({ ...BASE, mode: 'words' })).toBe(true)
    expect(policy.shouldRestart(rerender(BASE))).toBe(true)
  })
})
