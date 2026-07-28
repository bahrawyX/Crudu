import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import {
  POPULATED_BIGRAMS,
  POPULATED_TESTS,
  assertBlockAnchor,
  assertNoOverflow,
  assertTheme,
  assertVisible,
  capture,
  makeDeterministic,
  seed,
  selectWordsMode,
  typeWords,
} from './helpers'
import type { Theme } from './helpers'

/**
 * Every screen, in both themes, at both ends of the range.
 *
 * Four batches in a row shipped a defect no unit test could see: a `wrong`
 * selector against an `incorrect` state; a graph whose canvas was the right size
 * and drew nothing; a history row whose badge sat outside the right edge of a
 * phone; and a surface that rendered nothing at all when the font CDN stalled.
 * Typecheck, lint and four hundred tests were green for every one of them.
 *
 * These are not pixel snapshots. A pixel diff breaks on a font update and
 * teaches nobody anything; these assert what was actually wrong — nothing
 * overflows, the painted theme is the one asked for, everything named is on
 * screen with a size — and attach an image so a human can still look.
 */

const VIEWPORTS = [
  { name: 'wide', width: 1440, height: 900 },
  { name: 'phone', width: 375, height: 812 },
] as const

const THEMES: readonly Theme[] = ['light', 'dark']

/** docs/DESIGN.md 6. The bans that can be checked from the DOM. */
async function assertBans(page: Page, typing: boolean): Promise<void> {
  const findings = await page.evaluate((duringTest: boolean) => {
    const problems: string[] = []
    const text = document.body.innerText

    // No live WPM during a test. A number that changes while you type pulls the
    // eye off the text, which is the one thing the screen exists to show.
    if (duringTest && /\bwpm\b/i.test(text)) {
      problems.push('the word wpm appears while a test is running')
    }

    // No scroll cues. The surface clips at three lines; no fade, no gradient
    // mask, no arrow, no scrollbar.
    const surface = document.querySelector('.surface-viewport')

    if (surface !== null) {
      const style = getComputedStyle(surface)

      if (style.overflow !== 'hidden') {
        problems.push(`surface overflow is ${style.overflow}, not hidden`)
      }

      if (style.maskImage !== 'none' || style.getPropertyValue('-webkit-mask-image') !== 'none') {
        problems.push('surface carries a mask, which is a scroll cue')
      }
    }

    // No three-equal-card rows. The results secondary stats are bare label and
    // value pairs; exactly one card exists on the whole screen.
    const cards = document.querySelectorAll('.card')

    if (cards.length > 1) {
      problems.push(`${String(cards.length)} cards on one screen`)
    }

    for (const row of document.querySelectorAll('.results-secondary, .history-rows')) {
      const bordered = [...row.children].filter((child) => {
        const style = getComputedStyle(child)

        return style.borderTopWidth !== '0px' || style.backgroundColor !== 'rgba(0, 0, 0, 0)'
      })

      if (bordered.length >= 3) {
        problems.push('a row of three or more bordered or filled cards')
      }
    }

    return problems
  }, typing)

  expect(findings, 'docs/DESIGN.md 6 bans').toEqual([])
}

