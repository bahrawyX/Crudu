# Internal Typing Trainer — Technical Case Study & MVP Plan

**Prepared for:** Engineering team rollout
**Scope:** Client-only web app, local persistence, no backend in v1
**Date:** July 2026

---

## 1. The thesis

We looked at ~50 features across Monkeytype, Keybr and TypeRacer. Almost all of them are surface. The three products differ in exactly one meaningful way:

| Product | What it actually is |
|---|---|
| Monkeytype | A **measurement instrument** with excellent ergonomics |
| Keybr | A **training algorithm** with a mediocre interface |
| TypeRacer | A **social pressure engine** wrapped around real prose |

Monkeytype does not make you faster. It tells you, precisely, how fast you are. People plateau on it because repeating a test you're already good at is not practice — it's assessment. Keybr makes people faster but its method (progressive letter unlocking, pseudo-words) is designed for someone learning the keyboard from zero. Our engineers already touch-type at 50–90 WPM. Unlocking `e` and `n` for them is insulting and useless.

**So the product we should build is neither.** It is Monkeytype's ergonomics wired to a Keybr-class adaptive engine, but with the engine tuned for people who are already competent — meaning it targets *transitions*, not *letters*.

That single decision drives the entire architecture below, including the data model, which is why it comes first.

---

## 2. Why transitions, not letters

At 30 WPM your bottleneck is finding keys. At 70 WPM every individual key is already automatic — your fingers know where `t` is. What costs you time is the *movement between* keys.

Specifically:

- **Same-finger bigrams (SFBs)** — `ol`, `ed`, `un`, `ce` on QWERTY force one finger to travel twice. These are 2–3× slower than an alternating bigram.
- **Same-hand rolls against the grain** — `rt`, `sa`, `we` (inward vs outward rolls have very different costs).
- **Awkward reaches** — anything involving `b`, `y`, `p`, `;` and shifted characters.
- **Hand-alternation recovery** after punctuation, capitals, and numbers.

A per-letter model (Keybr) cannot see any of this, because the cost isn't in the letter, it's in the pair. A per-bigram model can, and there are only ~1,300 bigrams worth tracking in English. That's a tiny dataset — a few kilobytes per user — and it produces dramatically better drill targeting.

**This is the feature nobody in the market has.** It is also, conveniently, nearly free once you're already logging keystroke timestamps, which you need to do anyway to draw the WPM graph.

---

## 3. MVP scope — 12 in, 38 out

Cut ruthlessly. These 12 ship in v1:

**Core loop**
1. Test modes: time (15 / 30 / 60s) and words (10 / 25 / 50)
2. English word list, with punctuation and numbers as independent toggles
3. Live caret, per-character `correct / incorrect / extra / pending` states
4. Backspace and `Ctrl+Backspace` (delete word), with configurable "stop on error"

**Measurement**
5. Results: net WPM, raw WPM, accuracy, consistency, character breakdown
6. WPM-over-time graph with error markers on the timeline
7. Local history and personal bests, scoped per exact config

**The differentiator**
8. Weakness report: slowest keys *and* slowest bigrams vs. your own baseline
9. **Adaptive drill mode** — generates word lists weighted toward your weak bigrams

**Shell**
10. Restart (`Tab` → `Enter`), repeat identical test (`Shift+Tab`)
11. Three themes, respecting `prefers-color-scheme` and `prefers-reduced-motion`
12. Full keyboard navigation — you never touch the mouse

**Explicitly deferred:** multiplayer racing, quotes and licensed text, funboxes, 60+ languages, custom theme editor, alternative layouts (Dvorak/Colemak), leaderboards, tournaments, race replays, ghost mode, command palette, custom text import, PWA install.

Two of those deferrals are worth defending:

- **No leaderboards in v1.** See §12 — this is a people risk, not a technical one.
- **No quotes/real prose in v1.** Sourcing text with clean licensing is a legal and content-curation problem, not an engineering one, and it will eat a week. Punctuation and numbers toggles get us 80% of the "real text" benefit for a day of work.

---

## 4. The one hard engineering constraint: input latency

Everything else in this app is easy. This is not.

A typing app is judged almost entirely on how the keyboard *feels*, and that feeling is one number: **the delay between keydown and the pixel changing on screen.** Users can't articulate it, but they can feel 40ms, and they will describe a laggy typing app as "bad" without knowing why. Monkeytype's real moat is that it nails this.

