# DESIGN.md

The visual system, documented.

The artefact this describes is [`design-prototype.html`](./design-prototype.html),
imported verbatim from Claude Design. That file is the source of truth for what
the design *is*; this file is the source of truth for what it *means*, and it is
what batches 2 through 5 read.

Where the prototype is silent, this document says **not specified in
prototype** rather than filling the gap. Every such gap is a decision still to
be made, not a detail that was overlooked here.

Where the prototype's implementation conflicts with an invariant in `CLAUDE.md`,
this document records the visual intent and `DECISIONS.md` records the
departure. Treat the prototype's visual decisions as authoritative and its
implementation as a suggestion.

---

## 1 Tokens

### 1.1 Colour

Nine semantic names, two palettes. Switched by `data-theme` on `<html>`.

| Token | Light | Dark | What it is |
|---|---|---|---|
| `--canvas` | `#EAE6DD` | `#16181A` | Page background. Warm off-white / near-black |
| `--surface` | `#F3EFE6` | `#1E2124` | Raised card fill. One step from canvas |
| `--ink` | `#26292E` | `#E6E2D8` | Primary text, correct characters |
| `--muted` | `#7A7566` | `#75705F` | Pending characters on the test surface. Nothing else |
| `--muted-strong` | `#63604F` | `#948F80` | Labels, inactive controls, secondary text |
| `--accent` | `#0E6E75` | `#3FB3B8` | Caret, trace, active state, graph line, primary button |
| `--error` | `#BF3B2E` | `#E0685A` | Wrong characters and their underline, graph error ticks |
| `--error-strong` | `#A83527` | `#E0685A` | Error message text. Identical to `--error` in dark |
| `--hairline` | `#D6D0C4` | `#2C3033` | Rules, dividers, borders, the trace track, bar tracks |

Two derived values, both computed from `--accent` so they follow the switch:

| Derived | Expression | Where |
|---|---|---|
| Caret glow | `0 0 6px color-mix(in oklab, var(--accent) 30%, transparent)` | `box-shadow` on the caret |
| Chip tint | `color-mix(in oklab, var(--accent) 12%, transparent)` | Background of an active config chip |

Two opacity-modified colours:

| Modified | Expression | Where |
|---|---|---|
| Extra character | `--error` at `opacity: 0.6` | Characters typed past the end of a word |
| Paused surface | whole block at `opacity: 0.5` + `blur(4px)` | Focus-lost state |

`--muted` has exactly one job: pending characters. Using it for labels would
collapse the distinction between "text you have not typed yet" and "text that is
merely secondary", which is the whole information design of the test surface.

### 1.2 Type

Two families.

| Family | Stack | Loading |
|---|---|---|
| Mono | `'IBM Plex Mono', 'Commit Mono', monospace` | Google Fonts, weights 400 and 600, `display=block` |
| Sans | `'Instrument Sans', system-ui, sans-serif` | Google Fonts, weights 400, 500 and 600, `display=swap` |

`display: block` on the mono face is not a preference. A FOUT that swaps metrics
mid-test shifts every character and reads as a broken app.

The complete set of type treatments in the prototype:

| Size | Weight | Family | Line height | Tracking | Where |
|---|---|---|---|---|---|
| 13px | 500 | Sans | inherit | 0.02em | Every label, chip, nav item, counter, hint, delta, note, switch |
| 13px | 600 | Sans | inherit | 0.02em | Primary button label, active nav item |
| 14px | 400 | Sans | inherit | — | Body copy, card copy, settings row labels |
| 14px | 400 | Mono | inherit | — | Weakness latency, improved before/after |
| 16px | 400 | Sans | inherit | 0.01em | Paused overlay line |
| 16px | 600 | Mono | 0.86 | −0.01em | Logo wordmark |
| 20px | 400 | Sans | inherit | — | Empty-state heading |
| 20px | 600 | Mono | inherit | — | Secondary stat values, bigram pairs. `tabular-nums` |
| 28px | 420 | Mono | 46px | 0 | The test surface |
| 20px | 420 | Mono | 34px | 0 | The test surface below 620px |
| 56px | 600 | Mono | 1 | — | WPM and accuracy on results. `tabular-nums` |

`tabular-nums` wherever a number can change in place. A count-up that shifts
width as it runs looks like a bug.

