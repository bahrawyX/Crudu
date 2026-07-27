import { type Page, expect, test } from '@playwright/test'

/**
 * Proves the claim that tokens.css and themes.css make: swapping the theme is a
 * CSS operation.
 *
 * The only JavaScript in the switch is a single attribute write, which is what
 * a real theme control does. Nothing recomputes a colour, walks the tree or
 * re-renders. The prefers-color-scheme case below involves no JavaScript at all
 * beyond reading the result back.
 */

const SEMANTIC_TOKENS = [
  '--canvas',
  '--surface',
  '--ink',
  '--muted',
  '--muted-strong',
  '--accent',
  '--accent-text',
  '--error',
  '--error-strong',
  '--hairline',
] as const

type TokenMap = Record<string, string>

async function readTokens(page: Page): Promise<TokenMap> {
  return page.evaluate((names: readonly string[]) => {
    const computed = getComputedStyle(document.documentElement)
    const out: Record<string, string> = {}

    for (const name of names) {
      out[name] = computed.getPropertyValue(name).trim()
    }

    out['background-color'] = computed.backgroundColor

    return out
  }, SEMANTIC_TOKENS)
}

test('data-theme swaps every token, and the attribute beats the media query', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')

  const systemLight = await readTokens(page)

  for (const token of SEMANTIC_TOKENS) {
    expect(systemLight[token], `${token} is unset`).not.toBe('')
  }

  // No attribute, dark system preference. Pure media query, zero JavaScript.
  await page.emulateMedia({ colorScheme: 'dark' })
  const systemDark = await readTokens(page)

  for (const token of SEMANTIC_TOKENS) {
    expect(systemDark[token], `${token} did not follow prefers-color-scheme`).not.toBe(
      systemLight[token],
    )
  }

  expect(systemDark['background-color']).not.toBe(systemLight['background-color'])

  // One attribute write, against a dark system preference. The explicit theme
  // has to win, otherwise the settings screen would be a no-op for half the users.
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light')
  })
  const forcedLight = await readTokens(page)

  expect(forcedLight).toEqual(systemLight)

  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
  })
  const forcedDark = await readTokens(page)

  expect(forcedDark).toEqual(systemDark)
})

test('every token changes value between the two themes', async ({ page }) => {
  await page.goto('/')

  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light')
  })
  const light = await readTokens(page)

  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
  })
  const dark = await readTokens(page)

  for (const token of SEMANTIC_TOKENS) {
    expect(dark[token], `${token} is identical in both themes`).not.toBe(light[token])
  }
})

/**
 * The narrow substitutes. Below 620px the surface steps from 28px to 20px and
 * --muted and --error rebind to values that clear 4.5:1 rather than 3:1.
 *
 * The ordering here is the fiddly part and the reason this is an e2e test
 * rather than a string match: the narrow block's bare :root selector would
 * leave a dark-system phone on the light substitutes, so a second media query
 * scoped to :root:not([data-theme]) has to follow it. Nothing in the CSS source
 * makes that visible. Only the cascade does.
 */
const NARROW = { width: 375, height: 812 }
const WIDE = { width: 1280, height: 800 }

async function readTwo(page: Page): Promise<{ muted: string; error: string }> {
  return page.evaluate(() => {
    const computed = getComputedStyle(document.documentElement)

    return {
      muted: computed.getPropertyValue('--muted').trim(),
      error: computed.getPropertyValue('--error').trim(),
    }
  })
}

test('the narrow breakpoint substitutes muted and error in every theme state', async ({ page }) => {
  await page.goto('/')

  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((value) => {
      document.documentElement.setAttribute('data-theme', value)
    }, theme)

    await page.setViewportSize(WIDE)
    const wide = await readTwo(page)

    await page.setViewportSize(NARROW)
    const narrow = await readTwo(page)

    expect(narrow.muted, `${theme}: --muted did not substitute`).not.toBe(wide.muted)

    if (theme === 'light') {
      expect(narrow.error, 'light: --error did not substitute').not.toBe(wide.error)
    } else {
      // Dark --error already clears 4.5:1 at 5.34:1, so its substitute is itself.
      expect(narrow.error, 'dark: --error should be unchanged').toBe(wide.error)
    }
  }

  // No attribute, dark system preference, narrow. This is the case the second
  // media query exists for.
  await page.evaluate(() => {
    document.documentElement.removeAttribute('data-theme')
  })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.setViewportSize(NARROW)
  const systemDarkNarrow = await readTwo(page)

  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
  })
  const forcedDarkNarrow = await readTwo(page)

  expect(systemDarkNarrow).toEqual(forcedDarkNarrow)
})
