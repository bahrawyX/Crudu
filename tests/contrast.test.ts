import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Contrast, computed from the tokens themselves.
 *
 * docs/DESIGN.md section 7.4 publishes a table of ratios. This suite recomputes
 * every one of them from src/styles/tokens.css, so the table cannot drift away
 * from the stylesheet without a test failing. Phase 5 adds an axe run over the
 * built app; that checks the rendered result, this checks the source values,
 * and the source values are where a regression actually starts.
 *
 * Thresholds are WCAG 2.2 AA: 4.5:1 for text below 24px regular or 18.66px
 * bold, 3:1 for anything larger and for user-interface components.
 */

const tokensCss = readFileSync('src/styles/tokens.css', 'utf8')

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(tokensCss)

  if (!match?.[1]) {
    throw new Error(`tokens.css declares no hex value for --${name}`)
  }

  return match[1]
}

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

function linear(value: number): number {
  const s = value / 255

  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex)

  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** WCAG contrast ratio, rounded to two places to match the published table. */
function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]

  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100
}

/**
 * color-mix(in oklab, <colour> <alpha>%, transparent) resolves to that colour at
 * <alpha> opacity: mixing with transparent in a premultiplied space leaves the
 * colour component untouched and only scales alpha. The browser then composites
 * it over the backdrop in gamma-encoded sRGB, which is what this reproduces.
 */
function composite(foreground: string, background: string, alpha: number): string {
  const [fr, fg, fb] = channels(foreground)
  const [br, bg, bb] = channels(background)
  const blend = (f: number, b: number): string =>
    Math.round(f * alpha + b * (1 - alpha))
      .toString(16)
      .padStart(2, '0')

  return `#${blend(fr, br)}${blend(fg, bg)}${blend(fb, bb)}`
}

const CHIP_TINT_ALPHA = 0.12

type Theme = 'light' | 'dark'

const palette = (theme: Theme) => ({
  canvas: token(`${theme}-canvas`),
  surface: token(`${theme}-surface`),
  ink: token(`${theme}-ink`),
  muted: token(`${theme}-muted`),
  mutedNarrow: token(`${theme}-muted-narrow`),
  mutedStrong: token(`${theme}-muted-strong`),
  accent: token(`${theme}-accent`),
  accentText: token(`${theme}-accent-text`),
  error: token(`${theme}-error`),
  errorNarrow: token(`${theme}-error-narrow`),
  errorStrong: token(`${theme}-error-strong`),
  hairline: token(`${theme}-hairline`),
})

describe.each<Theme>(['light', 'dark'])('%s theme meets AA where it must', (theme) => {
  const p = palette(theme)
  const chipTint = composite(p.accent, p.canvas, CHIP_TINT_ALPHA)

  describe('small text, 4.5:1', () => {
    it.each([
      ['ink on canvas', p.ink, p.canvas],
      ['ink on surface', p.ink, p.surface],
      ['muted-strong on canvas', p.mutedStrong, p.canvas],
      ['muted-strong on surface', p.mutedStrong, p.surface],
      ['accent on canvas', p.accent, p.canvas],
      ['error-strong on canvas', p.errorStrong, p.canvas],
      ['canvas on accent, the primary button', p.canvas, p.accent],
    ])('%s', (_label, fg, bg) => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
    })

    it('accent-text on the active chip tint', () => {
      expect(contrast(p.accentText, chipTint)).toBeGreaterThanOrEqual(4.5)
    })
  })

  describe('the 28px surface, 3:1', () => {
    it.each([
      ['pending characters, muted on canvas', p.muted, p.canvas],
      ['correct characters, ink on canvas', p.ink, p.canvas],
      ['wrong and extra characters, error on canvas', p.error, p.canvas],
    ])('%s', (_label, fg, bg) => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(3)
    })
  })

  describe('the 20px narrow surface, 4.5:1', () => {
    it.each([
      ['pending characters, muted-narrow on canvas', p.mutedNarrow, p.canvas],
      ['correct characters, ink on canvas', p.ink, p.canvas],
      ['wrong and extra characters, error-narrow on canvas', p.errorNarrow, p.canvas],
    ])('%s', (_label, fg, bg) => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
    })
  })

  describe('interface components, 3:1', () => {
    it.each([
      ['caret, trace, graph line and focus ring, accent on canvas', p.accent, p.canvas],
      ['weakness bar fill, accent on hairline', p.accent, p.hairline],
      ['weakness bar fill under-sampled, muted-strong on hairline', p.mutedStrong, p.hairline],
      ['wrong-character underline and error ticks, error on canvas', p.error, p.canvas],
    ])('%s', (_label, fg, bg) => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(3)
    })
  })
})

/**
 * Boundary treatments. WCAG 1.4.11 covers components that convey state or
 * boundaries needed to operate the interface; a decorative divider is neither,
 * so these are recorded rather than required.
 *
 * They are pinned to the values docs/DESIGN.md 7.4 publishes. Changing a token
 * fails here, which forces the table to be updated with it.
 */
describe('boundary treatments are recorded, not required', () => {
  it.each([
    ['light', 'hairline on canvas', 1.23],
    ['light', 'hairline on surface', 1.34],
    ['light', 'surface on canvas', 1.09],
    ['dark', 'hairline on canvas', 1.34],
    ['dark', 'hairline on surface', 1.22],
    ['dark', 'surface on canvas', 1.1],
  ] as const)('%s: %s measures %f:1', (theme, label, expected) => {
    const p = palette(theme)
    const pairs = {
      'hairline on canvas': [p.hairline, p.canvas],
      'hairline on surface': [p.hairline, p.surface],
      'surface on canvas': [p.surface, p.canvas],
    } as const satisfies Record<string, readonly [string, string]>
    const [foreground, background] = pairs[label]

    expect(contrast(foreground, background)).toBe(expected)
  })
})

/**
 * Pending against correct is the one distinction with no second signal
 * available: both are the same glyph in the same position, so colour is the
 * only channel there is. It is not a WCAG failure — neither is a UI component
 * and both clear their own contrast against the canvas — but it is the reason
 * --muted must not be pushed any closer to --ink.
 */
describe('pending stays distinguishable from correct', () => {
  it.each<Theme>(['light', 'dark'])('%s', (theme) => {
    const p = palette(theme)

    expect(contrast(p.muted, p.ink)).toBeGreaterThanOrEqual(3)
    expect(contrast(p.mutedNarrow, p.ink)).toBeGreaterThanOrEqual(2.5)
  })
})
