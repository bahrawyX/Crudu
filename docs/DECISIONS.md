# Decisions

Choices the reference documents did not settle, recorded per the working
agreement in CLAUDE.md. Newest phase last.

---

## Phase 0 — scaffold

### 0.1 The layout-read ban is wider than the four APIs invariant 3 names

**Decision.** `no-restricted-syntax` bans 14 layout-reading APIs under
`src/engine/` and `src/components/test/`, not the four named in invariant 3.

The four named: `getBoundingClientRect`, `offsetWidth`, `offsetHeight`,
`getComputedStyle`.

Added: `getClientRects`, `offsetLeft`, `offsetTop`, `offsetParent`,
`clientWidth`, `clientHeight`, `clientLeft`, `clientTop`, `scrollWidth`,
`scrollHeight`.

**Why.** The design prototype in `docs/design-prototype.html` positions its
caret like this:

```js
left = el.offsetLeft + (el.dataset.c === '2' ? el.offsetWidth : 0)
top = el.offsetTop
const lineW = host.clientWidth || 1
```

Three of those four properties are outside the named list. A rule that stopped
at the four would have let the exact code phase 2 is most likely to copy walk
straight through, which is the opposite of what the rail is for. All fourteen
force a synchronous style-and-layout flush in the same way.

**Cost.** Slightly stricter than asked. If a future batch needs one of the added
properties outside the keystroke path, the fix is to move that code out of
`src/components/test/`, which is where it belongs anyway.

### 0.2 The reduced-motion block departs from the prototype

**Decision.** `src/styles/index.css` keeps the caret transition alive under
`prefers-reduced-motion: reduce`, at 40ms, using `!important`.

**Why.** The prototype's own block cannot do what it intends:

```css
@media (prefers-reduced-motion: reduce){
  .caret{transition:transform 40ms linear;animation:none !important}
  *{...;transition-duration:0.001ms !important}
}
```

The universal `transition-duration: 0.001ms !important` outranks the unprefixed
`.caret` declaration regardless of specificity, so the caret teleports.
ARCHITECTURE.md section 7 is explicit that the caret transition survives at
40ms, because a caret that teleports is harder to track visually and that is an
accessibility regression, not an improvement. `tests/tokens.test.ts` asserts the
override is present.

### 0.3 tokens.css holds the values, themes.css holds the switch

**Decision.** `tokens.css` declares both palettes under `--light-*` and
`--dark-*`. `themes.css` binds the nine semantic names (`--canvas`, `--ink`,
`--accent`, …) to one palette or the other.

**Why.** The alternative is to declare the semantic names three times with
literal hex values: once for light, once for dark, once inside the
`prefers-color-scheme` fallback. That triples the places a colour can be edited
and makes it possible for the fallback to drift from the explicit dark theme
without anyone noticing. With the indirection, the fallback duplicates
`var()` references rather than values, and `tests/tokens.test.ts` asserts all
three blocks bind all nine names.

CLAUDE.md's file tree lists both files, so the split also matches the tree.

### 0.4 Only the nine colours enter Tailwind's `@theme`

**Decision.** `@theme inline` exposes the nine semantic colours. The rest of the
token set stays in plain `:root` declarations in `tokens.css`.

**Why.** Tailwind v4 reserves `--text-*`, `--font-*`, `--leading-*`,
`--tracking-*`, `--ease-*`, `--spacing-*` and `--breakpoint-*` for utility
generation. Moving the type scale into `@theme` would mean either renaming
tokens away from what DESIGN.md calls them or shadowing Tailwind's own
variables. Neither is worth `text-surface` as a utility.

`inline` rather than plain `@theme`: without it Tailwind emits
`var(--color-ink)` and resolves the indirection once at `:root`, which would
break any scoped theme. With it the utility emits `var(--ink)` directly.

### 0.5 No `data-theme` in index.html; absence means "follow the system"

**Decision.** `index.html` ships without a `data-theme` attribute. The CSS treats
its absence as "use `prefers-color-scheme`". An explicit `data-theme` always
wins, because the media-query rule is scoped to `:root:not([data-theme])`.

**Why.** ARCHITECTURE.md section 3 item 11 requires respecting
`prefers-color-scheme`. Hard-coding `data-theme="light"` in the shell would
defeat it before phase 3 ever reads a preference.

