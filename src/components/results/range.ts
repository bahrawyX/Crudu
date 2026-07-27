/**
 * Vertical range for a WPM chart, fitted to the data.
 *
 * Zero is not a useful comparison. Nobody's typing speed is meaningfully read
 * against not typing, and anchoring the axis there crushes a 62-to-78 spread
 * into the top fifth of the box, where a real ten word-per-minute swing looks
 * like a flat line. The interesting variation is the variation.
 *
 * The range is padded by a fraction of the spread so the extremes are not drawn
 * on the frame, with a floor for the case where every value is the same — a
 * perfectly steady test would otherwise have a zero-height range to plot into.
 */

const PADDING_FRACTION = 0.15
const MINIMUM_SPAN = 10

export function fitRange(values: readonly number[]): [number, number] {
  if (values.length === 0) {
    return [0, MINIMUM_SPAN]
  }

  const low = Math.min(...values)
  const high = Math.max(...values)
  const span = Math.max(high - low, MINIMUM_SPAN)
  const padding = span * PADDING_FRACTION

  // Never below zero: a negative axis label on a speed chart is nonsense even
  // when the padding would reach for one.
  return [Math.max(0, low - padding), high + padding]
}
