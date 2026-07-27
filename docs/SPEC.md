# SPEC.md

Engine behaviour. Every edge case resolved.

This is the contract for `src/engine/`. It is written before the code and the
code is written to it. Later batches read this file rather than reading the
implementation, so where the brief left something open, the resolution is stated
here rather than discovered by reading a reducer.

Rules 1 to 7 are reproduced verbatim from the phase 1 brief. Everything under a
**Resolved** heading is a decision the brief did not make, taken here and
recorded in `docs/DECISIONS.md` with its reasoning.

---

## 0 State machine

```
idle ──first accepted character──> running ──blur──> paused
                                     │  ▲              │
                                     │  └──focus───────┘
                                     │
                                     └──time expiry or final character──> complete
```

**Resolved.**

- `idle` accepts input. The first accepted **character** keystroke moves the
  test to `running` and becomes `t = 0`. A leading space, a modifier, a
  backspace or an ignored key does not start the test.
- `pause` from `idle` is a no-op. There is nothing to pause and no clock to stop.
- `resume` from any state other than `paused` is a no-op.
- `complete` is terminal. Every input, pause and resume is ignored. Only `reset`
  leaves it.
- `reset` returns to `idle` with a fresh word list and an empty keystroke log.

---

## 1 Input

> - Accept printable characters, space, backspace, ctrl/cmd+backspace.
> - Ignore modifier-only keys. Do not log them.
> - Ignore a leading space at the start of a word. No-op, not an error.
> - Block paste entirely.
> - Ignore IME composition events. Guard with beforeinput inputType checks.
> - Held keys arriving with `event.repeat` true still count as characters, but
>   are excluded from bigram latency data. A held key produces meaningless
>   latency.
> - Detect virtual keyboards: a keydown with an empty `code`, or keyCode 229,
>   indicates a soft keyboard or IME.
> - Tests taken on a virtual keyboard are tagged `inputSource: 'virtual'` and are
>   EXCLUDED from bigram aggregation entirely.
> - They still record WPM, accuracy and history normally.
> - Reason: thumb-typing latency does not describe touch-typing weakness.
>   Feeding it into the bigram table would corrupt the adaptive model, which is
>   the product's differentiator.

### 1.1 The engine never sees a DOM event

The caller passes a plain object. The engine has no `KeyboardEvent`, no
`window`, no `document`, and never calls `performance.now()`.

```ts
type KeyInput = {
  key: string        // KeyboardEvent.key
  code: string       // KeyboardEvent.code — '' on most soft keyboards
  keyCode: number    // KeyboardEvent.keyCode — 229 during composition
  timeStamp: number  // KeyboardEvent.timeStamp, never performance.now()
  repeat: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}
```

### 1.2 What counts as a printable character

**Resolved.** `key.length === 1`. That is the whole test. It admits letters,
digits, punctuation and space, and rejects `Backspace`, `Tab`, `Enter`,
`Escape`, `ArrowLeft`, `F1`, `Shift`, `Control`, `Alt`, `Meta`, `CapsLock` and
every other named key, because all of them report a `key` longer than one
character.

Modifier-only keys therefore need no list of their own. They are rejected by the
same test that rejects `Tab`, and they are not logged.

### 1.3 Modifier combinations

**Resolved.**

| Combination | Treatment |
|---|---|
| `Ctrl` or `Meta` + a character | Ignored. It is a browser or OS shortcut, not typing |
| `Ctrl` + `Alt` + a character | Accepted. This is AltGr on Windows, which produces real characters |
| `Alt` + a character | Accepted. AltGr on some layouts, an accented character on macOS |
| `Shift` + a character | Accepted. `key` already carries the shifted character |
| `Ctrl` or `Meta` + `Backspace` | Accepted as delete-word |
| `Alt` + `Backspace` | Accepted as delete-word. It is the macOS binding |

### 1.4 Leading space

A space pressed when the current word has nothing typed in it is discarded
entirely: no state change, no log entry, no effect on accuracy, and it does not
start the test.

### 1.5 Paste, drop and composition

The engine exposes predicates rather than handling events, because it has no
DOM. The test surface calls them from `beforeinput` and calls
`preventDefault()` when they return true.

```ts
isBlockedInputType(inputType: string): boolean
```

Returns true for, and the surface must block:

`insertFromPaste`, `insertFromPasteAsQuotation`, `insertFromDrop`,
`insertFromYank`, `insertReplacementText`, `insertTranspose`, `insertLink`,
`deleteByCut`, `deleteByDrag`.

