import { expect, test } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'

/**
 * Every view, in both themes, at both ends of the range.
 *
 * Three batches in a row shipped a defect the unit suite could not see: a `wrong`
 * selector against an `incorrect` state, so mistyped characters had no styling at
 * all; a graph whose canvas was the right size and drew nothing, because uPlot's
 * stylesheet was never imported; and a history row whose badge sat outside the
 * right edge of a phone. Typecheck, lint and four hundred tests were green for
 * all three.
 *
 * So this file does not assert pixels — those break on a font update and teach
 * nobody anything. It asserts the three things that were actually wrong:
 *
 *   1. Nothing sticks out of the viewport.
 *   2. The theme that is painted is the theme that was asked for.
 *   3. Everything that should be on screen is on screen, with a size.
 *
 * And it attaches a screenshot of each view, so a human can look.
 */

const VIEWPORTS = [
  { name: 'wide', width: 1440, height: 900 },
  { name: 'phone', width: 375, height: 812 },
] as const

const THEMES = ['light', 'dark'] as const

/** Canvas colour per theme, from src/styles/tokens.css. */
const CANVAS = { light: '#eae6dd', dark: '#16181a' } as const

const FIXED_NOW = 1_753_660_800_000

/**
 * Pins everything that would otherwise differ between runs: the word list, the
 * test ids, and the dates history renders.
 */
async function makeDeterministic(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let state = 0x9e_37_79_b9

    Math.random = () => {
      state = (state + 0x6d_2b_79_f5) | 0

      let t = Math.imul(state ^ (state >>> 15), 1 | state)

      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t

      return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
    }

    const fixed = 1_753_660_800_000

    Date.now = () => fixed
  })
}

type SeedTest = {
  readonly id: string
  readonly wpm: number
  readonly accuracy: number
  readonly daysAgo: number
  readonly punctuation?: boolean
  readonly virtual?: boolean
}

/**
 * Writes records straight into IndexedDB in idb-keyval's own shape, so the app
 * boots with a history rather than being driven into one.
 */
async function seedHistory(page: Page, tests: readonly SeedTest[]): Promise<void> {
  await page.evaluate(
    async ({ records, now }) => {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('crudu', 1)

        open.onupgradeneeded = () => {
          open.result.createObjectStore('store')
        }

        open.onerror = () => {
          reject(new Error('cannot open crudu'))
        }

        open.onsuccess = () => {
          const transaction = open.result.transaction('store', 'readwrite')
          const store = transaction.objectStore('store')

          for (const record of records) {
            store.put(
              {
                id: record.id,
                startedAt: now - record.daysAgo * 86_400_000,
                config: {
                  mode: 'words',
                  value: 25,
                  punctuation: record.punctuation === true,
                  numbers: false,
                  adaptive: false,
                },
                inputSource: record.virtual === true ? 'virtual' : 'physical',
                derived: {
                  wpm: record.wpm,
                  raw: record.wpm + 5,
                  accuracy: record.accuracy,
                  consistency: 78,
                  chars: { correct: 120, incorrect: 4, extra: 0, missed: 1 },
                },
                log: null,
              },
              `test:${record.id}`,
            )
          }

          transaction.oncomplete = () => {
            open.result.close()
            resolve()
          }
        }
      })
    },
    { records: tests, now: FIXED_NOW },
  )
}

/**
 * Types word by word, reading each one as it is reached.
 *
 * Reading the whole script up front does not work on a phone: only the lines
 * near the cursor are mounted, so a 25 word test would be typed 20 words deep
 * and never finish.
 */
async function typeWords(page: Page, count: number, wrongAt: readonly number[] = []): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    if ((await page.locator('.results').count()) > 0) {
      return
    }

    const word = await page.evaluate(
      (at: number) => document.querySelectorAll('.word')[at]?.textContent ?? '',
      index,
    )

    if (word === '') {
      return
    }

    for (const [position, character] of [...word].entries()) {
      await page.keyboard.press(position === 1 && wrongAt.includes(index) ? 'z' : character)
    }

    if (index < count - 1) {
      await page.keyboard.press('Space')
    }
  }
}

async function selectWordsMode(page: Page, count: string): Promise<void> {
  await page.getByRole('button', { name: 'words', exact: true }).click()
  await page.getByRole('button', { name: count, exact: true }).click()
}