**Open question, see report.** ARCHITECTURE.md says three themes. DESIGN.md
defines two palettes and its settings screen offers exactly `light` and `dark`.
The CSS supports a third *state* — no attribute, follow the system — but no
third *palette*. `src/stores/prefsStore.ts` therefore types `Theme` as
`'light' | 'dark'`, matching DESIGN.md. Whether the settings screen should also
offer "system", and whether a genuine third palette is wanted, is unresolved.

### 0.6 One real module per directory, not one file per name in the tree

**Decision.** Every directory in CLAUDE.md's file tree exists and holds at least
one module that later batches import. Not every filename listed in that tree was
created.

**Why.** `src/engine/reducer.ts` is phase 1's deliverable. Creating it now as a
stub would be exactly the placeholder file the batch brief forbids, and writing
it properly would be doing phase 1's work in phase 0. What each directory holds
instead is the set of numbers its phase is not free to choose, each with the
citation that fixed it, so that retuning one is a visible diff.

### 0.7 Test files outside the engine/adaptive/storage triad

**Decision.** `tests/` gained four files at its root — `tokens.test.ts`,
`constants.test.ts`, `stores.test.ts`, `cx.test.ts` — alongside the three
directories CLAUDE.md lists.

**Why.** They cover the stylesheet, the shared constants, the zustand stores and
a utility, none of which belong under `engine/`, `adaptive/` or `storage/`.
Putting them in a subdirectory would have meant inventing a directory; putting
them at the root keeps the three named directories meaning what they say.

### 0.8 `pnpm lint` runs with `--max-warnings 0`

**Decision.** Any ESLint warning fails the build.

**Why.** The batch brief requires the invariant rules to fail rather than warn,
and they are configured as errors. `--max-warnings 0` covers everything else:
a warning is a note that a rule was broken and the build shipped anyway, which
over a few months is indistinguishable from not having the rule.

### 0.9 e2e is not in the CI workflow yet

**Decision.** `.github/workflows/ci.yml` runs typecheck, lint, test and build.
Playwright runs locally via `pnpm e2e`.

**Why.** The batch brief names those four. Adding Playwright now costs a browser
download on every push to prove a theme swap that `tests/tokens.test.ts` already
covers without a browser. Phase 5 adds `e2e/latency.spec.ts`, which is the
regression that genuinely cannot be caught any other way, and the browser
download earns its place then.

### 0.10 A root commit landed on `main` before branching

**Decision.** `CLAUDE.md`, `docs/ARCHITECTURE.md`, `claude-code-prompts.md` and
`.gitignore` were committed to `main` first, then `phase/0-scaffold` branched
from it.

**Why.** The repository had no commits at all. `git merge --no-ff` into an
unborn branch is not a merge, so the phase-end merge described in CLAUDE.md
would have degenerated into a fast-forward and the tag would not have marked a
rollback point.

---

## Phase 1 — engine

### 1.1 Virtual-keyboard tests are excluded from bigram aggregation

**Decision.** A keydown with `code === ''` or `keyCode === 229` marks the test
`inputSource: 'virtual'`. A virtual test records WPM, raw WPM, accuracy,
consistency, its keystroke log and its history entry exactly as any other, and
contributes nothing at all to the bigram table.

**Why.** Thumb typing and touch typing are different motor tasks. A same-finger
bigram like `ol` is slow on a physical keyboard because one finger has to travel
twice; on a phone it is two thumbs and the cost sits somewhere else entirely. A
bigram table that mixes the two describes neither, and weakness is scored against
the user's own median, so a handful of phone tests would drag that median and
reclassify perfectly good physical transitions as weak.

The adaptive engine is the entire differentiator. Having less data in it is a
cost; having wrong data in it is a defect.

**Cost.** Someone who practises mostly on a tablet gets WPM history and no
drills. That is the honest outcome — there is nothing useful to drill — and it
beats silently generating drills from noise.

### 1.2 The virtual tag is sticky, and set before classification

**Decision.** One virtual keystroke tags the test for its whole duration. The tag
is applied to every keydown the engine receives, including ones the classifier
then throws away.

**Why.** The brief tags tests, not keystrokes, and a test that starts on a laptop
and continues on a phone holds data from two motor tasks with no way to tell
afterwards which pairs came from which.

Tagging before classification matters because soft keyboards frequently report
`key: 'Unidentified'` with `keyCode: 229`, which the classifier discards. If the
tag applied only to accepted keystrokes, the strongest available signal that a
soft keyboard is in use would be the one signal that never reached it.

The asymmetry settles it: a test wrongly tagged virtual loses its bigrams, and a
test wrongly tagged physical corrupts the table for good.

