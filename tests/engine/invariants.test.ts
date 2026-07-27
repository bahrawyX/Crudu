import { readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Invariants 1, 2 and 3, checked as tests as well as by ESLint.
 *
 * The lint rules in eslint.config.js are the primary gate. This suite is the
 * second one, and it exists because lint configuration is easy to loosen by
 * accident and hard to notice: a stray `files` glob edit silently stops
 * covering a directory, and nothing fails. A test that walks the real tree
 * fails loudly instead.
 */

const ENGINE_DIR = 'src/engine'
const TEST_SURFACE_DIR = 'src/components/test'

/**
 * Layout-reading APIs. The first four are the ones invariant 3 names. The rest
 * force synchronous layout in exactly the same way and the design prototype in
 * docs/design-prototype.html uses three of them, so leaving them out would
 * leave the hole
 * this rail exists to close. See docs/DECISIONS.md.
 */
const LAYOUT_READS = [
  'getBoundingClientRect',
  'offsetWidth',
  'offsetHeight',
  'getComputedStyle',
  'getClientRects',
  'offsetLeft',
  'offsetTop',
  'offsetParent',
  'clientWidth',
  'clientHeight',
  'clientLeft',
  'clientTop',
  'scrollWidth',
  'scrollHeight',
] as const

const REACT_IMPORT = /^react(-dom)?(\/|$)/
const ANIMATION_LIBRARY_IMPORT = /^(motion|framer-motion|gsap)(\/|$)/

type SourceFile = {
  readonly path: string
  readonly text: string
}

function collect(dir: string): SourceFile[] {
  const files: SourceFile[] = []

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...collect(path))
      continue
    }

    if (extname(entry.name) === '.ts' || extname(entry.name) === '.tsx') {
      files.push({ path, text: readFileSync(path, 'utf8') })
    }
  }

  return files
}

/** Every module specifier the file pulls in, static or dynamic. */
function importedModules(text: string): string[] {
  const specifiers: string[] = []
  const patterns = [
    /(?:^|\s)(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g,
    /(?:^|\s)import\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const specifier = match[1]

      if (specifier !== undefined) {
        specifiers.push(specifier)
      }
    }
  }

  return specifiers
}

/**
 * Comments carry the reasoning for these rules and naming an API there is not a
 * violation. Only code is checked.
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

const engineFiles = collect(ENGINE_DIR)
const surfaceFiles = collect(TEST_SURFACE_DIR)

describe('invariant 1: the typing engine never imports React', () => {
  it('finds engine sources to check', () => {
    expect(engineFiles.length).toBeGreaterThan(0)
  })

  it.each(engineFiles)('$path imports no react module', ({ text }) => {
    const offenders = importedModules(text).filter((specifier) => REACT_IMPORT.test(specifier))

    expect(offenders).toEqual([])
  })
})

describe('invariant 2: no JavaScript animation library on the test surface', () => {
  it('finds test surface sources to check', () => {
    expect(surfaceFiles.length).toBeGreaterThan(0)
  })

  it.each(surfaceFiles)('$path imports no animation library', ({ text }) => {
    const offenders = importedModules(text).filter((specifier) =>
      ANIMATION_LIBRARY_IMPORT.test(specifier),
    )

    expect(offenders).toEqual([])
  })
})

describe('invariant 3: zero layout reads during a test', () => {
  it.each([...engineFiles, ...surfaceFiles])('$path reads no layout', ({ text }) => {
    const code = stripComments(text)
    const offenders = LAYOUT_READS.filter((api) => code.includes(api))

    expect(offenders).toEqual([])
  })
})
