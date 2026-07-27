/**
 * Numbers the engine is not free to choose.
 *
 * Every value here is fixed by a reference document rather than by taste. They
 * live in their own module so that phase 1 imports them instead of inlining
 * literals, and so that changing one is a visible diff against a cited source
 * rather than a quiet retune.
 */

/**
 * The word is five characters. ARCHITECTURE.md section 9: the convention is the
 * industry standard and matches every competitor. Do not get creative.
 */
export const CHARS_PER_WORD = 5

/**
 * A gap wider than this between two keydowns means the user paused, not that
 * they slowed down. Such a pair is excluded from bigram latency and from the
 * per-second consistency sampling. ARCHITECTURE.md section 9.
 */
export const PAUSE_THRESHOLD_MS = 1000

/**
 * Characters typed past the end of a word are recorded as extra, up to
 * word.length + this. Input past the cap is discarded silently so that a stuck
 * key cannot grow the keystroke log without bound.
 */
export const EXTRA_CHARS_LIMIT = 10

/**
 * Time mode generates words lazily in chunks of this size, appending as the
 * user approaches the end of the list. A 15 second test and a 120 second test
 * must not differ in how much work happens before the first keystroke.
 */
export const WORD_CHUNK_SIZE = 50

/** Consistency is sampled over raw WPM computed in windows of this width. */
export const CONSISTENCY_SAMPLE_MS = 1000

/**
 * Time mode tops up whenever fewer than this many words remain ahead of the
 * cursor. Equal to the chunk size, so the engine always holds between one and
 * two chunks of runway and never an unbounded list.
 */
export const WORD_LOW_WATER = WORD_CHUNK_SIZE

/**
 * KeyboardEvent.keyCode while an IME is composing. Together with an empty
 * `code` this is how a soft keyboard announces itself. SPEC 1.7.
 */
export const VIRTUAL_KEY_CODE = 229

/** Consistency needs at least this many sampled seconds to mean anything. */
export const MIN_CONSISTENCY_SAMPLES = 2