### 1.3 The log carries a kind, and backspaces are in it

**Decision.** Every entry has `kind: 'char' | 'missed' | 'backspace' |
'delete-word'`. Metrics filter on kind. Edits count towards nothing.

**Why.** ARCHITECTURE.md 6.1 says store the raw log, because aggregates are not
reversible. A log without backspaces cannot drive a replay and cannot show where
someone hesitated and corrected. But an edit is not a keypress in the accuracy
sense either: counting a backspace as an incorrect keypress would penalise
correcting a typo twice.

A discriminated kind keeps both properties. Nothing is thrown away, and each
metric reads only the entries it is defined over.

### 1.4 Missed characters are logged, not derived

**Decision.** When space advances a word with characters left, one `missed` entry
is appended per remaining character, at the timestamp of that space.

**Why.** Accuracy is measured at the moment of the keypress. Someone who
backspaces into an incomplete word and advances past it incomplete a second time
has paid twice, and the log records both. Deriving `missed` from final word state
would count only the last one and forgive the first.

### 1.5 A boundary space is correct only when the word was exact

**Decision.** The space that advances a word is `ok` only when
`typed === text`. Any incomplete, incorrect or over-typed word makes its
terminating space an incorrect keypress.

**Why.** The net WPM definition says "correct characters including correct
spaces", which only means anything if some spaces are incorrect. Roughly one
character in six of English text is a space, so counting every boundary space as
correct would let a test typed entirely wrong still earn a sixth of its net WPM.

### 1.6 A bigram spanning a pause is discarded

**Decision.** Every log entry records how many pauses had completed when it was
made. A pair whose two entries disagree is dropped.

**Why.** This one is not in the brief and it is not optional. Paused time is
subtracted from `t`, which is right for elapsed time and catastrophic for bigram
latency: a keystroke before a two-minute blur and the one after it can appear
30ms apart, and that pair would enter the table as the fastest transition the
user has ever performed. The gap check cannot catch it, because after subtraction
there is no gap left to see.

### 1.7 A key pressed while paused resumes and is then typed

**Decision.** A key arriving in `paused` resumes the clock at its own timestamp
and is then processed as an ordinary keystroke.

**Why.** `docs/DESIGN.md` 3.3 puts "Click or press any key to resume" on screen,
so a key press has to resume. The alternative — resume but swallow the key —
loses the first character after every blur, which on a test surface reads as a
dropped keystroke rather than as a feature.

### 1.8 Consistency sampling

**Decision.** The timeline is divided into 1000ms buckets from `t = 0`. A bucket
is sampled when it holds at least one character entry and is not overlapped by an
inter-keystroke gap longer than 1000ms. Population standard deviation. Fewer than
two samples reports 100. The result is clamped at 0.

**Why.** "Excluded from consistency sampling" needed a mechanism. Excluding only
empty buckets does not work: a 1050ms gap sitting across two adjacent seconds
leaves both of them non-empty. Testing each bucket for overlap against the gap
window catches every case.

Population rather than sample deviation because these are all the seconds there
were, not a draw from a larger set. The clamp exists because σ can exceed μ in a
very bursty test, and a negative consistency is not a number anyone can read.

**Known approximation, deliberately kept.** The final bucket of a test is usually
a partial second and is counted whole, which flatters a burst at the end.
Monkeytype does the same. Correcting it would produce a figure that matches no
competitor, for an error of a fraction of a percent.

### 1.9 A keystroke at or past expiry is discarded

**Decision.** In time mode, a keystroke whose timestamp puts elapsed at or past
the configured duration completes the test and is not accepted.

**Why.** The alternative lets a keystroke at 30.4s count toward a 30s test, which
is both wrong and exploitable. The word the user was in stays active, so its
untyped characters stay `pending` and never become `missed`: they are neither
correct nor incorrect and enter no metric, which is what rule 4 asks for.

### 1.10 Words, ids and start times come from the caller

**Decision.** The reducer takes words as data. The engine wrapper owns the word
source. `id` and `startedAt` are passed in.

**Why.** `crypto.randomUUID()`, `Date.now()` and a word generator are all impure.
Any of them inside the engine would make it untestable with fixed values, and the
golden suite depends on running one exact sequence and getting one exact answer.
It also lets phase 4 substitute the adaptive generator without touching the
reducer.

### 1.11 An extra file in src/engine

