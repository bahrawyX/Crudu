/**
 * Character width, measured once and cached.
 *
 * ARCHITECTURE.md 4.1: if every character is the same width, caret position is
 * arithmetic. `charWidth` is measured when the font loads and never again, and
 * nothing on the keystroke path ever asks the DOM how wide anything is.
 *
 * canvas.measureText does not touch the document, so it forces no layout. It is
 * the only measurement in the whole test surface.
 */

export type FontSpec = {
  readonly sizePx: number
  readonly weight: number
  readonly family: string
}

const cache = new Map<string, number>()

function keyOf(font: FontSpec): string {
  return `${String(font.weight)} ${String(font.sizePx)}px ${font.family}`
}

/**
 * Measures the advance of one character. Monospace means every glyph has the
 * same advance, so '0' stands for all of them — which is also what the CSS `ch`
 * unit is defined against.
 */
export function measureCharWidth(font: FontSpec): number {
  const key = keyOf(font)
  const cached = cache.get(key)

  if (cached !== undefined) {
    return cached
  }

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (context === null) {
    throw new Error('Crudu: 2d canvas context unavailable, cannot measure the font')
  }

  context.font = key

  // Ten characters, then divide. One character's advance can land on a sub-pixel
  // boundary and round; ten averages that away, which matters because the error
  // multiplies by the column index all the way across a 62 character line.
  const width = context.measureText('0000000000').width / 10

  cache.set(key, width)

  return width
}

/**
 * Resolves once the mono face is actually available at the weight the surface
 * uses. Measuring before this resolves would measure the fallback, and a font
 * swap mid-test would then shift every character on screen.
 */
export async function whenFontReady(font: FontSpec): Promise<void> {
  // document.fonts.load wants one family, not a stack.
  const primary = font.family.split(',')[0]?.trim() ?? font.family

  await document.fonts.load(`${String(font.weight)} ${String(font.sizePx)}px ${primary}`)
  await document.fonts.ready
}

/** Test seam. The cache is module level, so suites have to be able to clear it. */
export function clearCharWidthCache(): void {
  cache.clear()
}
