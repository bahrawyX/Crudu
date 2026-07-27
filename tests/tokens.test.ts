import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * The theme switch has to be total. A token that exists in one palette and not
 * the other produces a screen that is mostly dark with one light element, which
 * is the kind of bug nobody notices until a user reports it.
 *
 * These tests read the stylesheets as text rather than through a browser on
 * purpose: they run in CI on every push, where a browser does not. The browser
 * proof that the swap actually repaints lives in e2e/theme.spec.ts.
 */

/**
 * Comments in these files quote selectors and token names while explaining the
 * reasoning behind them. Parsing has to see the rules, not the prose.
 */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

const tokensCss = stripComments(readFileSync('src/styles/tokens.css', 'utf8'))
const themesCss = stripComments(readFileSync('src/styles/themes.css', 'utf8'))

function declaredWithPrefix(css: string, prefix: string): string[] {
  const pattern = new RegExp(`--${prefix}-([a-z0-9-]+)\\s*:`, 'g')

  return [...css.matchAll(pattern)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined)
    .sort()
}

/** The declaration body of the first rule whose selector contains `marker`. */
function blockContaining(css: string, marker: string): string {
  const selectorAt = css.indexOf(marker)

  expect(selectorAt, `no rule mentions ${marker}`).toBeGreaterThan(-1)

  const open = css.indexOf('{', selectorAt)
  const close = css.indexOf('}', open)

  expect(open, `no block opens after ${marker}`).toBeGreaterThan(-1)
  expect(close, `no block closes after ${marker}`).toBeGreaterThan(open)

  return css.slice(open + 1, close)
}

function declaredNames(block: string): string[] {
  return [...block.matchAll(/(--[a-z0-9-]+)\s*:/g)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined)
    .sort()
}

const lightPalette = declaredWithPrefix(tokensCss, 'light')
const darkPalette = declaredWithPrefix(tokensCss, 'dark')

describe('tokens.css carries both palettes', () => {
  it('declares a light palette', () => {
    expect(lightPalette.length).toBeGreaterThan(0)
  })

  it('declares exactly the same names in both palettes', () => {
    expect(darkPalette).toEqual(lightPalette)
  })

  it('covers the nine semantic colours docs/DESIGN.md defines', () => {
    expect(lightPalette).toEqual([
      'accent',
      'canvas',
      'error',
      'error-strong',
      'hairline',
      'ink',
      'muted',
      'muted-strong',
      'surface',
    ])
  })

  it('gives every palette entry a literal colour, never a var reference', () => {
    for (const name of lightPalette) {
      const light = new RegExp(`--light-${name}:\\s*#[0-9a-f]{6}`).test(tokensCss)
      const dark = new RegExp(`--dark-${name}:\\s*#[0-9a-f]{6}`).test(tokensCss)

      expect(light, `--light-${name} is not a hex literal`).toBe(true)
      expect(dark, `--dark-${name} is not a hex literal`).toBe(true)
    }
  })
})

describe('themes.css binds every semantic name in every theme', () => {
  const semantic = lightPalette.map((name) => `--${name}`).sort()

  const light = blockContaining(themesCss, ":root[data-theme='light']")
  const dark = blockContaining(themesCss, ":root[data-theme='dark']")
  const systemDark = blockContaining(themesCss, ':root:not([data-theme])')

  it('binds all of them in the light block', () => {
    expect(declaredNames(light).filter((name) => semantic.includes(name))).toEqual(semantic)
  })

  it('binds all of them in the dark block', () => {
    expect(declaredNames(dark).filter((name) => semantic.includes(name))).toEqual(semantic)
  })

  it('binds all of them in the prefers-color-scheme fallback', () => {
    expect(declaredNames(systemDark).filter((name) => semantic.includes(name))).toEqual(semantic)
  })

  it('points each block at the matching palette', () => {
    for (const name of lightPalette) {
      expect(light).toContain(`--${name}: var(--light-${name})`)
      expect(dark).toContain(`--${name}: var(--dark-${name})`)
      expect(systemDark).toContain(`--${name}: var(--dark-${name})`)
    }
  })

  it('sets color-scheme alongside the palette so form controls follow', () => {
    expect(light).toContain('color-scheme: light')
    expect(dark).toContain('color-scheme: dark')
    expect(systemDark).toContain('color-scheme: dark')
  })
})

describe('the switch stays in CSS', () => {
  it('scopes the media-query fallback so an explicit data-theme always wins', () => {
    expect(themesCss).toContain(':root:not([data-theme])')
  })

  it('keeps the caret transition alive under reduced motion', () => {
    const indexCss = stripComments(readFileSync('src/styles/index.css', 'utf8'))
    const reducedMotionAt = indexCss.indexOf('prefers-reduced-motion')
    const caretOverride = indexCss.slice(reducedMotionAt).includes('--duration-caret-reduced')

    expect(reducedMotionAt).toBeGreaterThan(-1)
    expect(caretOverride, 'reduced motion must keep the caret moving at 40ms').toBe(true)
  })
})
