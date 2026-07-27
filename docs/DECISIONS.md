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