**Note.** The surface asks for weight 420 but the stylesheet loads IBM Plex Mono
at 400 and 600 only, as static weights. 420 will resolve to 400 or be
synthesised depending on the browser. `'Commit Mono'` is listed ahead of the
generic fallback but is never loaded. Both are implementation details to settle
in phase 2, not design decisions.

### 1.3 Space

The prototype uses literal pixel values rather than a named scale. The complete
set, in the order it appears:

**Gaps:** 3, 8, 10, 12, 14, 16, 20, 24, 48, 64
**Margins (top):** 4, 6, 8, 12, 16, 20, 24, 32, 48, 64
**Padding, composite:** `4px` (icon button), `4px 8px` (chip), `5px 12px`
(switch), `9px 16px` (primary button), `12px 0` (weakness row), `16px 24px`
(header), `24px` (card), `0 24px` (test main), `8px 24px 96px` (results main),
`24px 24px 96px` (progress, weakness, settings main)
**Padding, single:** `32px` below the config bar

The 96px bottom padding on every scrolling screen is deliberate breathing room,
not a footer allowance. There is no footer.

### 1.4 Layout

| Token | Value | Where |
|---|---|---|
| Shell max width | 1200px | Header only |
| Content max width | 860px | Results, progress, weakness |
| Panel max width | 520px | Settings, and the "improved this week" list |
| Surface measure | 62ch / 32ch narrow | The test block |
| Surface viewport | `lineHeight × 3 + 10px` | Three lines visible, 10px slack |
| Surface block top | `calc(46vh − (lineHeight × 1.5 + 60px))` | Puts the middle line at 46vh |
| Narrow breakpoint | 620px | The only breakpoint |

### 1.5 Shape

| Token | Value |
|---|---|
| Corner radius | 4px, everywhere, without exception |
| Hairline | 1px |
| Caret width | 2px |
| Caret height | font size + 4px, so 32px at 28px type |
| Wrong-character underline | 2px |
| Graph stroke | 2px, `vector-effect: non-scaling-stroke` |
| Median line | 1px, `vector-effect: non-scaling-stroke` |
| Error tick | 2px wide, 8px tall, sitting on the graph baseline |
| Weakness bar | 6px tall, 4px radius, `min-width: 80px` |
| Logo tick | 2px × 11px |
| Focus ring | 2px solid accent, 2px offset |
| Switch min width | 64px |
| Column reservations | `3ch` pair, `4ch` pair on the report, `7ch` latency, `13ch` note |

The only shadow in the entire system is the caret glow. There are no elevation
levels, no gradients, and no icons.

---

## 2 Signature

**The caret, and the trace it leaves.**

It is the only thing that moves during a test, it moves roughly eight times a
second, and it is where the eye is locked. Everything else on the test screen is
either the text being typed or has faded to zero.

### 2.1 The caret

```
2px wide, (font-size + 4)px tall — 32px at the default 28px surface type
background:  var(--accent)
box-shadow:  0 0 6px color-mix(in oklab, var(--accent) 30%, transparent)
position:    absolute, left 0 top 0, moved only by transform
transform:   translate3d(x, y, 0)
transition:  transform 90ms cubic-bezier(0.2, 0, 0, 1)
animation:   blink 1.1s steps(1) infinite  — while idle only
pointer-events: none
```

The blink is `steps(1)`, not a fade: `0%,45% { opacity: 1 } 55%,100% { opacity: 0 }`.
A hard on/off at 1.1s reads as a terminal cursor. A fade would read as a
loading state.

The blink stops the moment a test becomes active and does not resume until the
test ends. A blinking caret under a moving hand is visual noise.

Position is arithmetic, never measured: `x = column × charWidth`,
`y = line × lineHeight`. `charWidth` is measured once on font load and cached.
This is why the surface is monospace — see `ARCHITECTURE.md` 4.1, and
`DECISIONS.md` 0.1 for what the prototype does instead.

### 2.2 The trace

A 1px accent line under the active line, showing how far through the line the
caret has travelled. It is a readout of caret position, not an independent
element:

```
track:  absolute, left 0 right 0, height 1px, background var(--hairline)
        top: (traceRow + 1) × lineHeight − 4px
        overflow: hidden
fill:   height 1px, background var(--accent)
        transform-origin: left
        transform: scaleX(min(1, caretLeft / lineWidth))
        transition: transform 90ms cubic-bezier(0.2, 0, 0, 1)
```