**Decision.** `src/engine/engine.ts` holds the instance: subscriptions, word
source, cached result. `index.ts` stays a barrel. CLAUDE.md's tree lists neither.

**Why.** The alternative was a hundred lines of mutable subscription plumbing
inside the barrel. Keeping the only stateful file in the engine separate and
named makes it obvious where the mutation lives, which matters when everything
around it is pure.

### 1.12 Timestamps are clamped monotonic

**Decision.** A timestamp earlier than the highest one seen is clamped to it.

**Why.** Browsers do not normally deliver these, but the property suite does, and
a negative elapsed value poisons every metric downstream. Clamping is the only
option that keeps the log replayable: dropping the event would lose a real
keystroke, and accepting it would make `t` run backwards.

---

## Phase 2 — test surface

### 2.1 Hover, pressed and disabled states

**These are mine, not the design's.** `docs/DESIGN.md` 3.8 records that the
prototype specifies no interaction states for any control. The only hover rule in
the whole stylesheet is `a:hover { color: var(--ink) }`, and there are no anchors
in the markup. The config bar cannot ship without them, so they are proposed
here and derived from that one rule rather than invented from nothing.

**The principle.** Hover strengthens the foreground; it never introduces a
colour. That is exactly what `a:hover` does, moving from `--accent` to `--ink`.

| State | Neutral control | Accent control |
|---|---|---|
| Rest | `--muted-strong` on transparent | `--accent-text` on the 12% accent tint |
| Hover | `--ink` on a 6% ink wash | `--accent-text` on an 18% accent tint |
| Pressed | `opacity: 0.72` | `opacity: 0.72` |
| Disabled | `opacity: 0.45`, `cursor: not-allowed`, no hover response | same |

Three new tokens: `--hover-wash-alpha: 6%`, `--pressed-opacity: 0.72`,
`--disabled-opacity: 0.45`, plus `--chip-tint-alpha-hover: 18%`.

**Why these values.** The hover wash is 6% because 12% is already the active
state and hover must not be mistaken for selection. Pressed is opacity rather
than movement because the prototype has no transform on any control and adding
one would introduce a motion language the design does not have. Hover is behind
`@media (hover: hover)` so a touch device does not leave a control looking hovered
after a tap.

**Contrast.** Disabled at 0.45 puts `--muted-strong` at roughly 2:1, which fails
AA. WCAG 1.4.3 exempts inactive controls, and a disabled control that reads at
full strength is worse than one that fails a ratio it is not held to. Nothing in
phase 2 is disabled; the convention exists so phase 3 does not have to invent it
in a hurry.

### 2.2 The wavy underline is half the weight of the solid one

**Decision.** `--extra-underline-width: 1px` against `--error-underline-width: 2px`.

**Why.** A wave's amplitude scales with its thickness, so a 2px wave occupies
roughly three times the vertical space of a 2px rule. On screen at 4x it reads as
a red smear rather than as a wave, and at normal size it blurs into a solid blob
— which defeats the point, since the wave exists to be *distinguishable from* the
solid rule (DECISIONS 0.2's replacement for the opacity that used to separate
them). At 1px the crests are legible and the mark stays subordinate to the glyph.

It is also the right hierarchy. A wrong character is a harder error than an extra
one and should carry the heavier mark.

Judged by rendering both and looking at them, not from the stylesheet.

### 2.3 Line breaking is computed, not delegated to CSS

**Decision.** Each line is its own `nowrap` flex row, filled by a greedy wrap in
`src/components/test/layout.ts`. The browser wraps nothing.

**Why.** The prototype uses `flex-wrap` and then asks the DOM where the caret
ended up — `el.offsetLeft`, `el.offsetTop`, `host.clientWidth`. That is three
layout reads on every keystroke and it is what invariant 3 exists to prevent.

The alternative to computing was to keep CSS wrapping and mirror its algorithm in
JavaScript for the caret. That works only while the two agree exactly, and a
half-pixel of rounding in a flex gap would put the caret on the wrong line with
nothing to catch it. Owning the line breaks means there is nothing to agree with:
a character's column is the number of characters before it, and the caret is
`column * charWidth`.

**Cost.** A word that grows past its own length reflows the rest of its line,
which is a re-render of the affected lines rather than of one word. That happens
only when the user types past the end of a word, and it is a genuine layout
change rather than an avoidable one.

### 2.4 The line measure is fitted to the viewport

**Decision.** The measure is `min(62, floor((innerWidth - 48) / charWidth))`,
recomputed at mount and on resize, never on a keystroke.

