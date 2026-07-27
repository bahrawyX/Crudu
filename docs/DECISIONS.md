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