/** Nothing may extend past the right edge. This is the history-row bug. */
async function assertNoOverflow(page: Page, viewportWidth: number): Promise<void> {
  const offenders = await page.evaluate((limit: number) => {
    const out: string[] = []

    for (const element of document.querySelectorAll('body *')) {
      const box = element.getBoundingClientRect()

      if (box.width > 0 && box.right > limit + 1) {
        out.push(`${element.className || element.tagName} right=${String(Math.round(box.right))}`)
      }
    }

    return out.slice(0, 5)
  }, viewportWidth)

  expect(offenders, 'elements past the right edge of the viewport').toEqual([])
}

/** The theme that is painted is the theme that was asked for. */
async function assertTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  const canvas = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim().toLowerCase(),
  )

  expect(canvas, `--canvas under the ${theme} theme`).toBe(CANVAS[theme])
}

/** Everything named is on screen and has a size. This is the invisible graph. */
async function assertVisible(page: Page, selectors: readonly string[]): Promise<void> {
  for (const selector of selectors) {
    const box = await page.locator(selector).first().boundingBox()

    expect(box, `${selector} is not rendered`).not.toBeNull()
    expect(box?.width ?? 0, `${selector} has no width`).toBeGreaterThan(0)
    expect(box?.height ?? 0, `${selector} has no height`).toBeGreaterThan(0)
  }
}

async function capture(page: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
}

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    test.describe(`${viewport.name} ${theme}`, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: theme,
      })

      test.beforeEach(async ({ page }) => {
        await makeDeterministic(page)
        // Reduced motion holds the entrance sequence still, so a screenshot
        // taken mid-animation is not what fails.
        await page.emulateMedia({ reducedMotion: 'reduce' })
      })

      test('test idle and test active', async ({ page }, info) => {
        await page.goto('/')
        await page.waitForSelector('.surface-line')

        await assertTheme(page, theme)
        await assertVisible(page, ['.config-bar', '.surface-line', '.caret', '.trace-track', '.hint'])
        await assertNoOverflow(page, viewport.width)
        await capture(page, info, 'test-idle')

        await typeWords(page, 3, [1])

        await assertVisible(page, ['.counter', '.char[data-state="correct"]', '.char[data-state="incorrect"]'])
        await expect(page.locator('.config-bar')).toHaveAttribute('data-hidden', 'true')
        await assertNoOverflow(page, viewport.width)
        await capture(page, info, 'test-active')
      })

      test('results, calibrating', async ({ page }, info) => {
        await page.goto('/')
        await page.waitForSelector('.surface-line')
        await selectWordsMode(page, '10')
        await typeWords(page, 10, [2])
        await page.waitForSelector('.results')

        await assertTheme(page, theme)
        await assertVisible(page, ['.results-number', '.wpm-graph canvas', '.results-secondary', '.card'])
        await expect(page.locator('.card')).toContainText('Calibrating')
        await assertNoOverflow(page, viewport.width)
        await capture(page, info, 'results-calibrating')
      })

      test('results with history and a personal best', async ({ page }, info) => {
        await page.goto('/')
        await seedHistory(page, [
          { id: 'a', wpm: 62, accuracy: 97, daysAgo: 1 },
          { id: 'b', wpm: 58, accuracy: 95, daysAgo: 2 },
          { id: 'c', wpm: 64, accuracy: 98, daysAgo: 3 },
          { id: 'd', wpm: 41, accuracy: 93, daysAgo: 1, virtual: true },
          { id: 'e', wpm: 70, accuracy: 96, daysAgo: 5, punctuation: true },
        ])
        await page.reload()
        await page.waitForSelector('.surface-line')
        await selectWordsMode(page, '25')
        await typeWords(page, 25, [3, 9])
        await page.waitForSelector('.results')

        await assertTheme(page, theme)
        await assertVisible(page, ['.results-number', '.wpm-graph canvas', '.history-rows'])
        await expect(page.locator('.delta').first()).toContainText('7 day median')
        await expect(page.locator('.tag[data-kind="virtual"]').first()).toBeVisible()
        await assertNoOverflow(page, viewport.width)
        await capture(page, info, 'results-history')
      })
    })
  }
}