**Why.** `docs/DESIGN.md` specifies 62 characters, which at 28px IBM Plex Mono
needs about 1090px of viewport. Between the 620px breakpoint and that width the
design has no answer, and the prototype papers over it by letting CSS wrap. Since
this build owns the line breaks, it has to know the real width, so it reads
`window.innerWidth` — a viewport property, sampled twice in a session, not a
per-element measurement on the keystroke path.

This is a gap in the design rather than a departure from it: DESIGN.md 3.8 lists
"a 360px layout" as unspecified, and the same hole runs all the way up to 1090px.

### 2.5 The caret, the trace and the line scroll bypass React

**Decision.** Those three subscribe to the surface store and set
`element.style.transform` directly. No state, no re-render.

**Why.** ARCHITECTURE.md 4.3 spells out the mechanism: JavaScript sets only
`el.style.transform = translate3d(...)`. Routing it through React would add a
render, a diff and a commit to the one element that moves eight times a second,
for no benefit — there is nothing to diff, the value is always different.

A style write is not a style read. Nothing here asks the browser a question.

### 2.6 One layout at the start of a test, none afterwards

**Observation, not a decision.** A trace of 40 keystrokes inside one word records
zero Layout entries. A trace that includes the first keystroke records exactly
one: the config bar and the hint change state as the test starts, and the counter
appears.

The counter is the unavoidable case. Its text changes once a second and a text
change is a layout in every engine. It carries `contain: layout style` and a
reserved `min-width: 8ch` so that layout cannot escape the element, and the
performance spec removes it before tracing so the claim being measured — that a
keystroke causes no layout — is the claim actually under test.

### 2.7 The latency report separates paint from processing

**Decision.** `src/perf/latency.ts` reports two sets of percentiles: `paint`,
from Event Timing's `duration`, and `processing`, from
`processingEnd - processingStart`. The budget is enforced against `processing`.

**Why.** `duration` is quantised to 8ms by the Event Timing specification and
bounded below by the display's frame interval, so on a 60Hz screen the only
values a correct application can report are 8 and 16. A budget of "under 8ms"
measured that way is a budget of "zero", which is not achievable by any code.

`processing` is the handler: every millisecond of it is ours, and it is the
number that moves when the code gets worse. Both are reported, because the one
the user feels is still the first one.

### 2.8 Escape restarts the test

**Decision.** Ported from the prototype, which binds Escape to regenerate.

**Why.** Without it the screen is a dead end once the timer runs out, and there
is no results screen until phase 3. It is the prototype's own behaviour rather
than an invention, and phase 5 owns the full keyboard map.

### 2.9 The character state attribute uses the engine's name

**Decision.** `.char[data-state='incorrect']`, not `wrong`.

**Why.** `docs/DESIGN.md` calls the state "wrong" and the engine's `CharState`
calls it `incorrect`. One of them has to give, and the attribute is written by
the engine's value, so making CSS match the engine removes a translation step
from the hot path. The token names still read `--underline-wrong`, because those
describe the design's vocabulary rather than the engine's.

This cost a real bug: the first render had the CSS on `wrong` and the engine
emitting `incorrect`, so mistyped characters showed no error styling at all until
it was caught on screen.

---

## Phase 3 — persistence and results

### 3.1 The history list

**Mine, not the design's.** `docs/DESIGN.md` 3.8 records that the prototype has
no history screen and no nav entry for one, and batch 3 needs per-config
personal bests and history.

It borrows wholesale from the weakness report in 3.6, which is the only list
pattern the design has: a label row with a count on the right, rows with
reserved columns, a hairline every fifth row. Columns are date, config, WPM,
accuracy, tags.

It sits on the results screen rather than on a route of its own, because the
navigation the design drew has four entries and history is not one of them.
Inventing a fifth would be designing a screen outside this batch. Ten rows are
shown there; the component renders any number, and the 500 test case is measured
in tests/storage/history.test.ts.

### 3.2 One measure policy, for every screen

**Decision.** `src/components/ui/measure.ts` owns it, and no component decides
for itself.

- Screens measured in pixels — results, progress, weakness, settings, history —
  are fluid: `width: 100%`, a `max-width` token, a 24px gutter. `max-width`
  degrades continuously, so they need no intermediate breakpoint and get none.
- Screens measured in characters — only the test surface — fit to the viewport:
  `min(design measure, floor((innerWidth − 48) / charWidth))`. Characters cannot
  be made narrower, so the count is what gives.
