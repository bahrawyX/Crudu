# Claude Code Prompts

Six batches. One session each. Run them in order.

**Before batch 0:** create the repo, put `CLAUDE.md` at the root, and put the architecture report at `docs/ARCHITECTURE.md` and the Claude Design output at `docs/DESIGN.md`.

Paste each batch as your first message of a new session. Do not run two batches in one session, because context degrades and the invariants start slipping around the 60% mark.

---

## Batch 0 — Scaffold and rails

```
Read CLAUDE.md and docs/ARCHITECTURE.md fully before writing anything.

Set up the project skeleton and the guard rails that keep later batches honest.
Build nothing that a user can see yet.

Scope:
1. Vite 6 + React 19 + TypeScript in strict mode. Enable
   noUncheckedIndexedAccess and exactOptionalPropertyTypes.
2. Tailwind v4, configured CSS-first. Create src/styles/tokens.css holding
   every token from docs/DESIGN.md as CSS custom properties, both themes,
   switched by a data-theme attribute on <html>. No JS in the theme switch.
3. Vitest with coverage, and Playwright with a Chromium project.
4. ESLint with a no-restricted-syntax rule that FAILS the build on:
   - getBoundingClientRect, offsetWidth, offsetHeight, getComputedStyle
     anywhere under src/components/test/ or src/engine/
   - any import of motion, framer-motion or gsap under src/components/test/
   - any import of react under src/engine/
   These encode invariants 1, 2 and 3. They must fail CI, not warn.
5. The full directory tree from CLAUDE.md, each directory holding a real
   index or a real module. No empty placeholder files.
6. A GitHub Actions workflow running typecheck, lint, test and build on push.
7. .gitmessage template matching the commit format in CLAUDE.md, wired up
   with git config commit.template.
8. Source the word lists. Use github.com/first20hours/google-10000-english
   (public domain). Filter to a-z only, length 2 to 9, and emit
   src/words/en-1000.json and en-5000.json. Commit the generator script,
   not just the output.
   Do NOT copy Monkeytype's word lists. Monkeytype is GPLv3 and we are not.

Branch: phase/0-scaffold
Expected commits, roughly: chore(setup) vite and typescript, chore(setup)
tailwind and tokens, chore(setup) test harness, chore(setup) lint rules
enforcing invariants, chore(setup) CI, chore(setup) word list generator.

Done when:
- pnpm typecheck, lint, test and build all pass
- Deliberately adding getBoundingClientRect to a file in src/components/test/
  makes lint fail. Prove this, then remove it.
- Toggling data-theme on <html> swaps every token with no JS involved

Then tag v0.0.0-scaffold and stop. Report what you set up and anything in
docs/DESIGN.md you could not express as a token.
```

---

## Batch 1 — The engine

This is the highest-value batch. The engine is the product, and it is fully testable without any UI, so build it in isolation where mistakes are cheap.

```
Read CLAUDE.md and docs/ARCHITECTURE.md sections 4, 6 and 9.

Build the typing engine as pure TypeScript under src/engine/. No React, no
DOM, no rendering. It must be fully exercisable from a Vitest file.

FIRST COMMIT: write docs/SPEC.md capturing the behaviour below verbatim,
before writing any code. Later batches read it. Commit it on its own.

State machine: idle -> running -> (paused) -> complete

Behaviour, all of which must be resolved exactly as written:

1. Input
   - Accept printable characters, space, backspace, ctrl/cmd+backspace.
   - Ignore modifier-only keys. Do not log them.
   - Ignore a leading space at the start of a word. No-op, not an error.
   - Block paste entirely.
   - Ignore IME composition events. Guard with beforeinput inputType checks.
   - Held keys arriving with event.repeat true still count as characters,
     but are excluded from bigram latency data. A held key produces
     meaningless latency.

2. Word boundaries
   - Space with the current word incomplete: advance to the next word and
     mark the remaining characters missed.
   - Missed characters count against accuracy. They do not count toward raw
     WPM, because the user never typed them.
   - Characters typed beyond a word's length are "extra", capped at
     word.length + 10. Input beyond the cap is discarded silently.

3. Backspace
   - Within the current word: always allowed.
   - Into a previously completed word: allowed only if that word contains at
     least one error. Correct words are locked. This is the default and it
     matches Monkeytype.
   - ctrl/cmd+backspace deletes to the start of the current word. If already
     at the start, it deletes the previous word subject to the same lock.

4. Test end
   - time mode: ends on the timestamp, mid-word if necessary. Characters
     typed in the partial word count as correct or incorrect normally.
     Untyped characters of that word are neither.
   - words mode: ends on the final character of the final word. No trailing
     space required.
   - time mode generates words lazily in chunks of 50, appending as the user
     approaches the end. Never generate an unbounded list up front.

5. Timing
   - Every keystroke stores event.timeStamp, passed in by the caller. The
     engine never calls performance.now() itself. This keeps it pure and
     testable with synthetic timestamps.
   - Blur pauses. Elapsed time excludes paused spans.
   - A gap over 1000ms between keystrokes is excluded from bigram latency
     and from consistency sampling. The user paused, they did not slow down.

6. Metrics, exactly these definitions
   - net WPM   = correct characters including correct spaces / 5 / minutes
   - raw WPM   = all characters typed / 5 / minutes
   - accuracy  = correct keypresses / total keypresses, measured at the
                 moment of the keypress. A corrected error still counts
                 against you, because it cost real time.
   - consistency = 100 * (1 - stddev/mean) over per-second raw WPM samples
   - bigram latency = keydown(n).timeStamp - keydown(n-1).timeStamp,
                      discarded if either keystroke was wrong, if the gap
                      exceeds 1000ms, or if either was a repeat

7. Subscription API
   Expose a subscribe(listener) that reports which word indices are dirty.
   Design it so useSyncExternalStore can subscribe per word. Do not emit a
   whole-state change on every keystroke.

Testing: this is the batch where coverage matters. Every numbered rule above
needs at least one test. Include a property test that feeds 10,000 random
keystroke sequences and asserts the engine never throws and never produces
negative or NaN metrics.

Branch: phase/1-engine
Done when: 100% branch coverage on src/engine/, and a test that types a
known 50-character sequence with known timestamps produces the exact WPM,
accuracy and consistency values you compute by hand in the test file.

Tag v0.1.0-engine and stop. Report any rule above that turned out to be
ambiguous when you implemented it.
```