```ts
isCompositionInputType(inputType: string): boolean
```

Returns true for `insertCompositionText` and `deleteCompositionText`. The
surface ignores those events; the composed text arrives later as ordinary
keydowns.

### 1.6 Held keys

A keystroke with `repeat: true` is a real character. It advances the word,
counts toward raw WPM, and counts toward accuracy exactly like any other. It is
recorded with `repeat: true` and is excluded from bigram latency on both sides
of the pair.

### 1.7 Virtual keyboards

**Detection.** A keystroke is virtual when `code === ''` **or**
`keyCode === 229`.

**Resolved — the tag is sticky and applies to the whole test.** The brief tags
*tests*, not keystrokes. One virtual keystroke sets `inputSource: 'virtual'` for
the remainder of the test and it never reverts. A test that begins on a laptop
keyboard and continues on a phone keyboard has bigram data drawn from two
different motor tasks, and there is no way to tell afterwards which pairs came
from which.

**Consequence.** `bigrams()` returns an empty array for a virtual test. Nothing
enters the bigram table. WPM, raw WPM, accuracy, consistency, the keystroke log
and the history entry are all recorded exactly as for a physical test.

---

## 2 Word boundaries

> - Space with the current word incomplete: advance to the next word and mark the
>   remaining characters missed.
> - Missed characters count against accuracy. They do not count toward raw WPM,
>   because the user never typed them.
> - Characters typed beyond a word's length are "extra", capped at
>   `word.length + 10`. Input beyond the cap is discarded silently.

### 2.1 Character states

A word holds its expected `text` and the `typed` string. Per-character state is
derived, never stored:

| Condition | State |
|---|---|
| `i >= text.length` | `extra` |
| `i >= typed.length` and the word was advanced past | `missed` |
| `i >= typed.length` and the word was not advanced past | `pending` |
| `typed[i] === text[i]` | `correct` |
| otherwise | `incorrect` |

### 2.2 Missed characters are logged

**Resolved.** When space advances a word with `typed.length < text.length`, one
log entry of kind `missed` is appended per remaining character, carrying the
expected character and the timestamp of the space that caused it.

They are logged rather than derived from final state because accuracy is
"measured at the moment of the keypress". If the user backspaces into the word
and advances past it incomplete a second time, that is a second cost and a
second batch of entries. Deriving from final state would forgive the first.

### 2.3 The extra-character cap

`typed.length` may reach `text.length + 10`. A character arriving when
`typed.length` is already at the cap changes nothing: no state change, no log
entry, no effect on any metric. Silently is the operative word — it does not
count as an error.

### 2.4 Is the space itself correct?

**Resolved.** A space that advances a word is a logged character keystroke with
expected character `' '`. It is `ok` only when the word it terminates was typed
exactly — `typed === text`. Any incomplete word, any incorrect character and any
extra character makes the terminating space incorrect.

This is what "correct spaces" in the net WPM definition refers to. The
alternative, counting every boundary space as correct, would let a test typed
entirely wrong still earn one fifth of its net WPM from spaces.

---

## 3 Backspace

> - Within the current word: always allowed.
> - Into a previously completed word: allowed only if that word contains at least
>   one error. Correct words are locked. This is the default and it matches
>   Monkeytype.
> - `ctrl/cmd+backspace` deletes to the start of the current word. If already at
>   the start, it deletes the previous word subject to the same lock.

### 3.1 What "contains at least one error" means

**Resolved.** A completed word is clean when `typed === text`, character for
character. Anything else — an incorrect character, an extra character, or a
missed character left behind by an early space — makes it dirty and unlocks it.

### 3.2 Landing position

Backspacing into a previous word makes it active again with its typed content
intact, and the caret lands after the last typed character. The word's `missed`
characters revert to `pending`, because it is no longer a word that was advanced
past. The log entries those missed characters produced are not removed: they
already cost the user time.

### 3.3 Delete word

- Current word has typed characters: `typed` becomes `''`. The word index does
  not move.
- Current word is empty and the previous word is dirty: move back to it and set
  its `typed` to `''`.
- Current word is empty and the previous word is clean, or there is no previous
  word: no-op.

### 3.4 No-ops are not logged

**Resolved.** A backspace at the start of the first word, or against a locked
clean word, changes nothing and produces no log entry. Only a backspace that
removed something is logged. Logging no-ops would put entries in the log that no
replay could act on and that no metric may count.

### 3.5 Backspace and accuracy

Backspaces are logged with kind `backspace` or `delete-word`. They are excluded
from accuracy, from net WPM and from raw WPM, and they break a bigram pair. A
corrected error still counts against accuracy, because the entry that recorded it
is still in the log.