`scaleX` on the same 90ms curve as the caret, so the two move as one thing.
Never `width` — that is a layout property and this runs eight times a second.

**Note on naming.** `ARCHITECTURE.md` 11 calls the caret the signature element;
the phase 2 brief calls the trace the signature element. In the prototype they
are a single mechanism: the trace is derived from `caret.left` and shares its
timing curve. Treat them as one.

---

## 3 Screens

### 3.0 Header

Present on every screen. Fades out entirely while a test is active.

```
flex row, space-between, align center, gap 24
padding 16px 24px, max-width 1200px, margin 0 auto, width 100%
opacity 0 + pointer-events none while a test is active
transition: opacity 180ms linear
```

**Logo**, a button that navigates to the test screen. An inline-flex column,
gap 3:

- Row: `crudu` in Mono 16px/600, line-height 0.86, tracking −0.01em, colour
  `--ink`, followed by a 2 × 11px `--accent` block, aligned to the baseline with
  a 3px gap. The block is a caret.
- Below the row: a 1px `--accent` rule the full width of the lockup.

**Nav**, flex row, gap 20, 13px, tracking 0.02em. Four items: `Test`,
`Progress`, `Weaknesses`, `Settings`. Active is `--ink` at weight 600; inactive
is `--muted-strong` at weight 500. Each has 4px padding and a 4px radius. The
results screen keeps `Test` marked active — results is not a nav destination.

### 3.1 Test, idle

The state before the first keystroke.

**Counter.** Absolute, 24px from the left, 8px from the top. Mono 13px/500,
tracking 0.02em, `--muted-strong`. `opacity: 0` until the test starts.

**Test block.** `max-width: 62ch`, `margin-top: calc(46vh − (lineHeight × 1.5 + 60px))`,
which lands the middle of the three lines at 46% of viewport height.

**Config bar.** Centred flex row, gap 16, wrapping, with `padding-bottom: 32px`.
Three groups separated by 1px × 14px `--hairline` dividers:

1. `time` · `words`
2. Four values — `15 30 60 120` in time mode, `10 25 50 100` in words mode
3. `punctuation` · `numbers`

Chip: `padding: 4px 8px`, radius 4, 13px/500, tracking 0.02em. Active is
`--accent` text on the 12% accent tint. Inactive is `--muted-strong` on
transparent. There is no border and no hover state.

**Surface.**

```
viewport: position relative, height (lineHeight × 3 + 10)px, overflow hidden
inner:    Mono 28px/420, line-height 46px, letter-spacing 0
          display flex, flex-wrap wrap, gap "0 1ch", align-content flex-start
          transform: translate3d(0, −scrollRow × lineHeight, 0)
          transition: transform 120ms cubic-bezier(0.2, 0, 0, 1)
word:     inline-flex, white-space nowrap
char:     inline-block, line-height 46px, class="char"
```

Words are separated by a `1ch` flex gap rather than a literal space character.
Wrapping is `flex-wrap`, so a word never splits across lines.

Four character states, and only four:

| State | Colour | Second signal |
|---|---|---|
| Pending | `--muted` | — |
| Correct | `--ink` | — |
| Wrong | `--error` | 2px `--error` underline |
| Extra | `--error` at 0.6 opacity | 2px `--error` underline |

Colour never appears on the surface for any other reason. There is no
highlighting, no active-word emphasis, no next-word preview treatment.

**Hint.** `Start typing`, centred, 32px below the surface, 13px/500
`--muted-strong`. Fades to 0 once the test starts.

**Input.** A real `<input>`, not `contenteditable`, positioned at
`left: -9999px` at 1×1px and zero opacity. `aria-label="Typing input"`,
`autoComplete`, `autoCapitalize` and `autoCorrect` off, `spellCheck` false.
Clicking anywhere on the surface refocuses it; the wrapper carries
`cursor: text`.

### 3.2 Test, active

Started, not finished, not paused. Four things change, all on the same 180ms
linear fade:

- Header → `opacity: 0`, `pointer-events: none`
- Config bar → `opacity: 0`, `pointer-events: none`
- Hint → `opacity: 0`
- Counter → `opacity: 1`

