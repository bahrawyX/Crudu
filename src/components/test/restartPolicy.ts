import type { TestConfig } from '../../engine'

/**
 * Whether a rendered configuration is a new test, or the same one again.
 *
 * The test screen restarts when the configuration changes. It is handed a fresh
 * `config` object on every render where App's memo re-runs, and that memo also
 * re-runs whenever the bigram table is replaced — once on boot when IndexedDB
 * resolves, and again after every persisted result. Keying the restart on object
 * identity therefore resets a test nobody reconfigured.
 *
 * Comparing by value is the whole of it. It lives out here rather than inside
 * the component so that a boot sequence can be driven through it in a unit test,
 * instead of the first sign of a spurious reset being a browser timing out.
 */

export function sameConfig(a: TestConfig, b: TestConfig): boolean {
  return (
    a.mode === b.mode &&
    a.value === b.value &&
    a.punctuation === b.punctuation &&
    a.numbers === b.numbers &&
    a.adaptive === b.adaptive
  )
}

export type RestartPolicy = {
  /** True exactly once per genuine configuration change, and never otherwise. */
  readonly shouldRestart: (config: TestConfig) => boolean
}

/**
 * Seeded with the configuration the screen mounted on, so the first render is a
 * no-op without a separate first-run flag to get wrong.
 */
export function createRestartPolicy(initial: TestConfig): RestartPolicy {
  let current = initial

  return {
    shouldRestart: (config) => {
      if (sameConfig(current, config)) {
        return false
      }

      current = config

      return true
    },
  }
}