---

## 4 Test end

> - time mode: ends on the timestamp, mid-word if necessary. Characters typed in
>   the partial word count as correct or incorrect normally. Untyped characters
>   of that word are neither.
> - words mode: ends on the final character of the final word. No trailing space
>   required.
> - time mode generates words lazily in chunks of 50, appending as the user
>   approaches the end. Never generate an unbounded list up front.

### 4.1 Time mode

The engine does not own a clock. The caller drives expiry by calling
`tick(timeStamp)`, and any `input`, `pause` or `resume` also checks expiry
against its own timestamp.

The test completes at the first timestamp for which
`elapsed >= config.value * 1000`. Elapsed excludes paused spans.

**Resolved — a keystroke that arrives at or after expiry is not accepted.** It
is discarded before it can change any word, and the test completes. Accepting it
would let a keystroke at 30.4s count toward a 30s test.

The word the user was in stays `active`. Its untyped characters are `pending`,
never `missed`: they are neither correct nor incorrect and they enter no metric.

### 4.2 Words mode

The test completes on the character that finishes the final word, at the moment
`wordIndex === words.length - 1` and `typed === text` for that word. No trailing
space is required, and no trailing space is possible — the test is already
`complete`.

**Resolved — an incorrect final character does not end the test.** The user can
backspace and fix it. The test ends only when the last word is exactly right, or
when the user presses space on the last word, which advances past it and
completes with whatever was typed.

### 4.3 Lazy word generation

Words mode requests exactly `config.value` words once, at reset.

Time mode requests one chunk of 50 at reset, then requests another 50 whenever
fewer than 50 words remain ahead of the cursor. The engine never holds an
unbounded list, and a 15 second test does no more generation work before the
first keystroke than a 120 second one.

**Resolved — generation is not the reducer's job.** The reducer is pure and
takes words as data. The engine wrapper owns the word source, notices the low
water mark after each reduction, and dispatches an `appendWords` action. This
keeps the reducer testable with a fixed array and lets phase 4 substitute the
adaptive generator without touching it.

---

## 5 Timing

> - Every keystroke stores `event.timeStamp`, passed in by the caller. The engine
>   never calls `performance.now()` itself. This keeps it pure and testable with
>   synthetic timestamps.
> - Blur pauses. Elapsed time excludes paused spans.
> - A gap over 1000ms between keystrokes is excluded from bigram latency and from
>   consistency sampling. The user paused, they did not slow down.

### 5.1 The time origin

`t = 0` is the timestamp of the first accepted character keystroke. Every logged
entry carries `t` in milliseconds from that origin, with paused spans already
subtracted. The log is therefore in test time, not wall-clock time, and needs no
further correction to be replayed.

### 5.2 Pausing

`pause(timeStamp)` from `running` records the pause start. `resume(timeStamp)`
adds `timeStamp - pauseStart` to the accumulated paused total and returns to
`running`.

**Resolved — a bigram pair that spans a pause is discarded.** Paused time is
subtracted from `t`, so a keystroke before a two-minute blur and the one after it
can appear 30ms apart. Every logged entry records the pause count at the time it
was made; a pair whose two entries disagree is not a transition the user
performed and is dropped.

### 5.3 Non-monotonic timestamps

**Resolved.** A timestamp earlier than the previous one is clamped so that `t`
never decreases. Browsers do not normally deliver these, but a synthetic test can,
and a negative elapsed value would poison every metric downstream.

---

## 6 Metrics

> - net WPM = correct characters including correct spaces / 5 / minutes
> - raw WPM = all characters typed / 5 / minutes
> - accuracy = correct keypresses / total keypresses, measured at the moment of
>   the keypress. A corrected error still counts against you, because it cost
>   real time.
> - consistency = 100 * (1 - stddev/mean) over per-second raw WPM samples
> - bigram latency = keydown(n).timeStamp − keydown(n−1).timeStamp, discarded if
>   either keystroke was wrong, if the gap exceeds 1000ms, or if either was a
>   repeat

### 6.1 The log is the only input

Every metric is computed from the keystroke log and one duration. No metric reads
word state. Each entry has a kind:

| Kind | Net WPM | Raw WPM | Accuracy | Bigrams |
|---|---|---|---|---|
| `char` | when `ok` | always | numerator when `ok`, always in the denominator | yes |
| `missed` | no | no | denominator only | no |
| `backspace` | no | no | no | breaks the pair |
| `delete-word` | no | no | no | breaks the pair |

