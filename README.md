# Crudu

An adaptive typing trainer. Client only, no backend. It measures typing
precisely, finds the key transitions that slow you down, and drills those.

## Setup

```bash
pnpm install
pnpm dev
```

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server |
| `pnpm build` | Production build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint, `--max-warnings 0` |
| `pnpm test` | Vitest with coverage |
| `pnpm e2e` | Playwright against the built bundle |
| `pnpm words` | Regenerate the word lists from upstream |

## What it is

Monkeytype does not make you faster. It tells you, precisely, how fast you are.
People plateau on it because repeating a test you are already good at is
assessment, not practice. Keybr does make people faster, but its method —
progressive letter unlocking, pseudo-words — is built for someone learning the
keyboard from zero.

At 30 WPM your bottleneck is finding keys. At 70 WPM every key is already
automatic and what costs you time is the *movement between* keys: same-finger
bigrams like `ol` and `ed`, rolls against the grain, awkward reaches. A
per-letter model cannot see any of that, because the cost is in the pair.

So the product is Monkeytype's ergonomics wired to a Keybr-class engine, with
the engine tuned for people who already touch-type — which means it targets
transitions, not letters. Nobody else does this. That is the whole product.

## Architecture

```
src/
  engine/       the typing engine. No React, no DOM, no clock
  adaptive/     EWMA aggregation, weakness scoring, weighted generation
  storage/      packing, IndexedDB, preferences, history
  components/   test/ results/ progress/ ui/
  perf/         the latency budget and the observer that reports against it
  words/        generated word lists and the plain sampler
docs/           ARCHITECTURE.md SPEC.md DESIGN.md DECISIONS.md
```

Four documents govern the code. `ARCHITECTURE.md` says why every technical
decision was made. `SPEC.md` is the engine contract, every edge case resolved,
and it was written before the engine. `DESIGN.md` documents the visual system.
`DECISIONS.md` records everything the specs left open, with the reasoning —
read it before changing a number.

## Why the engine sits outside React

**Do not "fix" this.** The engine in `src/engine/` is a plain TypeScript reducer
with no React import, and that is load-bearing.

A typing app is judged almost entirely on the delay between keydown and the
pixel changing. Users cannot articulate it but they feel 40ms, and they call a
laggy typing app "bad" without knowing why. The budget is one frame: 16.7ms at
60Hz, and under 8ms of main-thread work per keystroke.

At 100 WPM that is eight keystrokes a second, every one of them through the
render path. If a keystroke re-renders 300 character nodes and then measures a
rect to place the caret, the budget is gone and the app feels mushy.

So:

- The engine is a reducer over an immutable state object. React subscribes via
  `useSyncExternalStore` **at word granularity**, so a keystroke re-renders one
  `<Word>`, two on a backspace crossing a boundary — never the tree.
- Line breaking is computed in TypeScript, not by CSS, so a character's column
  is the number of characters before it and the caret is `column * charWidth`.
  Nothing measures the DOM during a test.
- The caret and the trace write `element.style.transform` directly. `transform`
  and `opacity` are the only two properties the browser can animate off the main
  thread.
- Timing uses `event.timeStamp`, never `performance.now()` inside the handler.
  `timeStamp` is when the browser received the event; `performance.now()` is when
  the handler happened to run, which under load is 5 to 30ms of noise in every
  bigram measurement.

Measured on a 30 second typing run: **zero Layout entries** in a
`devtools.timeline` trace beyond the lines that mount, and handler time of
**0.2ms p50, 0.6ms p95, 1.4ms p99** against an 8ms budget.

The nine invariants in `CLAUDE.md` encode all of this. Three of them are
enforced by ESLint as build failures and again by
`tests/engine/invariants.test.ts`, which walks the source tree — because a lint
`files` glob can be edited to stop covering a directory and nothing would fail.

## Testing

485 unit tests. `src/engine/**` is held at 100% statements, branches, functions
and lines by a vitest threshold; it is pure functions with no I/O, so there is
no excuse for an untested branch.

`e2e/views.spec.ts` renders every screen in both themes at 1440 and 375 and
asserts that nothing overflows the viewport, that the painted theme is the one
requested, and that everything named is on screen with a size. It exists because
four separate batches shipped a defect no unit test could see, and it has found
one on every run since.
