import { describe, expect, it } from 'vitest'

import { PROGRESS, WEAKNESS_ROW_LIMIT, WEAKNESS_RULE_EVERY } from '../src/components/progress/constants'
import { RESULTS_ENTRANCE, SECONDARY_STATS } from '../src/components/results/constants'
import { CARET, CHAR, CONFIG_BAR, COUNTER, FOCUS_LOST, SURFACE, TRACE } from '../src/components/test/constants'
import {
  CHARS_PER_WORD,
  CONSISTENCY_SAMPLE_MS,
  EXTRA_CHARS_LIMIT,
  PAUSE_THRESHOLD_MS,
  WORD_CHUNK_SIZE,
} from '../src/engine'
import { PERFORMANCE_BUDGET } from '../src/perf/budget'
import { NAV_ITEMS, ROUTES } from '../src/routes/paths'

/**
 * Pinned in the same spirit as tests/adaptive/params.test.ts. Every number
 * below came from docs/ARCHITECTURE.md or docs/DESIGN.md rather than from
 * taste, so a change to one should fail here and be argued in a commit body.
 */

describe('engine constants match ARCHITECTURE.md section 9', () => {
  it('counts a word as five characters', () => {
    expect(CHARS_PER_WORD).toBe(5)
  })

  it('treats a gap over one second as a pause, not slowness', () => {
    expect(PAUSE_THRESHOLD_MS).toBe(1000)
  })

  it('caps extra characters at word length plus ten', () => {
    expect(EXTRA_CHARS_LIMIT).toBe(10)
  })

  it('generates time-mode words in chunks of fifty', () => {
    expect(WORD_CHUNK_SIZE).toBe(50)
  })

  it('samples consistency once per second', () => {
    expect(CONSISTENCY_SAMPLE_MS).toBe(1000)
  })
})

describe('performance budget matches ARCHITECTURE.md section 10', () => {
  it('allows eight milliseconds keydown to paint at p95', () => {
    expect(PERFORMANCE_BUDGET.keydownToPaintP95Ms).toBe(8)
  })

  it('allows zero layout recalculations during a test', () => {
    expect(PERFORMANCE_BUDGET.layoutRecalcsDuringTest).toBe(0)
  })

  it('allows zero dropped frames under synthetic typing', () => {
    expect(PERFORMANCE_BUDGET.droppedFramesAllowed).toBe(0)
  })

  it('budgets 150 kB gzip for the initial bundle', () => {
    expect(PERFORMANCE_BUDGET.initialBundleGzipKb).toBe(150)
  })

  it('accepts the first keystroke within 400ms', () => {
    expect(PERFORMANCE_BUDGET.timeToFirstKeystrokeMs).toBe(400)
  })

  it('assumes eight keystrokes per second at the target speed', () => {
    expect(PERFORMANCE_BUDGET.keystrokesPerSecond).toBe(8)
  })
})

describe('test surface geometry matches docs/DESIGN.md', () => {
  it('shows three lines at 28px on a 46px baseline', () => {
    expect(SURFACE.visibleLines).toBe(3)
    expect(SURFACE.fontSizePx).toBe(28)
    expect(SURFACE.lineHeightPx).toBe(46)
  })

  it('sets the surface to a weight that is actually loaded', () => {
    // 420 would be synthesised from the static 400 face, which changes glyph
    // advance and puts the cached charWidth out of step with what is painted.
    expect([400, 600]).toContain(SURFACE.fontWeight)
    expect(SURFACE.fontWeight).toBe(400)
  })

  it('steps down to 20px on a 34px baseline below 620px', () => {
    expect(SURFACE.fontSizeNarrowPx).toBe(20)
    expect(SURFACE.lineHeightNarrowPx).toBe(34)
    expect(SURFACE.narrowBreakpointPx).toBe(620)
  })

  it('holds the block at 46 percent of viewport height', () => {
    expect(SURFACE.blockTopViewportPercent).toBe(46)
  })

  it('measures 62ch wide, 32ch narrow', () => {
    expect(SURFACE.measureCh).toBe(62)
    expect(SURFACE.measureNarrowCh).toBe(32)
  })

  it('keeps the line height a whole multiple of nothing in particular but a whole number', () => {
    expect(Number.isInteger(SURFACE.lineHeightPx)).toBe(true)
    expect(Number.isInteger(SURFACE.lineHeightNarrowPx)).toBe(true)
  })
})

describe('caret and trace match docs/DESIGN.md', () => {
  it('is a 2px block that slides in 90ms', () => {
    expect(CARET.widthPx).toBe(2)
    expect(CARET.transitionMs).toBe(90)
  })

  it('keeps moving under reduced motion, at 40ms', () => {
    expect(CARET.reducedMotionTransitionMs).toBe(40)
    expect(CARET.reducedMotionTransitionMs).toBeLessThan(CARET.transitionMs)
    expect(CARET.reducedMotionTransitionMs).toBeGreaterThan(0)
  })

  it('carries a 6px accent glow at 30 percent', () => {
    expect(CARET.glowBlurPx).toBe(6)
    expect(CARET.glowAlphaPercent).toBe(30)
  })

  it('blinks on a 1.1s period and resumes after 800ms idle', () => {
    expect(CARET.blinkPeriodMs).toBe(1100)
    expect(CARET.blinkResumeAfterIdleMs).toBe(800)
  })

  it('moves the trace on the same 90ms curve as the caret', () => {
    expect(TRACE.transitionMs).toBe(CARET.transitionMs)
    expect(TRACE.heightPx).toBe(1)
  })
})

