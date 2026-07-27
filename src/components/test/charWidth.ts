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
export function measureCharWidth(font: FontSpec, remeasure = false): number {
  const key = keyOf(font)
  const cached = cache.get(key)

  if (cached !== undefined && !remeasure) {
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
/**
 * Waits for the mono face, but not forever.
 *
 * The font is served by a CDN, and document.fonts.ready does not resolve while
 * that request is in flight. Without the timeout a slow or blocked network
 * leaves the surface rendering nothing at all, indefinitely — which is exactly
 * what happened the first time e2e/views.spec.ts ran.
 *
 * On timeout the caller measures the fallback and renders. If the real face
 * arrives afterwards, `whenFontChanges` fires and the caller measures again.
 */
export const FONT_WAIT_TIMEOUT_MS = 2_000

export async function whenFontReady(
  font: FontSpec,
  timeoutMs: number = FONT_WAIT_TIMEOUT_MS,
): Promise<void> {
  // document.fonts.load wants one family, not a stack.
  const primary = font.family.split(',')[0]?.trim() ?? font.family
  // A rejection here would beat the timeout and leave the caller waiting on a
  // promise that never resolves, which is the blank screen this guards against.
  const loaded = document.fonts
    .load(`${String(font.weight)} ${String(font.sizePx)}px ${primary}`)
    .then(async () => document.fonts.ready)
    .then(() => undefined)
    .catch(() => undefined)

  await Promise.race([
    loaded,
    new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs)
    }),
  ])
}

/** Fires when a face finishes loading after the surface has already rendered. */
export function whenFontChanges(onChange: () => void): () => void {
  document.fonts.addEventListener('loadingdone', onChange)

  return () => {
    document.fonts.removeEventListener('loadingdone', onChange)
  }
}

/** Test seam. The cache is module level, so suites have to be able to clear it. */
export function clearCharWidthCache(): void {
  cache.clear()
}