### 6.2 Duration

| Mode | Duration |
|---|---|
| time | `config.value * 1000`, exactly, whatever the last timestamp was |
| words | `t` of the last logged entry, which is when the test completed |

A duration of zero produces zero for every WPM figure rather than a division by
zero. A one-character words test is not a measurement.

### 6.3 Character counts

```
correct   = entries with kind 'char' and ok
incorrect = entries with kind 'char', not ok, where an expected character existed
extra     = entries with kind 'char', not ok, where no expected character existed
missed    = entries with kind 'missed'

net WPM  = correct / 5 / minutes
raw WPM  = (correct + incorrect + extra) / 5 / minutes
accuracy = correct / (correct + incorrect + extra + missed) * 100
```

Accuracy with no keypresses at all is 100. Nothing was got wrong.

### 6.4 Consistency

**Resolved.** The timeline is divided into 1000ms buckets from `t = 0`. A bucket
is sampled when it contains at least one `char` entry and is not overlapped by an
inter-keystroke gap longer than 1000ms. The sample value is
`charsInBucket / 5 * 60`, which is raw WPM for that second.

```
consistency = clamp(100 * (1 - populationStdDev / mean), 0, 100)
```

Population standard deviation, not sample: these are all the seconds there were,
not a sample drawn from a larger set. Fewer than two samples gives 100, because
a single second has no variance to measure. The result is clamped at 0 so a very
bursty test cannot report a negative figure.

**Known approximation.** The final bucket of a test is usually a partial second
and is counted whole, which flatters a burst at the end. This matches Monkeytype
and is left alone rather than corrected into something no competitor reports.

### 6.5 Bigram latency

A pair is formed from two entries **adjacent in the log**. Anything between them
— a backspace, a delete-word, a missed batch — means there is no pair.

A pair is discarded when any of these hold:

- either entry is not kind `char`
- either entry is not `ok`
- either entry has `repeat: true`
- the gap exceeds 1000ms
- the two entries have different pause counts, meaning the pair spans a pause
- the test is tagged `inputSource: 'virtual'`

The pair is labelled by the two typed characters. Because both must be `ok`,
typed and expected are identical, so the label is unambiguous. Space is a
character like any other: `e ` and ` t` are real transitions and are recorded.

---

## 7 Subscription API

> Expose a `subscribe(listener)` that reports which word indices are dirty.
> Design it so `useSyncExternalStore` can subscribe per word. Do not emit a
> whole-state change on every keystroke.

### 7.1 Three channels

```ts
subscribe(listener: (change: EngineChange) => void): () => void
subscribeToWord(index: number, listener: () => void): () => void
subscribeToStatus(listener: () => void): () => void
```

`EngineChange` carries `dirtyWords: readonly number[]` and
`statusChanged: boolean`.

`subscribeToWord` and `getWordSnapshot` are the pair `useSyncExternalStore`
consumes. `subscribeToStatus` and `getStatusSnapshot` are the pair the counter
consumes, so the remaining-time display re-renders without touching a word.

### 7.2 Snapshot identity

`getWordSnapshot(i)` returns the same object on every call until word `i`
actually changes. `useSyncExternalStore` compares snapshots by identity and will
loop forever if a new object is returned each time.

The reducer therefore replaces only the word objects it changed and copies the
rest by reference.

### 7.3 Dispatch is proportional to the change, not to the list

A keystroke marks exactly one word dirty. A backspace crossing a word boundary
marks two. A reset marks all of them. The engine keeps a listener set per index
and calls only the sets for dirty indices, so a keystroke in a 500 word time test
costs one lookup and one call.

`statusChanged` is true only when the status, the elapsed second, or the
remaining word count changed. It is false for an ordinary keystroke inside a
word.

---

## 8 The result

`getResult()` returns `null` until the test is `complete`, then:

```ts
type TestResult = {
  id: string
  startedAt: number
  config: TestConfig
  inputSource: 'physical' | 'virtual'
  keystrokes: Keystroke[]
  derived: {
    wpm: number
    raw: number
    accuracy: number
    consistency: number
    chars: { correct: number; incorrect: number; extra: number; missed: number }
  }
}
```

`keystrokes` is the source of truth and everything in `derived` is recomputable
from it. `derived` is cached so a history view does not recompute on scroll.

**Resolved — `id` and `startedAt` come from the caller.** The engine cannot
generate them: `crypto.randomUUID()` and `Date.now()` are both impure and both
would make the engine untestable with fixed values. `reset()` takes them.
