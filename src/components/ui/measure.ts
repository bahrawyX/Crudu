/**
 * One answer to "how wide is this screen", for every screen.
 *
 * docs/DESIGN.md gives three pixel measures and one character measure, plus a
 * single breakpoint at 620px. It does not say what happens between 620px and
 * the ~1090px a 62 character line needs at 28px, and DESIGN.md 3.8 records that
 * gap as unspecified. The rule below closes it once, here, rather than each
 * component inventing its own. See docs/DECISIONS.md 3.2.
 *
 * The rule:
 *
 *   Screens measured in pixels are fluid. width: 100%, a max-width from the
 *   token set, and a 24px gutter. max-width already degrades continuously, so
 *   they need no intermediate breakpoint and get none.
 *
 *   Screens measured in characters — only the test surface — fit to the
 *   viewport: min(design measure, what actually fits). Characters cannot be
 *   made narrower, so the count has to give.
 *
 *   Below 620px both change together: type steps down, --muted-narrow and
 *   --error-narrow bind, and the character measure drops to 32.
 */

export const GUTTER_PX = 24

export const NARROW_BREAKPOINT_PX = 620

/** Pixel measures from docs/DESIGN.md 1.4. */
export const SCREEN_WIDTH = {
  /** Header only. */
  shell: 1200,
  /** Results, progress, weakness, history. */
  content: 860,
  /** Settings, and the improved-this-week list. */
  panel: 520,
} as const

export type ScreenWidth = keyof typeof SCREEN_WIDTH

/** Narrower than this and a 62 character line would not be readable anyway. */
export const MIN_CHARACTER_MEASURE = 20

export function isNarrowViewport(viewportWidth: number): boolean {
  return viewportWidth <= NARROW_BREAKPOINT_PX
}

/**
 * How many characters fit on one line. Never more than the design asks for,
 * never fewer than are legible.
 */
export function fitCharacterMeasure(
  designMeasure: number,
  charWidth: number,
  viewportWidth: number,
  gutterPx: number = GUTTER_PX,
): number {
  if (charWidth <= 0) {
    return MIN_CHARACTER_MEASURE
  }

  const usable = viewportWidth - gutterPx * 2

  return Math.max(MIN_CHARACTER_MEASURE, Math.min(designMeasure, Math.floor(usable / charWidth)))
}