The counter reads `30s` in time mode and `24 words` in words mode. It is the
only number on screen.

**There is no live WPM.** A live speed number pulls the eye off the text, which
is the one thing the screen exists to show.

The caret's blink animation is set to `none` while active. Lines scroll up as
they complete; the active line holds its position, one row from the top of the
viewport.

### 3.3 Test, focus lost

Blur while a test is running pauses it. Elapsed time excludes the paused span.

- The whole test block takes `filter: blur(4px)` and `opacity: 0.5`, over
  180ms linear on both properties.
- A single centred line sits over it, 16px `--ink`, tracking 0.01em, in an
  absolutely positioned `pointer-events: none` layer:
  `Click or press any key to resume`
- Header and config bar return, because the test is no longer active.

Any keydown anywhere on the window refocuses the input.

### 3.4 Results

`max-width: 860px`, `padding: 8px 24px 96px`.

**Headline row.** Flex, gap 64, wrapping. Two blocks:

| | |
|---|---|
| Number | Mono 56px/600, line-height 1, `tabular-nums` |
| Label | 13px/500 `--muted-strong` — `wpm`, `accuracy` |
| Delta | 13px/500 on the same baseline, 8px after the label |

The delta reads `+4 vs 7 day median` and is `--accent` when at or above the
median, `--muted-strong` when below. With no history it reads
`first plotted test`.

**Personal-best variant.** The WPM number turns `--accent`, and a third line
appears 6px below the label row: `Best at this setting`, 13px/500 `--accent`.
A personal best is scoped to the exact config, so `time 30 punctuation` and
`time 30 plain` are separate records. Accuracy never turns accent.

**Graph.** 48px below, 180px tall, full width. `viewBox="0 0 900 180"` with
`preserveAspectRatio="none"` and `overflow: visible`.

- One `--hairline` line at the median, 1px, non-scaling stroke
- The WPM series as a 2px `--accent` path, `pathLength="1"`,
  `stroke-dasharray: 1`, `stroke-dashoffset: 1`, drawn by
  `animation: draw 400ms 150ms linear forwards`
- Error ticks: 2px `--error` verticals from y 172 to 180, sitting on the
  baseline, one per second in which an error occurred
- Vertical mapping: `y = 170 − (wpm / max(60, peak)) × 160`

No axes, no gridlines, no legend, no tooltip.

**Secondary stats.** 32px below, flex row, gap 48, wrapping. Four label/value
pairs, in this order: `raw wpm`, `consistency`, `characters`, `time`. Label
13px/500 `--muted-strong`; value Mono 20px/600 `tabular-nums` `--ink`, 4px
below. Not cards. No borders, no backgrounds, no dividers.

**Card.** The only card in the product. 48px below, `--surface` fill, 1px
`--hairline` border, 4px radius, 24px padding. It has two mutually exclusive
contents:

*Weakness variant*, once calibration is done:

- Label `Slowest transitions`, 13px/500 `--muted-strong`
- Three rows, 16px below, gap 14, each a baseline row with gap 16: the pair in
  Mono 20px/600 `--ink` reserving `3ch`, then the body in 14px `--ink` —
  `310ms, against your average of 145ms`
- A primary button 24px below: `padding: 9px 16px`, radius 4, `--accent` fill,
  `--canvas` label, 13px/600, tracking 0.02em — `Drill these`

*Calibrating variant*, for tests 1 to 3: one line of 14px `--ink`, replacing
everything above.

**Footer actions.** 32px below the card, flex row, gap 24, 13px/500
`--muted-strong`, 4px padding, 4px radius: `Repeat test`, `New test`. Plain
text buttons, no borders.

### 3.5 Progress

`max-width: 860px`, `padding: 24px 24px 96px`.

**Populated**, from three tests onward:

- Label `7 day rolling median`, 13px/500 `--muted-strong`
- Chart 16px below, 220px tall, `viewBox="0 0 900 220"`. A `--hairline` median
  line and a 2px `--accent` path drawn by `animation: draw 500ms linear forwards`
  — no entrance delay, unlike results
- Below the chart, 8px down, a `space-between` row of two 13px/500
  `--muted-strong` labels: the first and last day in the series, formatted
  `M/D`. There is no axis