async function assertAxeClean(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  const violations = results.violations.map(
    (violation) => `${violation.id} (${String(violation.nodes.length)}): ${violation.help}`,
  )

  expect(violations, `axe on ${label}`).toEqual([])
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
        await page.emulateMedia({ reducedMotion: 'reduce' })
      })

      test('test idle and test active', async ({ page }, info) => {
        await page.goto('/')
        await page.waitForSelector('.surface-line')

        await assertTheme(page, theme)
        await assertVisible(page, [
          '.chrome',
          '.nav',
          '.config-bar',
          '.surface-line',
          '.caret',
          '.trace-track',
          '.hint',
        ])
        await assertBlockAnchor(page)
        await assertNoOverflow(page, viewport.width)
        await assertBans(page, false)
        await assertAxeClean(page, 'test idle')
        await capture(page, info, 'test-idle')

        await typeWords(page, 3, [1])

        await assertVisible(page, [
          '.counter',
          '.char[data-state="correct"]',
          '.char[data-state="incorrect"]',
        ])
        await expect(page.locator('.config-bar')).toHaveAttribute('data-hidden', 'true')
        await assertNoOverflow(page, viewport.width)
        await assertBans(page, true)
        await capture(page, info, 'test-active')
      })

      test('results, calibrating', async ({ page }, info) => {
        await page.goto('/')
        await page.waitForSelector('.surface-line')
        await selectWordsMode(page, '10')
        await typeWords(page, 10, [2])
        await page.waitForSelector('.results')

        await assertTheme(page, theme)
        await assertVisible(page, ['.results-number', '.wpm-graph canvas', '.card'])
        await expect(page.locator('.card')).toContainText('Calibrating')
        await assertNoOverflow(page, viewport.width)
        await assertBans(page, false)
        await assertAxeClean(page, 'results calibrating')
        await capture(page, info, 'results-calibrating')
      })

      test('results with history, a personal best and the weakness card', async ({ page }, info) => {
        await page.goto('/')
        await seed(page, POPULATED_TESTS, POPULATED_BIGRAMS)
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
        await assertBans(page, false)
        await assertAxeClean(page, 'results with history')
        await capture(page, info, 'results-history')
      })

      test('weakness report', async ({ page }, info) => {
        await page.goto('/')
        await seed(page, POPULATED_TESTS, POPULATED_BIGRAMS)
        await page.reload()
        await page.waitForSelector('.surface-line')
        await page.getByRole('button', { name: 'Weaknesses' }).click()
        await page.waitForSelector('.weakness-report')

        await assertTheme(page, theme)
        await assertVisible(page, ['.report-row', '.report-track', '.report-bar', '.report-note'])
        await expect(page.locator('.report-note', { hasText: 'Needs more data' }).first()).toBeVisible()
        await assertNoOverflow(page, viewport.width)
        await assertBans(page, false)
        await assertAxeClean(page, 'weakness report')
        await capture(page, info, 'weakness-report')
      })

      test('progress, populated and empty', async ({ page }, info) => {
        await page.goto('/')
        await page.waitForSelector('.surface-line')
        await page.getByRole('button', { name: 'Progress' }).click()

        // Nothing plotted until three tests exist, and the empty state says so.
        await expect(page.locator('.empty-title')).toHaveText('Nothing plotted yet.')
        await expect(page.locator('.empty-body')).toHaveText(
          'Run three tests and your first line appears here.',
        )
        await assertNoOverflow(page, viewport.width)
        await assertAxeClean(page, 'progress empty')
        await capture(page, info, 'progress-empty')

        await seed(page, POPULATED_TESTS, POPULATED_BIGRAMS)
        await page.reload()
        await page.waitForSelector('.surface-line')
        await page.getByRole('button', { name: 'Progress' }).click()
        await page.waitForSelector('.progress-chart canvas')

        await assertTheme(page, theme)
        await assertVisible(page, ['.progress-chart canvas', '.progress-axis'])
        await assertNoOverflow(page, viewport.width)
        await assertAxeClean(page, 'progress populated')
        await capture(page, info, 'progress-populated')
      })

      test('drill', async ({ page }, info) => {
        await page.goto('/')
        await seed(page, POPULATED_TESTS, POPULATED_BIGRAMS)
        await page.reload()
        await page.waitForSelector('.drill-banner')

        await assertTheme(page, theme)
        await assertVisible(page, ['.drill-banner', '.drill-pair', '.surface-line'])
        await expect(page.locator('.drill-banner')).toContainText('Drilling')
        await assertNoOverflow(page, viewport.width)
        await assertBans(page, false)
        await assertAxeClean(page, 'drill')
        await capture(page, info, 'drill')
      })

      test('tab then enter restarts', async ({ page }) => {
        await page.goto('/')
        await page.waitForSelector('.surface-line')
        await typeWords(page, 1)

        const before = await page.locator('.char[data-state="correct"]').count()

        expect(before).toBeGreaterThan(0)

        // The restart control is first in tab order and reveals itself on focus.
        await page.keyboard.press('Tab')
        await expect(page.locator('.restart-control')).toBeFocused()
        await page.keyboard.press('Enter')

        await expect(page.locator('.char[data-state="correct"]')).toHaveCount(0)
      })
    })
  }
}

/**
 * The font is served by a CDN, and document.fonts.ready does not resolve while
 * that request is in flight. Before the timeout the surface rendered nothing at
 * all, indefinitely, on a slow or blocked network — found by this file on its
 * first run and fixed by measuring the fallback and rendering anyway.
 */
test.describe('network degraded', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('renders the surface with the font CDN blocked', async ({ page }, info) => {
    await makeDeterministic(page)
    await page.route('**://fonts.googleapis.com/**', async (route) => route.abort())
    await page.route('**://fonts.gstatic.com/**', async (route) => route.abort())

    await page.goto('/')

    await expect(page.locator('.surface-line').first()).toBeVisible({ timeout: 10_000 })
    await assertVisible(page, ['.surface-line', '.caret', '.config-bar'])

    // And it is still usable, not merely present.
    await typeWords(page, 2)
    await expect(page.locator('.char[data-state="correct"]').first()).toBeVisible()

    await capture(page, info, 'font-blocked')
  })
})
