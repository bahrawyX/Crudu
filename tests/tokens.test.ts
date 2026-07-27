import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * The theme switch has to be total. A token that exists in one palette and not
 * the other produces a screen that is mostly dark with one light element, which
 * is the kind of bug nobody notices until a user reports it.
 *
 * These tests read the stylesheets as text rather than through a browser on
 * purpose: they run in CI on every push, where a browser does not. The browser
 * proof that the swap actually repaints lives in e2e/theme.spec.ts, and the
 * arithmetic proof that the values clear AA lives in tests/contrast.test.ts.
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
const indexCss = stripComments(readFileSync('src/styles/index.css', 'utf8'))

function declaredWithPrefix(css: string, prefix: string): string[] {
  const pattern = new RegExp(`--${prefix}-([a-z0-9-]+)\\s*:`, 'g')

  return [...css.matchAll(pattern)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined)
    .sort()
}

/** Body of the block that opens after the first occurrence of `marker`. */
function blockContaining(css: string, marker: string, from = 0): string {
  const selectorAt = css.indexOf(marker, from)

  expect(selectorAt, `no rule mentions ${marker}`).toBeGreaterThan(-1)

  const open = css.indexOf('{', selectorAt)
  const close = css.indexOf('}', open)

  expect(open, `no block opens after ${marker}`).toBeGreaterThan(-1)
  expect(close, `no block closes after ${marker}`).toBeGreaterThan(open)

  return css.slice(open + 1, close)
}

/** Body of an at-rule, brace matched so nested rules come back whole. */
function atRule(css: string, marker: string): string {
  const at = css.indexOf(marker)

  expect(at, `no at-rule matches ${marker}`).toBeGreaterThan(-1)

  const open = css.indexOf('{', at)
  let depth = 0

  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1
    if (css[i] === '}') {
      depth -= 1
      if (depth === 0) return css.slice(open + 1, i)
    }
  }

  throw new Error(`unbalanced braces after ${marker}`)
}

function declaredNames(block: string): string[] {
  return [...block.matchAll(/(--[a-z0-9-]+)\s*:/g)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined)
    .sort()
}

const isNarrow = (name: string): boolean => name.endsWith('-narrow')

const lightPalette = declaredWithPrefix(tokensCss, 'light')
const darkPalette = declaredWithPrefix(tokensCss, 'dark')
const lightBase = lightPalette.filter((name) => !isNarrow(name))
const darkBase = darkPalette.filter((name) => !isNarrow(name))
const lightNarrow = lightPalette.filter(isNarrow)

describe('tokens.css carries both palettes', () => {
  it('declares a light palette', () => {
    expect(lightPalette.length).toBeGreaterThan(0)
  })

  it('declares exactly the same names in both palettes', () => {
    expect(darkPalette).toEqual(lightPalette)
  })

  it('covers the ten semantic colours the design system defines', () => {
    expect(lightBase).toEqual([
      'accent',
      'accent-text',
      'canvas',
      'error',
      'error-strong',
      'hairline',
      'ink',
      'muted',
      'muted-strong',
      'surface',
      'track',
    ])
    expect(darkBase).toEqual(lightBase)
  })

  it('substitutes only the two colours the narrow surface size forces', () => {
    expect(lightNarrow).toEqual(['error-narrow', 'muted-narrow'])
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
  const semantic = lightBase.map((name) => `--${name}`).sort()

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
    for (const name of lightBase) {
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

describe('the narrow viewport rebinds the two colours it has to', () => {
  const narrow = atRule(themesCss, '@media (max-width: 620px)')
  const narrowSystemDark = atRule(
    themesCss,
    '@media (prefers-color-scheme: dark) and (max-width: 620px)',
  )

  it('steps the surface type down', () => {
    expect(narrow).toContain('--text-surface: var(--text-surface-narrow)')
    expect(narrow).toContain('--leading-surface: var(--leading-surface-narrow)')
    expect(narrow).toContain('--measure-surface: var(--measure-surface-narrow)')
  })

  it('rebinds muted and error in the light branch', () => {
    expect(narrow).toContain('--muted: var(--light-muted-narrow)')
    expect(narrow).toContain('--error: var(--light-error-narrow)')
  })

  it('rebinds muted and error in the dark branch', () => {
    expect(narrow).toContain('--muted: var(--dark-muted-narrow)')
    expect(narrow).toContain('--error: var(--dark-error-narrow)')
  })

  it('covers a dark system preference with no explicit theme', () => {
    expect(narrowSystemDark).toContain('--muted: var(--dark-muted-narrow)')
    expect(narrowSystemDark).toContain('--error: var(--dark-error-narrow)')
  })

  it('places the system-dark override after the light branch that would beat it', () => {
    const lightBranchAt = themesCss.indexOf(':root[data-theme=\'light\'] {\n    --muted')
    const systemAt = themesCss.indexOf('@media (prefers-color-scheme: dark) and (max-width: 620px)')

    expect(systemAt).toBeGreaterThan(themesCss.indexOf('@media (max-width: 620px)'))
    expect(systemAt).toBeGreaterThan(lightBranchAt)
  })
})

describe('wrong and extra characters are told apart by underline style', () => {
  // The engine's CharState calls it `incorrect`; docs/DESIGN.md calls it wrong.
  const wrong = blockContaining(indexCss, ".char[data-state='incorrect']")
  const extra = blockContaining(indexCss, ".char[data-state='extra']")

  it('renders both at full error strength', () => {
    expect(wrong).toContain('color: var(--error)')
    expect(extra).toContain('color: var(--error)')
  })

  it('applies no opacity to either', () => {
    expect(wrong).not.toContain('opacity')
    expect(extra).not.toContain('opacity')
  })

  it('uses a different underline style for each', () => {
    expect(wrong).toContain('var(--underline-wrong)')
    expect(extra).toContain('var(--underline-extra)')
    expect(tokensCss).toContain('--underline-wrong: solid')
    expect(tokensCss).toContain('--underline-extra: wavy')
  })

  it('draws the wave at half the weight of the rule', () => {
    // A wave's amplitude scales with its thickness, so 2px of wave reads as a
    // smear. Judged on screen, recorded in docs/DECISIONS.md 2.2.
    expect(wrong).toContain('var(--error-underline-width)')
    expect(extra).toContain('var(--extra-underline-width)')
    expect(tokensCss).toContain('--error-underline-width: 2px')
    expect(tokensCss).toContain('--extra-underline-width: 1px')
  })

  it('keeps no extra-character opacity token', () => {
    expect(tokensCss).not.toContain('--extra-char-opacity')
  })
})

describe('the switch stays in CSS', () => {
  it('scopes the media-query fallback so an explicit data-theme always wins', () => {
    expect(themesCss).toContain(':root:not([data-theme])')
  })

  it('keeps the caret transition alive under reduced motion', () => {
    const reducedMotionAt = indexCss.indexOf('prefers-reduced-motion')
    const caretOverride = indexCss.slice(reducedMotionAt).includes('--duration-caret-reduced')

    expect(reducedMotionAt).toBeGreaterThan(-1)
    expect(caretOverride, 'reduced motion must keep the caret moving at 40ms').toBe(true)
  })
})

describe('the mono face asks only for weights it loads', () => {
  it('sets the surface weight to a static weight', () => {
    expect(tokensCss).toContain('--weight-surface: 400')
  })

  it('lists no font it does not load', () => {
    expect(tokensCss).not.toContain('Commit Mono')
  })
})