- 64px below, label `Improved this week`
- A `max-width: 520px` column, gap 16, 20px below. Each row is a baseline row,
  gap 20: the pair in Mono 20px/600 `--ink` reserving `3ch`, the before value
  in Mono 14px `--muted-strong` with `line-through`, the after value in Mono
  14px `--accent`. Five rows, largest improvement first

The chart plots the rolling median, never the personal best. Personal bests are
noise-chasing; the median is the thing that moves.

**Empty state**, under three tests. `min-height: 60vh`, centred column, gap 12,
centre-aligned:

- `Nothing plotted yet.` — 20px `--ink`
- `Run three tests and your first line appears here.` — 14px `--muted-strong`
- A primary button 12px below: `Run a test.`

### 3.6 Weakness report

`max-width: 860px`, `padding: 24px 24px 96px`.

**Header row.** Baseline, `space-between`, both 13px/500 `--muted-strong`:
`Tracked transitions, slowest first` on the left, `14 pairs` on the right.

**Rows.** 24px below, up to 24 of them, slowest first. Each row is
`display: flex`, `align-items: center`, gap 20, `padding: 12px 0`:

| Element | Treatment |
|---|---|
| Pair | Mono 20px/600, `min-width: 4ch` |
| Bar track | `flex: 1`, 6px tall, `--hairline`, radius 4, `overflow: hidden`, `min-width: 80px` |
| Bar fill | `width: (ms / slowest) × 100%`, `--accent`, radius 4 |
| Latency | Mono 14px `tabular-nums`, `min-width: 7ch`, right aligned |
| Note | 13px/500 `--muted-strong`, `min-width: 13ch`, right aligned |

A row with fewer than 8 samples is demoted: its text drops from `--ink` to
`--muted-strong`, its bar fill drops from `--accent` to `--muted-strong`, and
its note reads `Needs more data` instead of `12 samples`. Under-sampled data is
shown rather than hidden, and marked rather than trusted.

Every fifth row carries a 1px `--hairline` bottom border. That is what makes a
24-row list scannable without banding it.

**Empty state.** `min-height: 50vh`, otherwise identical to the progress empty
state, same copy, same button.

### 3.7 Settings

`max-width: 520px`, `padding: 24px 24px 96px`. Three groups, separated by full
width 1px `--hairline` rules with `margin: 32px 0`.

Group header: 13px/500 `--muted-strong`. Rows: flex column, gap 20, starting
16px below the header. Each row is `space-between` with gap 24, its label in
14px `--ink`.

| Group | Rows | Control |
|---|---|---|
| `Test` | `Mode` | `time` · `words` chips |
| | `Duration` / `Word count` | Four value chips, label follows the mode |
| `Behaviour` | `Punctuation` | Switch |
| | `Numbers` | Switch |
| | `Stop on first error` | Switch |
| `Appearance` | `Theme` | `light` · `dark` chips, lowercase |
| | `Caret blink` | Switch |

Switch: `padding: 5px 12px`, radius 4, `min-width: 64px`, 13px/500, tracking
0.02em, with a 1px border. On is `--accent` border and text reading `on`; off
is `--hairline` border with `--muted-strong` text reading `off`. It is a
labelled button, not a track-and-knob toggle.

**Storage error.** When a write has failed, a line appears 32px below the last
group, 13px/500 `--error-strong`:
`Could not save that test. Your history is intact.`

It sits on the settings screen only. A storage failure never interrupts a test
and never blocks a result.

### 3.8 Gaps

States and screens the prototype does not specify. Listed so that phase 2
onwards knows these are open, not forgotten.

**Interaction states**

- Hover on any control — **not specified in prototype**. The only hover rule in
  the stylesheet is `a:hover { color: var(--ink) }`, and there are no anchors in
  the markup
- Pressed / active states — **not specified in prototype**
- Disabled states — **not specified in prototype**
- Per-component focus styling beyond the global ring — **not specified in prototype**
- The chip helper accepts a `dim` argument that applies `opacity: 0.6`, but is
  never called with it. The dimmed variant is unused — **not specified in prototype**

**Screens and flows**

- The drill / adaptive test surface. `Drill these` navigates to the weakness
  report, not to a drill — **not specified in prototype**
- Any calibration indicator on the test screen. Calibration is surfaced only on
  results — **not specified in prototype**