**The budget:** keydown → paint in **one frame**. That's 16.7ms at 60Hz and 6.9ms on a 144Hz monitor. Our target is ≤8ms of main-thread work per keystroke, with **zero layout recalculation**.

At 100 WPM a user generates ~8 keystrokes/second. Every one of them triggers our render path. If a keystroke causes a React re-render of 300 character nodes plus a `getBoundingClientRect()` to position the caret, we blow the budget and the app feels mushy.

Three architectural decisions follow directly from this, and they are non-negotiable:

### 4.1 Monospace is a technical requirement, not a style choice

If every character is the same width, caret position is arithmetic:

```
caretX = columnIndex * charWidth
caretY = lineIndex   * lineHeight
```

`charWidth` is measured **once** when the font loads and cached. No DOM measurement during typing, ever. No forced synchronous layout. This alone removes the single biggest source of jank in naive implementations.

Monkeytype allows proportional fonts and pays for it with caret jitter. We won't offer them in v1. If we ever do, the fix is a precomputed per-character width table built with `canvas.measureText()` at font load — not runtime measurement.

Font must be preloaded as `woff2` with `font-display: block` on the test surface specifically. A FOUT that swaps metrics mid-test shifts every character and looks broken.

### 4.2 The typing engine lives outside React

React's job is to paint. It should not be in the input path.

The engine is a plain TypeScript module — a reducer over an immutable state object, zero dependencies, fully unit-testable. It receives keystrokes, updates state, and emits change notifications. React subscribes via `useSyncExternalStore` **at word granularity**, so a keystroke re-renders exactly one `<Word>` component (two on a backspace crossing a word boundary), not the 300-node tree.

```
keydown ──> engine.input(char, event.timeStamp)
              │
              ├─ mutate engine state (plain objects, no React)
              ├─ push keystroke to in-memory ring buffer
              └─ notify subscribers for dirty word indices only
                        │
                        └─> <Word idx={n} /> re-renders  (~1ms)
```

Two details that matter more than they look:

- **Use `event.timeStamp`, not `performance.now()` inside the handler.** `timeStamp` is when the browser received the event; `performance.now()` is when your handler happened to run. Under load the gap between them is 5–30ms of pure noise injected into every bigram measurement. This one-word change materially improves the quality of the adaptive engine's data.
- **Never write to storage during a test.** `localStorage` is synchronous and blocks the main thread. A single mid-test write is a visible stutter. Buffer keystrokes in memory; persist once on test completion.

### 4.3 The caret animates on the compositor, never in JavaScript

The caret is the most-animated element in the app — it moves 8 times a second. It must be:

```css
.caret {
  position: absolute;
  will-change: transform;
  transition: transform 90ms cubic-bezier(0.2, 0, 0, 1);
}
/* JS sets only: el.style.transform = `translate3d(${x}px, ${y}px, 0)` */
```

`transform` and `opacity` are the only two properties the browser can animate off the main thread. Animating `left`/`top` forces layout on every keystroke and will destroy the frame budget.

**A JavaScript animation library must never touch the caret or the character nodes.** More on this in §7.

---

## 5. Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite 6** | Instant HMR, tiny output, no server runtime to reason about |
| UI | **React 19 + TypeScript (strict)** | Team fluency; `useSyncExternalStore` is exactly the primitive we need |
| Routing | **TanStack Router** | Type-safe params; test config lives in the URL so links are shareable |
| Styling | **Tailwind v4** | CSS-first config; themes become CSS custom properties with zero JS |
| App state | **Zustand** | For UI/settings only — *not* the typing engine |
| Typing engine | **Plain TS reducer** | No library. It's ~400 lines and must stay dependency-free |
| Local storage | **IndexedDB via `idb-keyval`** + `localStorage` for prefs | See §6.2 — this is a correction to the original plan |
| Results chart | **uPlot** | Canvas-based, ~45KB, renders 10k points in <10ms |
| Animation | **Motion (`motion/react`)** for shell, **CSS** for the test surface | See §7 |
| Fonts | Variable monospace, subset + preloaded | JetBrains Mono or Geist Mono |
| Tests | **Vitest** (engine) + **Playwright** (keystroke sequences) | Engine is pure functions — trivially testable |

### 5.1 Why not Next.js

This is worth stating plainly because it's the default reach for our team.

Next.js is the wrong tool here, and not for small reasons:

- **There is no server.** No data fetching, no SEO surface on the app itself, no auth in v1. Every capability Next.js exists to provide is unused.
- **Hydration is a direct cost to our primary metric.** The app's first meaningful interaction *is a keystroke*. Server-rendering markup and then hydrating it means there's a window where the page looks ready and swallows input. A client-rendered SPA behind a 60ms skeleton is strictly better UX for this specific product.
- **RSC adds a mental model with zero payoff** when every component is `'use client'` by necessity.

Vite's dev server also gives sub-100ms HMR, which matters when you're iterating on caret feel and need a tight loop.

**If we do use Next.js anyway** — defensible on team-familiarity grounds — then: `output: 'export'`, the entire `/test` route client-only, and no `next/font` on the test surface (its CSS-variable injection can land after first paint and shift metrics). We'd be paying a real cost for familiarity, and it should be a conscious trade rather than a default.

### 5.2 Why uPlot over Recharts

Recharts is fine for the post-test graph (60 points, rendered once). It is not fine for the long-term progress chart, which after three months of daily use holds thousands of points across an SVG DOM. uPlot draws to canvas and doesn't care. Using one library for both is simpler than using the right library for each.

---

## 6. Data model

### 6.1 Design it for the database we'll have in six months

The single most expensive mistake here would be storing only aggregates. **Store the raw keystroke log.** Everything else — WPM curve, per-key stats, bigram latencies, replay, consistency, error analysis, features we haven't thought of yet — is derivable from it. Aggregates are not reversible.

```ts
type Keystroke = {
  c:  string   // character actually typed
  e:  string   // character expected
  t:  number   // ms since test start (from event.timeStamp)
  ok: boolean
}

type TestResult = {
  id: string
  startedAt: number
  config: { mode: 'time' | 'words'; value: number; punctuation: boolean; numbers: boolean; adaptive: boolean }
  keystrokes: Keystroke[]        // the source of truth
  derived: {                      // cached so history views don't recompute
    wpm: number; raw: number; accuracy: number; consistency: number
    chars: { correct: number; incorrect: number; extra: number; missed: number }
  }
}
```

Rolling aggregates, updated incrementally after each test:

```ts
type BigramStat = {
  pair: string      // "ol"
  ewmaMs: number    // exponentially weighted mean latency
  n: number         // sample count — ignore until n >= 8
  errorRate: number
  lastSeen: number
}
```

EWMA with `α = 0.25` gives roughly a 15-sample memory: recent performance dominates, so improvement shows up within a session or two, but a single fumbled keystroke doesn't reclassify a bigram as weak. This is the number to tune once we have real data.

Per-user bigram table: ~1,300 rows max, a few hundred KB. Trivial at any scale.

### 6.2 localStorage is the wrong primitive — use both

This corrects the original spec. `localStorage` has two properties that hurt us:

1. **It is synchronous.** Every read and write blocks the main thread. Fine for a 200-byte settings object at boot; not fine for a 40KB keystroke log.
2. **It caps at ~5MB per origin.** A 60-second test at 80 WPM is ~400 keystrokes ≈ 12KB of JSON. Three tests a day fills the quota in **under four months**, and it fails by throwing `QuotaExceededError` mid-write.

Split it:

- **`localStorage`** — settings, theme, active config, last-session pointer. Small, synchronous reads at boot are actually an advantage here (no flash of wrong theme).
- **`IndexedDB`** (via `idb-keyval`, ~600 bytes) — test history, keystroke logs, bigram tables. Asynchronous, effectively unbounded, and we write to it exactly once per test, after the results screen has already painted.

Pack the keystroke log before storing: delta-encode timestamps into an `Int16Array` and store characters as a separate string. A 400-keystroke test drops from ~12KB of JSON to **~900 bytes**. Two years of daily use fits in under 2MB.

Also add a **prune policy** from day one: keep full logs for the last 90 days, keep `derived` forever. Retention is a one-line config now and a migration later.

### 6.3 Which database when we outgrow local — **Postgres (Neon) + Drizzle**

**Recommendation: Postgres.** Reasoning, including what we rejected:

| Candidate | Verdict |
|---|---|
| **Postgres (Neon)** | ✅ Relational core (users, teams, tests), `JSONB`/`bytea` for logs, `bytea` + delta packing for keystrokes. Handles our scale a thousand times over. Team already knows Drizzle. |
| SQLite / Turso | Genuinely tempting — per-user embedded DBs, edge reads, and our access pattern is heavily user-scoped. Rejected only because cross-user features (team views, comparisons) get awkward, and we'll want them by month six. |
| ClickHouse / Timescale | Correct shape for keystroke data, wrong scale. 50 engineers × 3 tests/day ≈ 15M keystroke rows/year — Postgres yawns at that. Adding a second database for this is unjustified complexity. |
| Mongo / Firestore | The data is relational and the aggregates need transactional updates. No. |

