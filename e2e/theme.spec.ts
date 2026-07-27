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