- A history or past-tests screen — **not specified in prototype**
- A results state with no data — unreachable, **not specified in prototype**
- Route-not-found — **not specified in prototype**
- First paint, loading, or skeleton states — **not specified in prototype**

**Test-surface detail**

- Caret behaviour at a line wrap — **not specified in prototype**
- How punctuation and numbers render on the surface, beyond being appended to a
  word — **not specified in prototype**
- Any treatment for `stop on first error` on the surface. The setting exists and
  silently drops the keystroke; nothing visual marks it — **not specified in prototype**
- Keyboard-shortcut affordances. The prototype binds `Escape` to regenerate and
  refocuses on any window keydown; `Tab` → `Enter` to restart and `Shift+Tab` to
  repeat, which `ARCHITECTURE.md` 3 requires, are **not specified in prototype**

**Chrome**

- Header and nav behaviour below 620px. Nav does not collapse and there is no
  menu — **not specified in prototype**
- A 360px layout. The only breakpoint is 620px — **not specified in prototype**
- A footer. There is none, deliberately
- An app icon or favicon. A separate `Crudu Logo.dc.html` exists in the design
  project and was not part of this import — **not specified in prototype**
- Print styles — **not specified in prototype**
- Theme-transition motion. Switching theme is instant — **not specified in prototype**

**Copy**

- Pluralisation for `1 pairs` and `1 samples` — **not specified in prototype**

---

## 4 Motion

Every animated value in the prototype. There are no springs anywhere: the
prototype is CSS transitions and three keyframe sets. `ARCHITECTURE.md` 7
defines spring parameters for the shell, and the prototype uses none of them.

### 4.1 Easing

| Name | Value | Used for |
|---|---|---|
| Standard | `cubic-bezier(0.2, 0, 0, 1)` | Anything that moves |
| Linear | `linear` | Anything that only changes colour or opacity |
| Steps | `steps(1)` | The caret blink |
| Ease-out cubic | `1 − (1 − p)³` | The results count-up, in JavaScript |

One curve for movement. Colour and opacity are linear because they are feedback,
not motion — a springy character-state change reads as lag, since the user's
mental model is that the letter turns red the instant they mistype.

### 4.2 Transitions

| Property | Duration | Easing | Element |
|---|---|---|---|
| `color` | 60ms | linear | `.char` |
| `transform` | 90ms | standard | `.caret` |
| `transform` | 90ms | standard | Trace fill (`scaleX`) |
| `transform` | 120ms | standard | Surface inner, line scroll |
| `opacity` | 180ms | linear | Header |
| `opacity` | 180ms | linear | Config bar |
| `opacity` | 180ms | linear | Counter |
| `opacity` | 180ms | linear | Hint |
| `filter`, `opacity` | 180ms | linear | Test block, focus lost |

Character colour is 60ms and must stay at or under 80ms.

### 4.3 Keyframes

```css
@keyframes blink { 0%,45% { opacity: 1 } 55%,100% { opacity: 0 } }
@keyframes draw  { to { stroke-dashoffset: 0 } }
@keyframes rise  { from { opacity: 0; transform: translateY(12px) }
                   to   { opacity: 1; transform: none } }
```

| Animation | Duration | Delay | Timing | Fill | Element |
|---|---|---|---|---|---|
| `blink` | 1.1s | — | `steps(1)`, infinite | — | Caret, idle only |
| `draw` | 400ms | 150ms | linear | forwards | Results graph path |
| `draw` | 500ms | — | linear | forwards | Progress chart path |
| `rise` | 180ms | 350ms | standard | both | Results secondary stats |
| `rise` | 180ms | 390ms | standard | both | Results card |

### 4.4 The results sequence

One orchestrated moment, roughly 700ms end to end. It is the emotional payoff of
the loop and the only place worth spending animation budget.

```
0ms    numbers begin counting up, 400ms, ease-out cubic, via requestAnimationFrame
150ms  graph path begins drawing left to right, 400ms
350ms  secondary stats rise, 180ms
390ms  weakness card rises, 180ms   ← one 40ms stagger step after the stats
```

The count-up runs in JavaScript because it interpolates text content, not a
style. Everything else is CSS.

### 4.5 Reduced motion

The prototype's block:

```css
@media (prefers-reduced-motion: reduce) {
  .caret { transition: transform 40ms linear; animation: none !important }
  *      { animation-duration: 0.001ms !important;
           animation-delay: 0ms !important;
           transition-duration: 0.001ms !important }
}
```