- Below 620px both change together: type steps down, `--muted-narrow` and
  `--error-narrow` bind, and the character measure drops to 32.

**Why.** The gap DECISIONS 2.4 patched for the surface is the same gap on every
screen, and patching it per component is how a codebase ends up with four
different answers. The pixel screens turn out to need nothing at all, which is
worth stating explicitly so nobody adds a breakpoint to them later.

### 3.3 A phone test is kept, marked, and compared against other phone tests

**Decision.** A test tagged `inputSource: 'virtual'` persists exactly like any
other and carries a `phone` marker in history. Personal bests and the seven day
median are scoped to the input source as well as to the configuration.

**Why.** Marking it stops a phone-typed 40 WPM reading as a regression against a
desk. Scoping the comparison stops it *being* one: without that, a week of
commute practice drags the median down and every desk test afterwards reports a
gain it did not earn.

It is the same argument as the bigram exclusion in DECISIONS 1.1, applied one
level up. Thumb typing and touch typing are different motor tasks, and a
comparison across them measures the instrument rather than the person. Nobody
loses their comparison; they get the right one.

### 3.4 Deltas are bytes with an escape, not a bare Int16Array

**Decision.** `deltas` is a `Uint8Array`, with 255 escaping to an `Int32Array`
of the values that did not fit.

**Why.** The brief says Int16Array and also says a 400 keystroke test must pack
to under 1200 bytes. Both cannot hold: 400 two-byte deltas is 800 bytes, leaving
400 for 400 characters and every other field, which is exactly zero headroom.
ARCHITECTURE.md 6.2 quotes about 900 bytes as the target, and a byte per delta
is how that number is reachable — an inter-keystroke gap is under 255ms for
anyone typing at all.

The escape array is Int32 rather than Int16 because a gap can exceed 32 seconds
when someone stops without blurring, and a lossless round trip has to survive it.

Measured: a realistic 400 keystroke test with errors, extras and edits packs to
under 1200 bytes; a clean one to under 1000. Both are asserted.

### 3.5 The theme attribute is only written when the user has chosen one

**Decision.** `applyTheme(null)` removes `data-theme`. Boot writes the attribute
only when localStorage actually held a preference, and the subscription writes it
only when the theme itself changed.

**Why, and it was a bug first.** Applying the stored default at boot pinned every
first-time visitor to light and silently defeated `prefers-color-scheme`, which
DECISIONS 0.5 exists to preserve. Worse, subscribing to the whole store meant
that touching any config chip wrote `data-theme="light"` — so the theme was
correct until the user changed the test length, and then it was not.

Caught by taking a screenshot on a dark system and seeing a light page.

### 3.6 The only run at a configuration is not a personal best

**Decision.** `buildHistory` badges a row `best` only when the scope holds more
than one test.

**Why.** A record needs something to have been beaten. Badging the sole data
point says the opposite of what it means, and it disagreed with the results
screen, which already required beating an existing record before it would say
"Best at this setting". Two components, one word, two meanings.

---

## Phase 4 — the adaptive engine

### 4.1 The targeting multiplier is bounded by natural frequency

**Observation, not a decision.** The brief asks for the targeted bigrams to
appear at three times their natural English frequency. Measured over 4000
generated words against a synthetic user with five known-slow pairs:

    ol 4.9x   un 2.8x   ce 3.3x   rt 2.9x   br 7.2x     mean 4.2x

The ordering is not noise: `br` is the rarest of the five and multiplies most,
`un` the most common and multiplies least. The 35% common-word dilution is
undiluted English by definition, so the overall multiplier is
`0.35 + 0.65 * (multiplier inside the weighted half)`. Clearing 3 overall needs
4.1 inside it, and there is less room above a pair that is already everywhere.

The dilution is not the knob. ARCHITECTURE.md 8.2 step 4 is explicit that it is
what keeps retention and keeps the text reading like English, and lowering it to
make an assertion pass would trade the thing that works for the number that
reports it. The suite asserts a mean of 3 and a per-pair floor of 2.5, and says
why in the test.

### 4.2 The chart range is fitted to the data

**Decision.** Both charts range over `[min - 15% of span, max + 15% of span]`,
with a ten unit minimum span and a floor at zero.

**Why.** Nobody's WPM is usefully read against not typing. Anchoring at zero
crushes a 62-to-78 spread into the top fifth of the box, where a real ten word
per minute swing looks like a flat line — and the interesting thing about a WPM
curve is the variation, which is exactly what zero-anchoring hides.