---

## Batch 2 — The test surface

```
Read CLAUDE.md, docs/SPEC.md and docs/DESIGN.md sections 1 through 4.

Build the visible test screen on top of the batch 1 engine.

Important: docs/DESIGN.md was produced by a design tool. Treat its visual
decisions as authoritative and its implementation as a suggestion. Design
output routinely violates invariants 2, 3 and 4, typically by animating
characters with a JS library or positioning the caret from a measured
rect. Port the visuals; rewrite anything that breaks a performance rule,
and say in the commit body what you changed and why.

Scope:
1. Character width measured once on font load via canvas measureText,
   cached in context. Recompute only on font size or family change.
2. <Word> memoized, subscribing to the engine per index via
   useSyncExternalStore. Verify with React DevTools Profiler that one
   keystroke re-renders one Word.
3. Caret: absolutely positioned, transform translate3d only, 90ms
   cubic-bezier(0.2, 0, 0, 1), 6px accent glow at 30% opacity, 1.1s blink
   that stops while typing and resumes after 800ms idle.
4. The trace line under the active line, transform scaleX with
   transform-origin left. This is the signature element. Get it right.
5. Three-line viewport, 62ch max width, block at 46% viewport height.
   Lines scroll up on completion, active line holds position.
6. Hidden input for keystroke capture. Not contenteditable. autocomplete,
   autocorrect and autocapitalize off, spellcheck false, so mobile
   keyboards and IME behave.
7. Config bar, and its 180ms fade to opacity 0 with pointer-events none on
   first keystroke.
8. Focus-lost state: pause, 4px blur at 50% opacity, single centred line.
9. Remaining time or word count, top left, 13px. No live WPM. This is
   deliberate: a live number pulls the eye off the text.
10. src/perf/latency.ts: a PerformanceObserver on event entries reporting
    p50, p95 and p99 keydown-to-paint, exposed on window in dev.

Branch: phase/2-test-surface
Done when:
- Chrome DevTools performance trace of 30 seconds of typing shows ZERO
  Layout entries. Attach the finding to the commit body.
- p95 keydown to paint is under 8ms on your machine, reported by latency.ts
- Font swap cannot shift character positions mid test

Tag v0.2.0-test-surface and stop. Report measured p50, p95 and p99, and
every place you had to depart from docs/DESIGN.md to hold the perf budget.
```

---

## Batch 3 — Persistence and results

```
Read CLAUDE.md, docs/ARCHITECTURE.md section 6, docs/DESIGN.md section 3.4.

Scope:
1. src/storage/pack.ts: delta-encode keystroke timestamps into an Int16Array,
   characters into a parallel string. Round-trip must be lossless. A
   400-keystroke test must pack to under 1200 bytes. Assert this in a test.
2. src/storage/db.ts on idb-keyval. Keys mirror the future Postgres schema
   exactly: test:{id}, key:{char}, bigram:{pair}, meta:*. Migration later
   becomes a sync script rather than a rewrite.
3. src/storage/prefs.ts on localStorage. Preferences only. Synchronous read
   at boot is desirable here, it prevents a flash of the wrong theme.
4. Persist once on test completion, after the results screen has painted.
   Never during a test. Wrap in requestIdleCallback.
5. Prune policy: full keystroke logs kept 90 days, derived metrics kept
   forever. Configurable, running on boot.
6. Results screen per docs/DESIGN.md 3.4, including both variants: new
   personal best, and calibrating for tests 1 through 3.
7. WPM graph in uPlot. Accent line, error ticks on the baseline, one
   hairline at the median. Not Recharts, for the reason in ARCHITECTURE 5.2.
8. Results entrance: one 700ms sequence, numbers 400ms, graph from 150ms,
   cards staggered 40ms from 350ms. Motion is allowed here.
9. History and per-config personal bests. A PB is scoped to the exact
   config, so time-30-punctuation and time-30-plain are separate records.

Branch: phase/3-persistence
Done when:
- Pack round-trip is lossless over 1000 randomized tests
- QuotaExceededError is handled and surfaces the copy from DESIGN.md 5
- Filling IndexedDB with 500 synthetic tests keeps the history view under
  100ms to render

Tag v0.3.0-persistence and stop.
```