Schema sketch:

```
users        (id, email, created_at)
test_results (id, user_id, started_at, config JSONB, derived JSONB, log BYTEA)
key_stats    (user_id, key,    ewma_ms, n, error_rate, updated_at)   PK (user_id, key)
bigram_stats (user_id, bigram, ewma_ms, n, error_rate, updated_at)   PK (user_id, bigram)
```

Two design notes:

- **Never store one row per keystroke.** The packed `BYTEA` blob is 900 bytes and you only ever read it whole (for a replay). Row-per-keystroke buys queryability we don't need and costs ~40× the storage.
- **Keep aggregates in real tables, not computed on read.** They're updated once per test and read on every drill generation. Incremental EWMA update is a single `UPDATE`.

**Mirror this schema in the local layer today.** If `idb-keyval` keys are `test:{id}`, `bigram:{pair}`, `key:{char}`, migration becomes a sync script that reads local records and `INSERT`s them — an afternoon, not a rewrite.

---

## 7. Animation strategy

The instinct on a team that likes Framer Motion is to reach for it everywhere. Here that instinct is actively harmful, so the rule is a hard split.

### Zone A — the test surface: CSS only, no JS animation library

Characters and caret. This is the hot path from §4. Motion/Framer Motion runs a JavaScript-driven loop and, in React, `<motion.span>` per character adds a hook, a subscription and a style write to each of ~300 nodes. At 8 keystrokes/second that is a guaranteed frame drop on mid-range laptops.

Everything here is a CSS transition:

```css
.char        { transition: color 60ms linear; }
.char.wrong  { color: var(--error); text-decoration: underline var(--error); }
.caret       { transition: transform 90ms cubic-bezier(0.2, 0, 0, 1); }
```

Color transitions on characters should be **fast (≤80ms) and linear**. A springy character-state change reads as lag, because the user's mental model is that the letter turns red the instant they mistype. Springs are for objects that move; this is feedback.

### Zone B — the shell: Motion (`motion/react`)

Menus, modals, settings panels, the results screen entrance, page transitions, theme swaps. Nothing here happens while the user is typing, so the JS cost is free. Use it properly — `layoutId` for the settings panel, staggered children on the results screen.

Import from `motion/react` (the current package) rather than `framer-motion`; its hybrid engine hands off transform and opacity to the Web Animations API, which keeps those off the main thread.

Spring parameters for the shell — one set, applied consistently:

```ts
const spring   = { type: 'spring', stiffness: 400, damping: 34, mass: 0.9 } // panels
const snappy   = { type: 'spring', stiffness: 620, damping: 38 }            // buttons, toggles
const fadeIn   = { duration: 0.18, ease: [0.2, 0, 0, 1] }                   // results cards
```

### Zone C — the results screen: one orchestrated moment

The results screen is the emotional payoff of the loop and the only place worth spending animation budget. A single staggered sequence — number counts up, then the graph draws left-to-right over ~400ms, then the weakness cards fade in — lands harder than motion sprinkled across the whole app. Draw the graph with a canvas animation in uPlot, not by animating an SVG path.

### Non-negotiable

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

With one exception: the **caret transition stays**, at a reduced 40ms. A caret that teleports is harder to track visually, which is an accessibility regression, not an improvement. Reduced motion means less decorative movement, not less functional feedback.

---

## 8. The learning engine — how people actually get better

This is the part that determines whether the app is used for three weeks or three years.

### 8.1 Why people plateau

The standard failure mode: you open Monkeytype, run `time 30 english`, get 72 WPM, run it again, get 74, run it again, get 71. You are practising the words you're already good at, in the proportion they naturally occur. Your weak transitions appear at their natural frequency — which is to say, rarely — so they never improve. You are rehearsing, not training.

Deliberate practice requires three things this loop doesn't have: a task **just beyond** current ability, **immediate specific feedback**, and **targeted repetition** of what's failing. We can supply all three from data we're already collecting.

### 8.2 The algorithm

**Step 1 — Baseline (cold start).** First 3 tests run plain common-word English and are labelled "calibrating." We need `n ≥ 8` samples per bigram before its EWMA means anything.

**Step 2 — Score weakness.** For each bigram with enough samples:

```ts
const z = (bigram.ewmaMs - userMedianMs) / userStdDevMs
const weakness = Math.max(0, z) * (1 + bigram.errorRate * 2)
```

Normalising against the **user's own** median is the key move. It means we target *your* relative weaknesses rather than the universally-hard bigrams, so the app stays useful as you improve and your bottleneck shifts.

**Step 3 — Score candidate words.**

```ts
score(word) = sum(weakness(bigram) for bigram in word) / (word.length - 1)
```

Dividing by bigram count prevents long words from dominating purely by size.

**Step 4 — Sample, with deliberate dilution.**

```
65% of words sampled with probability ∝ score^1.5
35% sampled from the top-1000 common word list
```

That 35% is not padding. Interleaving beats blocked practice in essentially every motor-learning study — pure drills produce faster in-session gains and worse retention. It also keeps the text reading like English instead of like a phonetics exam, which matters for whether people come back.

**Step 5 — Retire and resample.** When a targeted bigram's EWMA drops below the user's median across 3 consecutive appearances, drop it from the targeting set and pull in the next one. The target list stays at ~15 bigrams, always current, always just past the edge of comfort.

**Step 6 — Gate on accuracy, not speed.** Difficulty only escalates when the last 3 tests cleared 96% accuracy. This is deliberate: an error costs roughly a full second once you count noticing it, backspacing, retyping and re-finding your place. Someone typing at 95% accuracy is losing more time to correction than they'd lose by simply slowing down. Chasing raw WPM at low accuracy is the single most common way people waste months, and the product should refuse to reward it.

### 8.3 The feedback loop in the UI

The algorithm is worthless if the user can't see it working. Three surfaces:

1. **After every test** — "Your slowest transitions: `ol` 310ms · `un` 285ms · `ce` 270ms (your average: 145ms)" with a single button: **Drill these**. One click from insight to action.
2. **Weekly view** — a small chart of which bigrams moved. Visible improvement on a specific, named weakness is far more motivating than a WPM number that wobbles ±4 for reasons you can't attribute.
3. **Progress, honestly framed** — plot the 7-day rolling median, not the personal best. PBs are noise-chasing; the median is the thing that actually moves.

### 8.4 Session design

Push a 10–15 minute session, not an hour. Motor consolidation happens between sessions, during sleep — the fourth consecutive 15-minute block on the same day contributes almost nothing. Daily short sessions beat weekly long ones by a wide margin, so the streak mechanic should reward *days practised*, not minutes accumulated.

Suggested default session: 2 calibration tests → 3 adaptive drills → 1 free test at preferred config. Roughly 12 minutes.

---

## 9. Metric definitions (pin these down before anyone writes code)

Ambiguity here produces numbers that don't match Monkeytype and users who think the app is broken.

| Metric | Definition |
|---|---|
| **Net WPM** | `(correct characters, including correct spaces) / 5 / minutes` |
| **Raw WPM** | `(all characters typed) / 5 / minutes` — the gap between raw and net is the cost of your errors |
| **Accuracy** | `correct keypresses / total keypresses`, measured **at the moment of the keypress**. A corrected mistake still counts against you — it consumed real time |
| **Consistency** | `100 × (1 − σ/μ)` over per-second raw WPM samples. Low consistency means bursty typing, which usually means you're reading ahead unevenly |
| **Bigram latency** | `keydown(n).timeStamp − keydown(n−1).timeStamp`, discarded if either keystroke was wrong or the gap exceeds 1000ms (user paused) |

The word = 5 characters convention is the industry standard and matches every competitor. Don't get creative.

---

## 10. Performance budget and how we verify it

| Budget | Target | How we check |
|---|---|---|
| Keydown → paint | ≤ 8ms p95 | `PerformanceObserver` on `event` entries; report INP |
| Layout recalcs while typing | **0** | DevTools Performance panel — any "Layout" entry during a test is a bug |
| Frame drops at 8 keys/sec | 0 over 60s | Playwright + CDP, synthetic keystroke injection, frame timing capture |
| Initial JS bundle | ≤ 150KB gzip | `rollup-plugin-visualizer` in CI |
| Time to first keystroke accepted | ≤ 400ms | Lighthouse TTI on the `/test` route |

Wire the keystroke-injection test into CI on day one. Latency regressions are invisible in code review and obvious in production, and this app has exactly one thing it cannot afford to get wrong.

---

## 11. Design direction (abbreviated)

The text being typed **is** the interface. Everything else is instrumentation and should recede.