The error ticks moved with it: they sit at the bottom of the range rather than
at zero, because zero is no longer on the chart.

### 4.3 Bigram aggregation refuses soft-keyboard tests a second time

**Decision.** `aggregate` returns the table unchanged for an observation tagged
`inputSource: 'virtual'`, even though the engine has already withheld the
samples.

**Why.** The rule exists in the engine and the rule is verified in the engine,
but the bigram table is the one thing in the product that cannot be rebuilt from
the raw log if it is corrupted — the EWMA is lossy by construction. A second
refusal at the point of no return is cheap. `tests/adaptive/endToEnd.test.ts`
drives real keystrokes through the engine and reads the table out, for both this
and the pause-count rule, rather than trusting either.

### 4.4 A theme preference of null is not a theme preference of light

**Decision.** `Prefs['theme']` is `'light' | 'dark' | null`, defaulting to null,
and `applyTheme(null)` removes the attribute.

**Why, and it was the same bug twice.** DECISIONS 3.5 gated the boot-time write
on whether anything had been stored. That was not enough: preferences are
written on every configuration change, so a record exists the first time anyone
touches a chip — and it carried the store's default theme. A first-time visitor
on a dark system got a dark page until they changed the test length, and a light
one afterwards.

Storing "has not chosen" as a value rather than inferring it from the absence of
a record is the only version of this that does not have a third form.

Found the same way as the first two: by taking a screenshot on a dark system.

---

## Phase 5 — quality floor

### 5.1 The header and its four nav entries

**Decision.** `src/components/ui/Header.tsx`, built from the design's own
lockup: the wordmark, a 2 x 11px accent caret after it, a 1px accent rule under
it, and the four nav entries `Test`, `Progress`, `Weaknesses`, `Settings`. It
fades out on the first keystroke like the config bar.

**Why.** Three screens sat flush against the top of the viewport and the
weakness report was reachable only from a button on the results card, which is
not navigation, it is a patch. The design drew this header in 3.0 and it was
simply never built.

`Settings` leads to an honest placeholder. A nav entry that goes nowhere is
worse than one that says so, and every control the settings screen would hold is
already on the test screen.

### 5.2 --track, and a misclassification corrected

**Decision.** A new palette entry: `--light-track: #888372` at 3.05:1 against
the light canvas, `--dark-track: #65685c` at 3.13:1 against the dark one. Used
for the weakness bar tracks and the every-fifth-row rules. Dividers keep
`--hairline`.

**Why, and I got this wrong in batch 0.** DECISIONS 0.1 listed `--hairline` on
`--canvas` at 1.23:1 among the boundary treatments WCAG 1.4.11 exempts. That is
right for a divider and wrong for the unfilled half of a meter: the extent of a
progress bar is part of reading the progress bar, so it is a component that
conveys information rather than decoration. On the weakness report the tracks
were invisible and the bars read as floating lines.

The fill against the track is 1.58:1 light and 2.26:1 dark, which does not clear
3:1 — in the light theme it cannot, because `--accent` is dark and any track
that clears 3:1 against a light canvas necessarily sits between them. What was
broken was that the meter had no visible extent at all; the fill is distinguished
from the canvas at 4.81:1 and by hue.

### 5.3 The drill banner

**Mine, not the design's.** `docs/DESIGN.md` has no drill screen. The
differentiator had no surface saying you were using it, which is how a feature
nobody notices becomes a feature nobody values.

**Decision.** A banner directly above the config bar, in the same 13px
muted-strong register: the word `Drilling`, the first five targeted pairs as
accent-tinted mono chips at the size the results card uses for a pair, and one
text button back to plain English. It fades on the first keystroke like
everything else.

**Above the config bar, not in place of it.** It first shipped replacing the bar,
which read tidily and was wrong: mode, duration, punctuation and numbers became
unreachable for as long as a drill was on, and the only way to change a duration
was to leave the drill and go back into it. A drill is the test screen with
different words in it, so every setting that applies to a test applies to a drill
too. The banner's height is reserved back out of the block's top margin
(`--drill-banner-height`), so turning a drill on adds a row of information
without moving the text.

**Why a banner and not a screen.** A drill *is* the test screen with different
words in it. A second surface would mean two implementations of the caret, the
trace and the line scroll, and the single thing phase 2 spent its whole budget
on is that there is exactly one of those. Every value it uses is a token that
already existed.