---

## Batch 4 — The adaptive engine

This is the differentiator. Nothing in the market targets transitions rather than letters. Do not let it get rushed at the end of a long session.

```
Read CLAUDE.md and docs/ARCHITECTURE.md section 8 in full.

Build the adaptive drill system under src/adaptive/.

Scope:
1. bigrams.ts: incremental EWMA aggregation, alpha 0.25. Ignore any bigram
   with fewer than 8 samples. Track ewmaMs, n, errorRate, lastSeen.
2. weakness.ts:
     z = (bigram.ewmaMs - userMedianMs) / userStdDevMs
     weakness = max(0, z) * (1 + bigram.errorRate * 2)
   Normalising against the user's OWN median is the core idea. It means the
   app targets your relative weaknesses and stays useful as you improve and
   your bottleneck moves. Do not normalise against a global baseline.
3. generator.ts:
     score(word) = sum(weakness(b) for b in bigrams(word)) / (word.length - 1)
   Sample 65% of words with probability proportional to score^1.5, and 35%
   from the top-1000 common list.
   That 35% is not padding. Interleaved practice beats blocked practice on
   retention in essentially every motor-learning result, and it keeps the
   text reading like English rather than a phonetics exam. Do not remove it
   to make drills more "focused".
   Cap any single word at 3 appearances per generated list.
4. Retirement: when a targeted bigram's EWMA falls below the user median
   across 3 consecutive appearances, drop it and pull in the next. Keep the
   target set at 15.
5. Accuracy gate: difficulty only escalates when the last 3 tests each
   cleared 96%. The product must not reward speed bought with errors.
6. Cold start: first 3 tests are plain common-word English, labelled
   calibrating, with the remaining count shown honestly.
7. Weakness card on the results screen and the full weakness report screen,
   both per docs/DESIGN.md 3.4 and 3.6.
8. Progress screen: 7-day rolling median, not personal bests. Include the
   empty state from DESIGN.md 3.5 with its exact copy.

Testing: seed a synthetic user with known-slow bigrams, run 50 simulated
tests, and assert those bigrams appear at 3x or more their natural English
frequency in generated text, and that generated text still reads as English
by checking that 90% of words come from the real word list.

Branch: phase/4-adaptive
Done when: the simulation above passes, and a bigram whose latency is
artificially improved is retired from targeting within 3 appearances.

Tag v0.4.0-adaptive and stop. Report the observed targeting multiplier.
```

---

## Batch 5 — Quality floor and ship

```
Read CLAUDE.md and docs/DESIGN.md sections 6 and 7.

Scope:
1. Keyboard navigation everywhere. Tab then Enter restarts, Shift+Tab
   repeats the identical test, Esc returns the config bar. A user who has
   to reach for the mouse in a typing app has been failed.
2. Visible focus rings in accent on every interactive element.
3. prefers-reduced-motion removes all motion EXCEPT the caret transition,
   which drops to 40ms. A caret that teleports is harder to track, so
   removing it is an accessibility regression not an improvement.
4. Responsive to 360px: 20px type, 32ch line width.
5. Verify every DESIGN.md contrast pairing with an automated axe run. The
   tokens were computed to pass, so any failure means a token got altered
   somewhere. Find it rather than adjusting the token.
6. Confirm the bans in DESIGN.md 6 hold across the built app. In
   particular: no live WPM during a test, no three-equal-card rows, no
   decorative status dots, no scroll cues.
7. e2e/latency.spec.ts in CI: inject 400 keystrokes at 8 per second via
   CDP, capture frame timings, fail the build on any dropped frame. This
   is the regression that is invisible in code review and obvious in
   production.
8. Bundle budget: 150KB gzip initial, enforced in CI with
   rollup-plugin-visualizer.
9. README with setup, architecture summary, and a short section on why the
   engine sits outside React, so the next reader does not "fix" it.

Branch: phase/5-quality
Done when: all CI gates green, axe clean in both themes, latency spec
passing.

Tag v1.0.0 with an annotated message listing what shipped and what was
deliberately deferred. Stop and report.
```

---

## Between batches

Two things worth doing yourself rather than delegating.

**Use it.** After batch 2, type on it for ten minutes a day. The caret feel, the line-scroll timing, the fade of the config bar: none of that is decidable from a spec. It only exists once it is running.

**Read the log.** `git log --oneline --graph` after each phase. If a commit subject does not tell you what it did, the discipline is already slipping and it is much cheaper to correct at commit 20 than at commit 200.
