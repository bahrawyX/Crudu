/**
 * Public surface of the typing engine.
 *
 * Nothing under src/engine/ may import React. The engine is a plain TypeScript
 * reducer that React subscribes to via useSyncExternalStore, and that
 * separation is the reason a keystroke costs one word re-render instead of a
 * three hundred node tree walk. The rule is enforced twice: by the
 * no-restricted-syntax block in eslint.config.js, and by
 * tests/engine/invariants.test.ts.
 */
export {
  CHARS_PER_WORD,
  CONSISTENCY_SAMPLE_MS,
  EXTRA_CHARS_LIMIT,
  PAUSE_THRESHOLD_MS,
  WORD_CHUNK_SIZE,
} from './constants'
