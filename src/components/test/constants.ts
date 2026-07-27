/**
 * Geometry and timing for the test surface, read off docs/DESIGN.md.
 *
 * These exist in TypeScript as well as in tokens.css because the caret is
 * positioned arithmetically. Invariant 3 forbids measuring the DOM on a
 * keystroke, so the line height and the font size have to be numbers the
 * layout code already knows rather than values it reads back from an element.
 */

export const SURFACE = {
  fontSizePx: 28,
  fontSizeNarrowPx: 20,
  /**
   * 400, not the 420 the prototype asked for. IBM Plex Mono is loaded as static
   * 400 and 600, so 420 was being synthesised, and a synthesised weight changes
   * glyph advance. The cached charWidth would then disagree with what is
   * painted, and the caret would drift along the line.
   */
  fontWeight: 400,
  lineHeightPx: 46,
  lineHeightNarrowPx: 34,
  /** Three lines visible, active line held in the middle, completed lines scroll up. */
  visibleLines: 3,
  viewportSlackPx: 10,
  measureCh: 62,
  measureNarrowCh: 32,
  /** Repeated in themes.css because @media cannot read a custom property. */
  narrowBreakpointPx: 620,
  /** The block sits at this fraction of viewport height. */
  blockTopViewportPercent: 46,
  /** Lines scroll up on this transition. Compositor only: translate3d. */
  scrollTransitionMs: 120,
} as const

export const CARET = {
  widthPx: 2,
  /** Caret height is font size plus this. */
  heightSlackPx: 4,
  transitionMs: 90,
  /** Reduced motion keeps the caret moving, only faster. A caret that teleports
   * is harder to track, which is an accessibility regression. */
  reducedMotionTransitionMs: 40,
  glowBlurPx: 6,
  glowAlphaPercent: 30,
  blinkPeriodMs: 1100,
  /** Blink stops on the first keystroke and resumes after this much idle time. */
  blinkResumeAfterIdleMs: 800,
} as const

/** The signature element. Scales on X only, origin left, never width. */
export const TRACE = {
  heightPx: 1,
  transitionMs: 90,
} as const

export const CHAR = {
  /** Fast and linear. A springy state change reads as lag, because the user's
   * mental model is that the letter turns red the instant they mistype. */
  colorTransitionMs: 60,
  /** Wrong characters carry an underline as well as the error colour, so that
   * colour is never the only signal (invariant 9). */
  wrongUnderlinePx: 2,
  /**
   * Wrong and extra are both --error at full strength, told apart by underline
   * style. They used to differ by opacity: extra rendered at 0.6, which put it
   * at 2.42:1 against the light canvas and meant the only thing separating two
   * error states was how faint one of them was.
   */
  wrongUnderlineStyle: 'solid',
  extraUnderlineStyle: 'wavy',
} as const

export const CONFIG_BAR = {
  /** Fades to zero on the first keystroke, returns on Escape. */
  fadeMs: 180,
} as const

export const FOCUS_LOST = {
  blurPx: 4,
  opacity: 0.5,
  transitionMs: 180,
} as const

/** Counter type size, top left. No live WPM: a live number pulls the eye off the text. */
export const COUNTER = {
  fontSizePx: 13,
} as const