describe('character feedback stays fast and carries a second signal', () => {
  it('transitions colour in 60ms', () => {
    expect(CHAR.colorTransitionMs).toBe(60)
    expect(CHAR.colorTransitionMs).toBeLessThanOrEqual(80)
  })

  it('underlines wrong characters, so colour is never the only signal', () => {
    expect(CHAR.wrongUnderlinePx).toBe(2)
    expect(CHAR.wrongUnderlineStyle).toBe('solid')
  })

  it('separates extra from wrong by underline style, not by colour or opacity', () => {
    expect(CHAR.extraUnderlineStyle).toBe('wavy')
    expect(CHAR.extraUnderlineStyle).not.toBe(CHAR.wrongUnderlineStyle)
  })
})

describe('chrome timings match docs/DESIGN.md', () => {
  it('fades the config bar in 180ms', () => {
    expect(CONFIG_BAR.fadeMs).toBe(180)
  })

  it('blurs the surface by 4px at half opacity when focus is lost', () => {
    expect(FOCUS_LOST.blurPx).toBe(4)
    expect(FOCUS_LOST.opacity).toBe(0.5)
  })

  it('sets the counter at 13px', () => {
    expect(COUNTER.fontSizePx).toBe(13)
  })

  it('scrolls completed lines in 120ms', () => {
    expect(SURFACE.scrollTransitionMs).toBe(120)
  })
})

describe('results entrance is one orchestrated sequence', () => {
  it('runs for 700ms end to end', () => {
    expect(RESULTS_ENTRANCE.totalMs).toBe(700)
  })

  it('counts the numbers up over 400ms', () => {
    expect(RESULTS_ENTRANCE.countUpMs).toBe(400)
  })

  it('draws the graph from 150ms over 400ms', () => {
    expect(RESULTS_ENTRANCE.graphDelayMs).toBe(150)
    expect(RESULTS_ENTRANCE.graphDrawMs).toBe(400)
  })

  it('staggers the cards by 40ms from 350ms', () => {
    expect(RESULTS_ENTRANCE.secondaryDelayMs).toBe(350)
    expect(RESULTS_ENTRANCE.cardStaggerMs).toBe(40)
    expect(RESULTS_ENTRANCE.cardDelayMs).toBe(
      RESULTS_ENTRANCE.secondaryDelayMs + RESULTS_ENTRANCE.cardStaggerMs,
    )
  })

  it('finishes inside its own total', () => {
    expect(RESULTS_ENTRANCE.cardDelayMs + RESULTS_ENTRANCE.riseMs).toBeLessThanOrEqual(
      RESULTS_ENTRANCE.totalMs,
    )
    expect(RESULTS_ENTRANCE.graphDelayMs + RESULTS_ENTRANCE.graphDrawMs).toBeLessThanOrEqual(
      RESULTS_ENTRANCE.totalMs,
    )
  })

  it('lists the four secondary stats in the DESIGN.md order', () => {
    expect(SECONDARY_STATS).toEqual(['raw wpm', 'consistency', 'characters', 'time'])
  })
})

describe('progress screen plots the median, not the personal best', () => {
  it('uses a 7 day rolling window', () => {
    expect(PROGRESS.rollingMedianDays).toBe(7)
  })

  it('plots nothing until three tests exist', () => {
    expect(PROGRESS.minimumTests).toBe(3)
  })

  it('draws the line over 500ms with no entrance delay', () => {
    expect(PROGRESS.drawMs).toBe(500)
  })

  it('lists five improved bigrams and 24 weakness rows', () => {
    expect(PROGRESS.improvedRowLimit).toBe(5)
    expect(WEAKNESS_ROW_LIMIT).toBe(24)
    expect(WEAKNESS_RULE_EVERY).toBe(5)
  })
})

describe('routes cover every screen in docs/DESIGN.md', () => {
  it('maps the five screens', () => {
    expect(ROUTES).toEqual({
      test: '/',
      results: '/results',
      progress: '/progress',
      weakness: '/weakness',
      settings: '/settings',
    })
  })

  it('gives every path a leading slash and no trailing one', () => {
    for (const path of Object.values(ROUTES)) {
      expect(path.startsWith('/')).toBe(true)
      expect(path === '/' || !path.endsWith('/')).toBe(true)
    }
  })

  it('shows four nav items, results being reachable only by finishing a test', () => {
    expect(NAV_ITEMS.map((item) => item.name)).toEqual([
      'test',
      'progress',
      'weakness',
      'settings',
    ])
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      'Test',
      'Progress',
      'Weaknesses',
      'Settings',
    ])
  })
})