Intent: strip decorative motion, keep the caret moving at 40ms. A caret that
teleports is harder to track visually, which is an accessibility regression, not
an improvement.

**This block does not achieve its intent.** The universal
`transition-duration: 0.001ms !important` outranks the unprefixed `.caret`
declaration regardless of specificity, so the caret teleports. The
implementation fix is recorded in `DECISIONS.md` 0.2. The intent above is what
to build.

---

## 5 Copy

Every user-facing string in the prototype, verbatim. Sentence case throughout.
Interface labels that name a control are lowercase where the prototype writes
them lowercase — that is a deliberate register, not an inconsistency.

### 5.1 Navigation

```
crudu
Test
Progress
Weaknesses
Settings
```

### 5.2 Test screen

```
time
words
punctuation
numbers
Start typing
Click or press any key to resume
```

Counter, composed: `{seconds}s` in time mode, `{n} words` in words mode.

### 5.3 Results

```
wpm
accuracy
Best at this setting
raw wpm
consistency
characters
time
Slowest transitions
Drill these
Repeat test
New test
```

Composed strings:

```
{+|}{n} vs 7 day median          delta under wpm and accuracy
first plotted test                delta with no history
{ms}ms, against your average of {avg}ms
Calibrating. Two more tests before drills unlock.
Calibrating. One more test before drills unlock.
```

The calibrating line switches from `Two more tests` to `One more test` at the
appropriate count. Both forms are in the prototype.

### 5.4 Progress

```
7 day rolling median
Improved this week
Nothing plotted yet.
Run three tests and your first line appears here.
Run a test.
```

Composed: axis labels as `{month}/{date}`, before and after values as `{ms}ms`.

### 5.5 Weakness report

```
Tracked transitions, slowest first
Needs more data
Nothing plotted yet.
Run three tests and your first line appears here.
Run a test.
```

Composed: `{n} pairs`, `{n} samples`, `{ms}ms`.

### 5.6 Settings

```
Test
Mode
Duration
Word count
Behaviour
Punctuation
Numbers
Stop on first error
Appearance
Theme
Caret blink
on
off
light
dark
```

### 5.7 Errors

```
Could not save that test. Your history is intact.
```

The only error string in the product. It states what failed and what did not, in
that order, and it asks the user to do nothing.

### 5.8 Accessible names

```
Typing input          aria-label on the hidden input
```

The only ARIA in the prototype.

---

## 6 Bans

Patterns the prototype contains none of. Introducing one would break the system
rather than extend it.

**On the test surface**

- **No live WPM.** The counter shows remaining time or remaining words, nothing
  else. A live speed number pulls the eye off the text
- **No colour for anything but the four character states.** No active-word
  highlight, no next-word preview treatment, no progress tint
- **No scroll cue.** The viewport clips at three lines. No fade, no gradient
  mask, no arrow, no scrollbar
- **No JavaScript animation library.** Characters and caret are CSS transitions
- **No animation of `width`, `left`, `top` or `margin`.** The caret uses
  `translate3d`, the trace uses `scaleX`, the line scroll uses `translate3d`

**Layout and chrome**

- **No three-equal-card rows.** The results secondary stats are bare label/value
  pairs in a flex row. There is exactly one card on the whole results screen
- **No decorative status dots**, badges, pills or chips outside the config bar
- **No icons.** The entire interface is text plus one 2 × 11px accent block in
  the logo
- **No modals, dialogs, drawers, tooltips or popovers**
- **No footer**
- **No tabs, accordions or disclosure widgets**

**Visual**

- **No shadows** except the caret glow
- **No gradients**
- **No radius other than 4px**
- **No second accent colour.** One accent, one error, one hairline
- **No third font family**
- **No uppercase or wide-tracked display type.** Tracking never exceeds 0.02em
  and the only negative tracking is the logo's −0.01em
- **No borders on buttons** except the settings switches

**Behaviour**

- **No hover-only affordances.** Nothing is discoverable only on hover, which is
  necessary since the prototype specifies no hover states at all
- **No numbers that update in place during a test.** The results count-up is the
  single exception and it runs after the test is over
- **No interruption from a storage failure.** The error surfaces on the settings
  screen, after the fact

---