### 5.4 Shift+Tab repeats the same words, not the same settings

**Decision.** The word list of the running test is kept, and Shift+Tab replays
it exactly.

**Why.** "Repeat the identical test" has to mean identical, or the second run
compares your typing against a different draw and the comparison says nothing.

### 5.5 The narrow header wraps the nav onto its own row

**Mine, not the design's.** `docs/DESIGN.md` 3.8 lists the sub-620px header as
unspecified. The header shipped in 5.1 with only the wide layout, and it
overflowed every phone viewport: `nav right=416` against a 375px screen.

**Decision.** Below 620px the header wraps. The wordmark centres on the first
row, the four nav entries take the full width of the second and distribute with
`space-between`. Padding steps from `16px 24px` to `12px 16px` and the nav gap
from 20px to 10px. Every value is an existing token. The wide layout is
untouched.

**Why not one row.** It does not fit, and that is arithmetic rather than taste.
The four labels measure 247px of text before a single gap is added, the wordmark
is 60px, and a 320px viewport leaves 288px of content box once the narrowest
sensible padding is taken. Even at zero gaps a single row needs 307px. The only
way to hold one row is to take the label below the design's 13px, which trades a
specified value for an unspecified one in the wrong direction.

**Why not a hamburger.** Four entries. A menu that hides four words behind a tap
costs a tap, an animation, a focus trap and an aria-expanded contract, to save
28px of vertical space. The second row is cheaper for the user and cheaper to
maintain.

**Cost.** The header is 87px tall on a phone instead of 60px. That is 27px of
vertical space on the screen that can least afford it, and it is why the block
offset in 5.6 is derived from the real header height rather than assumed.

### 5.6 The block offset is derived, not assumed

**Correction.** `docs/DESIGN.md` 266 puts the middle of the three surface lines
at 46% of viewport height, and the margin that achieves it subtracted a flat
`60px`. That 60px was the config bar, and it was written when nothing sat above
the config bar. The header added in 5.1 went in above it and nothing subtracted
it, so the line the whole screen exists to show sat 59px low on desktop and
130px low on a phone — measured, not estimated.

**Decision.** The margin subtracts `--surface-stack`, which is
`--header-height + --config-bar-height`, both pinned per breakpoint:

| | header | config bar | sum |
| --- | --- | --- | --- |
| above 620px | 60 | 60 | 120 |
| 620px to 336px | 87 | 103 | 190 |
| 335px and below | 87 | 147 | 234 |

**Why measured constants rather than a layout read.** Invariant 3 forbids
reading layout on the keystroke path, and this is a mount-time value, so a
`getBoundingClientRect` here would not break it. It would still be the wrong
shape: the surface is positioned by arithmetic everywhere else, from the caret
column to the line scroll, and one measured offset in the middle of that would
be the only number nobody could predict from the tokens. The values above are
reproducible from the stylesheet.

**Cost.** The config bar wraps, so the sum is a step function and each step is a
breakpoint that has to be kept honest. If a chip is ever added to the config bar
these numbers move, which is why the browser check asserts the position rather
than trusting them — and that is not hypothetical. 5.7 removed two dividers from
the narrow bar, which moved the third-row wrap from between 360px and 350px down
to between 336px and 335px. The check caught the stale breakpoint immediately.

**Verified.** The middle line lands within 1px of 46vh at 1440, 900, 700, 620,
480, 375, 360, 340 and 320px. It was 52.6vh and 62.1vh before.

### 5.7 The narrow config bar drops its dividers

**Mine, not the design's.** `docs/DESIGN.md` 269 specifies three groups separated
by 1px x 14px `--hairline` dividers. It specifies that for the wide bar; the
narrow bar wraps, and a wrapped bar is not a case the prototype covers.

**The defect.** Below 620px the bar wraps to two rows and the second divider
landed at the end of the first row, after `120`, with nothing to its right. A
separator with one side is not a separator — it reads as a fourth group that
lost its contents.

**Decision.** Below 620px the dividers are not rendered. The 16px row gap carries
the grouping on its own, which it can, because a wrapped row is already a visible
break.

**Why not keep them and hide the trailing one.** CSS cannot ask whether a flex
item ended a row. Every alternative that keeps a divider in the flow moves the
problem rather than solving it: attaching it to the group ahead leaves the
hairline trailing `120` exactly as before, and attaching it to the group behind
opens the second row with a leading hairline instead. The information a divider
carries is "these two things are side by side", and once they are not, there is
nothing to say.

