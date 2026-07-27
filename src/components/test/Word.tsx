import { memo, useCallback, useSyncExternalStore } from 'react'

import { charStates } from '../../engine'

import { useTestSurface } from './context'

/**
 * One word, subscribed to the engine at its own index.
 *
 * This is invariant 8 in code. A keystroke notifies the listener set for one
 * index, so exactly one of these re-renders. Two on a space or on a backspace
 * that crosses a word boundary. The other 290 character nodes on screen are not
 * touched, are not diffed, and do not know anything happened.
 */

type WordProps = {
  readonly index: number
}

export const Word = memo(function Word({ index }: WordProps) {
  const { engine } = useTestSurface()

  const subscribe = useCallback(
    (listener: () => void) => engine.subscribeToWord(index, listener),
    [engine, index],
  )

  const getSnapshot = useCallback(() => engine.getWordSnapshot(index), [engine, index])

  const word = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  if (word === undefined) {
    return null
  }

  const states = charStates(word)

  return (
    <span className="word">
      {states.map((state, position) => (
        // Characters are positional and never reorder, so the index is the identity.
        <span key={position} className="char" data-state={state}>
          {position < word.text.length ? word.text[position] : word.typed[position]}
        </span>
      ))}
    </span>
  )
})