## 7 Quality floor

### 7.1 Responsive

One breakpoint: **620px**. In the prototype it is a JavaScript
`window.innerWidth < 620` check, which phase 2 should implement as a media
query.

| | Wide | Narrow |
|---|---|---|
| Surface type | 28px | 20px |
| Surface line height | 46px | 34px |
| Surface measure | 62ch | 32ch |

Nothing else changes. Every other screen is fluid: `max-width` plus 24px
gutters, with `flex-wrap` on the headline row, the secondary stats and the
config bar.

A 360px layout is **not specified in prototype**. The phase 5 brief asks for
20px type and a 32ch measure at 360px, which matches the narrow tokens above, so
the open question is the header and nav rather than the surface.

### 7.2 Focus

```css
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }
```

One global rule, no per-component overrides. Every control is a real `<button>`,
so tab order follows document order and nothing needs a `tabindex`.

Known accessibility gaps in the prototype, all **not specified in prototype**:

- Settings rows use `<label>` elements that are not associated with their
  controls. The controls are buttons, so `for` cannot bind to them
- Toggle buttons carry no `aria-pressed`; chips carry no `aria-current` or
  `role="radio"`
- The graph and progress SVGs have no `<title>`, `<desc>` or text alternative
- The weakness bars have no text alternative beyond the adjacent latency value,
  which is arguably sufficient
- Neither the counter nor the results are announced; there is no `aria-live`
  anywhere

### 7.3 Reduced motion

See 4.5. Strip decorative motion, keep the caret transition at 40ms. The
prototype's implementation of this does not work; the intent is what to build.

### 7.4 Contrast

Measured against the tokens in section 1. Thresholds: 4.5:1 for text under 24px
regular or under 18.66px bold, 3:1 for larger text and for user-interface
components.

Most pairings clear comfortably: `--ink` on `--canvas` is 11.72:1 light and
13.76:1 dark; `--ink` on `--surface` is 12.72:1 and 12.51:1; `--muted-strong` on
`--canvas` is 5.08:1 and 5.51:1; `--canvas` on `--accent` — the primary button —
is 4.81:1 and 7.08:1.

Seven pairings do not clear. They are recorded here as measurements, not as
proposed changes:

| Pairing | Light | Dark | Needs | Where |
|---|---|---|---|---|
| `--muted` on `--canvas` | 3.69:1 | 3.59:1 | 3:1 at 28px, **4.5:1 at 20px** | Pending characters. Passes wide, fails below 620px |
| `--error` on `--canvas` | 4.35:1 | 5.34:1 | 3:1 at 28px, **4.5:1 at 20px** | Wrong characters. Light fails below 620px; dark passes |
| `--error` at 0.6 on `--canvas` | 2.42:1 | 2.69:1 | 3:1 / 4.5:1 | Extra characters. Fails at every size in both themes |
| `--accent` on the 12% accent tint | **4.11:1** | 5.84:1 | 4.5:1 | Active config chip label. Light fails |
| `--hairline` on `--canvas` | 1.23:1 | 1.34:1 | 3:1 | Dividers, median line, bar tracks, switch borders when off |
| `--hairline` on `--surface` | 1.34:1 | 1.22:1 | 3:1 | Card border, seen from inside the card |
| `--surface` on `--canvas` | 1.09:1 | 1.10:1 | 3:1 | Card fill against the page |

Two notes on the last three rows. `--hairline` and `--surface` are boundary
treatments rather than components that convey state, and WCAG 1.4.11 does not
require 3:1 for a purely decorative divider. The switch *border* is the
exception: it is the off-state indicator, and at 1.23:1 the off state is not
perceivable by border alone — though the `off` label carries the state in text,
which satisfies the requirement by a different route.

The paused state multiplies everything by `opacity: 0.5`. `--ink` at 0.5 on
`--canvas` measures 2.85:1 light and 4.32:1 dark. This is a deliberate
"suspended" affordance and the overlay line sits above it at full opacity, so
the blurred text is decorative while paused.

Pending and correct characters are distinguished by colour alone — `--muted`
against `--ink`, at 3.17:1 light and 3.83:1 dark. Wrong characters carry a 2px
underline as a second signal, per invariant 9. The pending/correct distinction
has no second signal available: both are the same glyph in the same position,
and the only thing that can differ is colour.
