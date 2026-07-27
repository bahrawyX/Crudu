# CLAUDE.md

Read this fully at the start of every session. It overrides habit.

## Project

Adaptive typing trainer. Client only, no backend. The product measures typing precisely, finds the key transitions that slow the user down, and drills them.

Reference documents in `docs/`:
- `ARCHITECTURE.md` - why every technical decision was made
- `SPEC.md` - engine behaviour, every edge case resolved
- `DESIGN.md` - visual system, tokens, screens, copy

When this file and a reference document disagree, this file wins. When the design brief and this file disagree on anything performance related, this file wins.

---

## Invariants

Nine rules. Breaking any of them is a bug even if the code works.

1. **The typing engine never imports React.** It is a pure TypeScript reducer in `src/engine/`. React subscribes to it via `useSyncExternalStore`. If you find yourself importing a hook into `src/engine/`, stop.

2. **No JavaScript animation library on the test surface.** No `motion`, no `framer-motion`, no GSAP inside `src/components/test/`. Characters and caret animate with CSS transitions only. Motion is allowed everywhere else.

3. **Zero layout reads during a test.** No `getBoundingClientRect`, no `offsetWidth`, no `getComputedStyle` in any code path that runs on keystroke. Caret position is arithmetic: `column * charWidth`, `line * lineHeight`. Character width is measured once on font load and cached.

4. **The caret moves by `transform: translate3d` only.** Never `left`, `top`, `margin`, or `width`. Same for the trace line, which uses `scaleX`.

5. **Timing uses `event.timeStamp`, never `performance.now()` inside the handler.** `timeStamp` is when the browser received the event. `performance.now()` is when the handler happened to run, which adds 5 to 30ms of scheduling noise to every measurement and corrupts the adaptive engine's data.

6. **Never write to storage during a test.** `localStorage` is synchronous and blocks the main thread. Keystrokes buffer in memory and persist once, after the results screen has painted.

7. **`localStorage` holds preferences only.** Test history, keystroke logs and bigram tables live in IndexedDB via `idb-keyval`. localStorage caps at 5MB and throws mid-write when full.

8. **A keystroke re-renders one `<Word>`, never the tree.** Two on a backspace crossing a word boundary. If a change makes the whole word list re-render, it is wrong regardless of how it looks.

9. **Colour is never the only signal.** Wrong characters carry a 2px underline as well as the error colour. Accent and error sit at similar luminance by design.

---

## Git protocol

The history is the point. It must be readable and rollback-safe.

### Branches

One branch per phase, named `phase/N-slug`, for example `phase/1-engine`. Merge to `main` with `--no-ff` at phase end, then tag.

### Commit granularity

One commit per logical unit of work, not one per phase and not one per file. A commit should be revertable on its own. Roughly: a new module, a behaviour change, a bug fix, a test suite for one module.

**Commit before starting any refactor that touches more than three files.** A cheap checkpoint is worth more than a tidy history.

### Message format

Conventional commits, with a mandatory body.

```
<type>(<scope>): <subject, imperative, under 60 chars>

What:
- concrete changes, one bullet each

Why:
- the reason, citing SPEC or ARCHITECTURE section where relevant

Verified:
- what you ran and what it reported
```

Types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`, `style`.
Scopes: `engine`, `metrics`, `storage`, `adaptive`, `test-surface`, `results`, `progress`, `ui`, `perf`, `setup`.

Example:

```
feat(engine): handle space pressed mid-word

What:
- Space before a word is complete advances to the next word
- Remaining characters are marked missed
- Missed characters count against accuracy, not against raw WPM

Why:
- SPEC.md 2.3. Matches Monkeytype so users do not perceive a bug.

Verified:
- 6 new cases in engine/reducer.test.ts
- pnpm test: 41 passed, 0 failed
```

`Verified:` is not optional. If nothing was run, write `Verified: not yet covered by tests` so the gap is visible in the log rather than implied.

### Push

Push after every commit. Never batch pushes at end of session.

### Tags

At each phase merge, tag `v0.N.0-<slug>` with an annotated message summarising what now works and what does not. These are the rollback points.

### Never

- Never `git push --force` to `main`.
- Never amend a pushed commit.
- Never commit `node_modules`, `.env`, or `dist`.
- Never commit with a subject like "updates", "wip", "fixes" or "changes".

---

## Working agreement

- **Stop at the end of each batch and report.** Do not roll into the next phase because the code compiles. Report what was built, what was verified, what you had to decide that the spec did not cover, and what you are uncertain about.
- **When the spec is ambiguous, ask.** Do not pick silently. If you must proceed, record the decision in `docs/DECISIONS.md` with the reasoning.
- **Never leave placeholder comments.** No `// TODO: implement`, no `// ... rest of the logic`. If a batch is too large to finish, finish fewer things completely and say so.
- **Run the tests before committing.** Not after.

---

## Stack

Vite 6, React 19, TypeScript strict, TanStack Router, Tailwind v4, Zustand (UI state only), idb-keyval, uPlot, motion/react (shell only), Vitest, Playwright.

Do not add a dependency without saying why in the commit body. Do not add a UI component library.

## File tree

```
src/
  engine/       types.ts reducer.ts metrics.ts keystrokes.ts engine.ts index.ts  # no React
  adaptive/     bigrams.ts weakness.ts generator.ts
  storage/      prefs.ts db.ts pack.ts schema.ts
  words/        en-1000.json en-5000.json
  perf/         latency.ts
  stores/       prefsStore.ts uiStore.ts
  components/   test/ results/ progress/ ui/
  routes/
  styles/       tokens.css themes.css
tests/          engine/ adaptive/ storage/
e2e/            latency.spec.ts
docs/           ARCHITECTURE.md SPEC.md DESIGN.md DECISIONS.md design-prototype.html
```

`engine.ts` is the only file in `src/engine/` that holds mutable state: the
subscription sets, the word source and the cached result. Everything around it
is pure, and keeping the mutation in one named file is what makes that visible.

`docs/design-prototype.html` is the Claude Design output, imported verbatim.
`docs/DESIGN.md` documents it. The prototype is authoritative on what the design
is; DESIGN.md is authoritative on what it means and is the one later batches read.
