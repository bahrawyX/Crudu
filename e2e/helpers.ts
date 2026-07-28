import { expect } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'

/** Canvas colour per theme, from src/styles/tokens.css. */
export const CANVAS = { light: '#eae6dd', dark: '#16181a' } as const

export type Theme = keyof typeof CANVAS

export const FIXED_NOW = 1_753_660_800_000

/** Pins the word list, the test ids and the dates history renders. */
export async function makeDeterministic(page: Page): Promise<void> {
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

export type SeedTest = {
  readonly id: string
  readonly wpm: number
  readonly accuracy: number
  readonly daysAgo: number
  readonly punctuation?: boolean
  readonly virtual?: boolean
}

export type SeedBigram = {
  readonly pair: string
  readonly ewmaMs: number
  readonly n: number
}

/**
 * Writes records straight into IndexedDB in idb-keyval's own shape, so the app
 * boots with a history rather than being driven into one.
 */
export async function seed(
  page: Page,
  tests: readonly SeedTest[],
  bigrams: readonly SeedBigram[] = [],
): Promise<void> {
  await page.evaluate(
    async ({ records, pairs, now }) => {
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

          for (const pair of pairs) {
            store.put(
              { pair: pair.pair, ewmaMs: pair.ewmaMs, n: pair.n, errorRate: 0.04, lastSeen: now },
              `bigram:${pair.pair}`,
            )
          }

          transaction.oncomplete = () => {
            open.result.close()
            resolve()
          }
        }
      })
    },
    { records: tests, pairs: bigrams, now: FIXED_NOW },
  )
}

/** Enough history and bigram evidence to reach every screen in a populated state. */
export const POPULATED_TESTS: readonly SeedTest[] = [
  { id: 'a', wpm: 62, accuracy: 97, daysAgo: 1 },
  { id: 'b', wpm: 58, accuracy: 95, daysAgo: 2 },
  { id: 'c', wpm: 64, accuracy: 98, daysAgo: 3 },
  { id: 'd', wpm: 41, accuracy: 93, daysAgo: 1, virtual: true },
  { id: 'e', wpm: 70, accuracy: 96, daysAgo: 5, punctuation: true },
  { id: 'f', wpm: 66, accuracy: 97, daysAgo: 6 },
]

export const POPULATED_BIGRAMS: readonly SeedBigram[] = [
  { pair: 'ol', ewmaMs: 312, n: 44 },
  { pair: 'un', ewmaMs: 298, n: 41 },
  { pair: 'ce', ewmaMs: 287, n: 40 },
  { pair: 'rt', ewmaMs: 276, n: 38 },
  { pair: 'br', ewmaMs: 268, n: 36 },
  { pair: 'gh', ewmaMs: 241, n: 33 },
  { pair: 'pl', ewmaMs: 232, n: 31 },
  { pair: 'th', ewmaMs: 128, n: 52 },
  { pair: 'he', ewmaMs: 119, n: 50 },
  { pair: 'zi', ewmaMs: 210, n: 4 },
]

/** Types word by word, reading each as it is reached. */
export async function typeWords(
  page: Page,
  count: number,
  wrongAt: readonly number[] = [],
): Promise<void> {
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

export async function selectWordsMode(page: Page, count: string): Promise<void> {
  const mode = page.getByRole('button', { name: 'words', exact: true })

  await mode.scrollIntoViewIfNeeded()
  await mode.click()

  const value = page.getByRole('button', { name: count, exact: true })

  await value.scrollIntoViewIfNeeded()
  await value.click()
}

/** Nothing may extend past the right edge. */
export async function assertNoOverflow(page: Page, viewportWidth: number): Promise<void> {
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

/**
 * docs/DESIGN.md 266. The middle of the three lines sits at 46% of viewport
 * height, and every other number on the screen is arranged around that one.
 *
 * Asserted rather than trusted because the margin that achieves it subtracts the
 * heights of the header and the config bar as pinned constants, and the config
 * bar wraps. It was 59px out on desktop and 130px on a phone for two batches
 * without anything noticing. See docs/DECISIONS.md 5.6.
 */
export async function assertBlockAnchor(page: Page): Promise<void> {
  const measured = await page.evaluate(() => {
    const middle = document.querySelectorAll('.surface-line')[1]?.getBoundingClientRect()

    return {
      centre: middle === undefined ? null : middle.top + middle.height / 2,
      target: window.innerHeight * 0.46,
    }
  })

  expect(measured.centre, 'no second surface line to anchor against').not.toBeNull()

  const centre = measured.centre ?? 0
  const drift = Math.round(centre - measured.target)

  expect(Math.abs(drift), `middle surface line is ${String(drift)}px from 46vh`).toBeLessThanOrEqual(
    2,
  )
}

export async function assertTheme(page: Page, theme: Theme): Promise<void> {
  const canvas = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim().toLowerCase(),
  )

  expect(canvas, `--canvas under the ${theme} theme`).toBe(CANVAS[theme])
}

export async function assertVisible(page: Page, selectors: readonly string[]): Promise<void> {
  for (const selector of selectors) {
    const box = await page.locator(selector).first().boundingBox()

    expect(box, `${selector} is not rendered`).not.toBeNull()
    expect(box?.width ?? 0, `${selector} has no width`).toBeGreaterThan(0)
    expect(box?.height ?? 0, `${selector} has no height`).toBeGreaterThan(0)
  }
}

export async function capture(page: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
}
