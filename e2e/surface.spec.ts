import { expect, test } from '@playwright/test'
import type { CDPSession, Page } from '@playwright/test'

/**
 * The two numbers phase 2 is judged on: no layout caused by a keystroke, and
 * keydown-to-paint inside the budget.
 *
 * Keystrokes go through CDP rather than through page.evaluate, so the events are
 * trusted, carry real hardware timestamps and are measured by the Event Timing
 * API exactly as a human's would be. A dispatched KeyboardEvent would prove
 * nothing: it never enters the browser's input pipeline.
 */

const KEYS_PER_SECOND = 8
const BUDGET_MS = 8

type Percentiles = {
  readonly p50: number
  readonly p95: number
  readonly p99: number
  readonly max: number
}

type LatencyReport = {
  readonly count: number
  readonly paint: Percentiles
  readonly processing: Percentiles
  readonly overBudget: number
}

type TraceEvent = { readonly name?: string }

async function collectTrace(page: Page): Promise<{
  stop: () => Promise<readonly TraceEvent[]>
}> {
  const client: CDPSession = await page.context().newCDPSession(page)
  const events: TraceEvent[] = []

  client.on('Tracing.dataCollected', (payload: { value: TraceEvent[] }) => {
    events.push(...payload.value)
  })

  await client.send('Tracing.start', {
    traceConfig: { includedCategories: ['disabled-by-default-devtools.timeline'] },
    transferMode: 'ReportEvents',
  })

  return {
    stop: async () => {
      const done = new Promise<void>((resolve) => {
        client.once('Tracing.tracingComplete', () => {
          resolve()
        })
      })

      await client.send('Tracing.end')
      await done

      return events
    },
  }
}

/**
 * The counter is chrome, not the surface. Its text changes once a second, and a
 * text change is a layout by definition — no engine avoids that. Removing it
 * isolates the claim being made here, which is that a keystroke causes none.
 */
async function removeCounter(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelector('.counter')?.remove()
  })
}

async function lineCount(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelectorAll('.surface-line').length)
}

/**
 * Types the words that are on screen, correctly, at a hundred words a minute.
 *
 * The script is read once up front rather than re-read per keystroke. Asking
 * the page what to press next would put a round trip inside every interval, and
 * the words never change once generated.
 */
async function typeTheScreen(page: Page, seconds: number): Promise<void> {
  const total = seconds * KEYS_PER_SECOND
  const interval = 1000 / KEYS_PER_SECOND
  const script = await page.evaluate(() =>
    [...document.querySelectorAll('.word')].map((word) => word.textContent ?? '').join(' '),
  )

  expect(script.length, 'not enough words on screen to type for the whole run').toBeGreaterThan(
    total,
  )

  for (const character of script.slice(0, total)) {
    await page.keyboard.press(character === ' ' ? 'Space' : character)
    await page.waitForTimeout(interval)
  }
}

test.describe('test surface', () => {
  test.setTimeout(180_000)

  test('a keystroke that mounts nothing causes no layout at all', async ({ page }) => {
    await page.goto('/?perf')
    await page.waitForSelector('.surface-line')
    await removeCounter(page)

    const before = await lineCount(page)

    // Start the test and let everything settle before the trace opens: the
    // config bar and the hint fade on the first keystroke, and the caret's blink
    // comes back 800ms after the last one. Those are one-off chrome changes and
    // they are not what this test is about.
    await page.keyboard.press('a')
    await page.keyboard.press('Backspace')
    await page.waitForTimeout(1_500)

    const trace = await collectTrace(page)

    // Type and delete inside the first word: no new line, no word top-up, no
    // space. Nothing but the render path for one <Word>.
    for (let i = 0; i < 20; i += 1) {
      await page.keyboard.press('a')
      await page.waitForTimeout(60)
      await page.keyboard.press('Backspace')
      await page.waitForTimeout(60)
    }

    const events = await trace.stop()
    const layouts = events.filter((event) => event.name === 'Layout')

    // eslint-disable-next-line no-console -- attribution is the point of this test
    console.log(
      `[burst] ${String(layouts.length)} Layout over 40 keystrokes\n` +
        layouts
          .slice(0, 3)
          .map((event) => JSON.stringify(event).slice(0, 700))
          .join('\n'),
    )

    expect(await lineCount(page)).toBe(before)
    expect(layouts, '40 keystrokes inside one word must cause zero Layout').toHaveLength(0)
  })

  test('thirty seconds of typing lays out only for what it mounts', async ({ page }) => {
    await page.goto('/?perf')
    await page.waitForSelector('.surface-line')
    await removeCounter(page)

    // Same settling as above: the idle-to-running transition is chrome, and it
    // happens once.
    await page.keyboard.press('a')
    await page.keyboard.press('Backspace')
    await page.waitForTimeout(1_500)

    const before = await lineCount(page)
    const trace = await collectTrace(page)

    await typeTheScreen(page, 30)

    const events = await trace.stop()
    const after = await lineCount(page)
    const layouts = events.filter((event) => event.name === 'Layout')
    const mounted = after - before

    // eslint-disable-next-line no-console -- this number is the deliverable
    console.log(
      `[layout] ${String(events.length)} trace events, ${String(layouts.length)} Layout, ` +
        `${String(mounted)} lines mounted`,
    )

    // A line arriving on screen is new DOM, and new DOM is laid out. That is
    // unavoidable and it is not on the keystroke path: it happens when the
    // cursor reaches a line that did not exist yet.
    expect(layouts.length, 'no layout beyond the lines that were mounted').toBeLessThanOrEqual(
      mounted + 1,
    )
  })

  test('reports keydown to paint within the budget', async ({ page }) => {
    await page.goto('/?perf')
    await page.waitForSelector('.surface-line')
    await page.evaluate(() => {
      ;(window as unknown as { cruduLatency?: { reset: () => void } }).cruduLatency?.reset()
    })

    await typeTheScreen(page, 30)

    const report = await page.evaluate<LatencyReport | null>(
      () =>
        (
          window as unknown as { cruduLatency?: { report: () => LatencyReport } }
        ).cruduLatency?.report() ?? null,
    )

    expect(report).not.toBeNull()

    // eslint-disable-next-line no-console -- this number is the deliverable
    console.log(`[latency] ${JSON.stringify(report)}`)

    // processing is handler time, and every millisecond of it is ours. paint is
    // Event Timing's duration, which the specification quantises to 8ms and
    // bounds below by the frame interval, so on a 60Hz display the only values a
    // correct app can report are 8 and 16.
    expect(report?.processing.p95 ?? Number.POSITIVE_INFINITY).toBeLessThan(BUDGET_MS)
    expect(report?.paint.p95 ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(16)
  })
})
