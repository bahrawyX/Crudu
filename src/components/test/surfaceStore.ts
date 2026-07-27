import type { Engine, EngineChange } from '../../engine'

import type { SurfaceLayout } from './layout'
import { caretColumn, caretLine, layoutWords, renderedLength, scrollRowFor } from './layout'

/**
 * Everything the surface needs to paint, derived from the engine and kept off
 * React's render path.
 *
 * Three channels, deliberately separate:
 *
 *   caret   fires on almost every keystroke. The caret and the trace subscribe
 *           and write transforms straight to their elements.
 *   line    fires only when the caret changes line. The line list subscribes so
 *           it can mount the next row of words, roughly once every ten words.
 *   layout  fires only when a word's rendered width changes, which in ordinary
 *           typing is never.
 *
 * Nothing here reads the DOM. Line breaking is computed, not observed.
 */

export type CaretPosition = {
  readonly column: number
  readonly line: number
  readonly scrollRow: number
}

export type SurfaceStore = {
  readonly getLayout: () => SurfaceLayout
  readonly getCaret: () => CaretPosition
  /** A primitive, so useSyncExternalStore compares by value and never loops. */
  readonly getLine: () => number
  readonly getWordCount: () => number
  readonly subscribeToLayout: (listener: () => void) => () => void
  readonly subscribeToCaret: (listener: () => void) => () => void
  readonly subscribeToLine: (listener: () => void) => () => void
  /**
   * Attaches to the engine and returns the detach function.
   *
   * Construction deliberately does not subscribe. React renders components
   * twice in development, so a store that attached in its constructor would
   * leave one orphaned subscription per mount with nothing holding a reference
   * to detach it.
   */
  readonly start: () => () => void
}

const ORIGIN: CaretPosition = { column: 0, line: 0, scrollRow: 0 }

export function createSurfaceStore(engine: Engine, capacity: number): SurfaceStore {
  let lengths: number[] = []
  let layout = layoutWords(lengths, capacity)
  let caret = ORIGIN
  let wordCount = 0

  const layoutListeners = new Set<() => void>()
  const caretListeners = new Set<() => void>()
  const lineListeners = new Set<() => void>()

  function notify(listeners: ReadonlySet<() => void>): void {
    for (const listener of listeners) {
      listener()
    }
  }

  function rebuildLengths(): void {
    lengths = engine.getState().words.map((word) => renderedLength(word.text, word.typed))
  }

  function refreshCaret(): void {
    const state = engine.getState()
    const typed = state.words[state.wordIndex]?.typed.length ?? 0
    const line = caretLine(layout, state.wordIndex)
    const next: CaretPosition = {
      column: caretColumn(layout, state.wordIndex, typed),
      line,
      scrollRow: scrollRowFor(line),
    }

    if (next.column === caret.column && next.line === caret.line) {
      return
    }

    const lineChanged = next.line !== caret.line || next.scrollRow !== caret.scrollRow

    caret = next
    notify(caretListeners)

    if (lineChanged) {
      notify(lineListeners)
    }
  }

  function onChange(change: EngineChange): void {
    const state = engine.getState()
    let layoutChanged = false

    if (state.words.length !== wordCount) {
      wordCount = state.words.length
      rebuildLengths()
      layoutChanged = true
    } else {
      // The common case: one dirty word, and its width almost never moves,
      // because a word only widens once the user types past the end of it.
      for (const index of change.dirtyWords) {
        const word = state.words[index]

        if (word === undefined) {
          continue
        }

        const length = renderedLength(word.text, word.typed)

        if (lengths[index] !== length) {
          lengths[index] = length
          layoutChanged = true
        }
      }
    }

    if (layoutChanged) {
      layout = layoutWords(lengths, capacity)
      notify(layoutListeners)
    }

    refreshCaret()
  }

  function prime(): void {
    wordCount = engine.getState().words.length
    rebuildLengths()
    layout = layoutWords(lengths, capacity)
    refreshCaret()
  }

  prime()

  return {
    getLayout: () => layout,
    getCaret: () => caret,
    getLine: () => caret.line,
    getWordCount: () => wordCount,
    subscribeToLayout: (listener) => {
      layoutListeners.add(listener)

      return () => {
        layoutListeners.delete(listener)
      }
    },
    subscribeToCaret: (listener) => {
      caretListeners.add(listener)

      return () => {
        caretListeners.delete(listener)
      }
    },
    subscribeToLine: (listener) => {
      lineListeners.add(listener)

      return () => {
        lineListeners.delete(listener)
      }
    },
    start: () => {
      // Re-prime: the engine may have moved between construction and commit.
      prime()

      const unsubscribe = engine.subscribe(onChange)

      return () => {
        unsubscribe()
      }
    },
  }
}