- **Layout** — three lines of words, vertically centred, occupying no more than 60% of viewport width. Lines scroll upward as you complete them; the active line stays put. Nothing else on screen during a test. Config bar fades to 15% opacity on first keystroke and returns on `Esc`.
- **Type** — one variable monospace at 26–30px for the test surface (large enough that peripheral vision picks up the next 4–5 characters, which is how fast typists actually read). A separate condensed face for stats and labels, small and quiet.
- **The caret is the signature element.** It's the only thing that moves during a test, it moves 8 times a second, and it's what the user's eye is locked to. It deserves the design attention: a 2px block with a soft glow in the accent colour, a 90ms eased slide, and a subtle horizontal squash on rapid movement — the visual language of a machine that's keeping up with you.
- **Colour** — three states carry all the meaning: pending (35% foreground), correct (100% foreground), wrong (error colour + underline). Never use colour for decoration on the test surface; it competes with the only signal that matters.

---

## 12. Risks

**The people risk is larger than the technical risk, and it's worth naming directly.**

An engineering manager building a typing app for their reports and tracking the results creates an obvious dynamic, whatever the intent. Three consequences to plan for:

- **Typing speed is rarely an engineer's bottleneck.** Thinking is. Anyone who reads a WPM dashboard as a productivity signal will draw wrong conclusions, and the team will assume that's what it's for.
- **Measured metrics get gamed.** If speed is visible upward, people will run easy configs and stop using the adaptive mode — which is the only part that helps them.
- **It reads as surveillance** unless the design makes it structurally impossible to be one.

Mitigations, all cheap in v1 because there's no backend anyway:

1. **Data stays local and private by default.** No manager view, no leaderboard, no export in v1. This is the default state of the MVP already — keep it deliberate rather than accidental.
2. **Frame it as ergonomics and accuracy, not throughput.** Fewer errors, less backspacing, less strain. That framing is also more honest about where the benefit actually is.
3. **Fully opt-in, and say so out loud.**
4. If team features ever ship, **aggregate-only, opt-in, and never per-person**.

Secondary risks:

| Risk | Mitigation |
|---|---|
| Adaptive engine feels arbitrary early on | Explicit "calibrating — 3 more tests" state; don't hide it |
| Generated text reads as gibberish | The 35% common-word dilution; cap repeats per list; sanity-review output before shipping |
| Novelty wears off in 3 weeks | Weekly weakness-improvement view is the retention mechanic, not streaks |
| RSI from enthusiastic adoption | Session cap suggestion at 20 min; break prompt |
| `QuotaExceededError` in the wild | IndexedDB + packing + 90-day prune (§6.2) |

---

## 13. Roadmap

**Phase 1 — Engine (week 1).** Typing reducer, keystroke capture, metric calculations, word list, full Vitest coverage. No UI beyond a debug view. The engine is the product; build it in isolation where it's easy to test.

**Phase 2 — Surface (week 2).** Test screen, caret, word rendering with `useSyncExternalStore`, config bar, themes. Latency instrumentation and the CI keystroke test land here, not later.

**Phase 3 — Results and persistence (week 3).** Results screen, uPlot graph, IndexedDB layer with packing, history, personal bests.

**Phase 4 — Adaptive engine (week 4).** Bigram aggregation, weakness scoring, weighted generation, drill mode, weakness cards, weekly view.

**Then ship it, use it for a month, and let real data decide phase 5.** The obvious candidates — Postgres sync, team features, quotes, funboxes — should all wait for evidence. Roughly 4 weeks of focused solo work, or 5–6 part-time.

---

## 14. Summary of decisions

| Question | Answer |
|---|---|
| Stack | Vite 6 + React 19 + TypeScript + TanStack Router + Tailwind v4 |
| Framework | **Not** Next.js — no server, and hydration costs us on our primary metric |
| State | Zustand for UI; plain TS reducer for the engine, outside React |
| Local storage | `localStorage` for prefs, **IndexedDB for everything else** — not localStorage alone |
| Database (phase 2) | **Postgres on Neon + Drizzle**; packed `BYTEA` keystroke logs, real tables for aggregates |
| Animation | **Motion (`motion/react`)** for the shell; **CSS transforms only** on the test surface |
| Smoothness | Monospace + arithmetic caret positioning + zero layout during typing + compositor-only animation |
| Learning | Bigram-level adaptive generation, user-relative weakness scoring, accuracy-gated progression |
| Differentiator | Nobody targets transitions. That's the product. |
