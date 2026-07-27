import { useEffect, useRef } from 'react'

import { classifyKey, isBlockedInputType, isCompositionInputType } from '../../engine'
import type { KeyInput } from '../../engine'

import { useTestSurface } from './context'

/**
 * Keystroke capture.
 *
 * A real <input>, not contenteditable, parked off screen with autocomplete,
 * autocorrect, autocapitalize and spellcheck all off so that mobile keyboards
 * and IMEs behave rather than helpfully rewriting what was typed.
 *
 * Every keydown is forwarded to the engine before anything is filtered. Soft
 * keyboards report key 'Unidentified' with keyCode 229, and that keystroke is
 * both the strongest signal a soft keyboard is in use and one the classifier
 * throws away — so detection has to happen on the engine side of the call, not
 * on this one. SPEC 1.7, DECISIONS 1.2.
 */
export function HiddenInput() {
  const { engine } = useTestSurface()
  const ref = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const element = ref.current

    if (element === null) {
      return undefined
    }

    element.focus()

    // Paste, drop, cut and IME composition are blocked at beforeinput, which is
    // the only place a browser will let you refuse them. SPEC 1.5.
    const onBeforeInput = (event: Event): void => {
      const inputType = (event as InputEvent).inputType

      if (isBlockedInputType(inputType) || isCompositionInputType(inputType)) {
        event.preventDefault()
      }
    }

    // Anywhere on the page, any key: come back. The design says "press any key
    // to resume", and the engine resumes the clock on the keystroke itself.
    const onWindowKeyDown = (): void => {
      if (document.activeElement !== element) {
        element.focus()
      }
    }

    element.addEventListener('beforeinput', onBeforeInput)
    window.addEventListener('keydown', onWindowKeyDown)

    return () => {
      element.removeEventListener('beforeinput', onBeforeInput)
      window.removeEventListener('keydown', onWindowKeyDown)
    }
  }, [])

  return (
    <input
      ref={ref}
      className="hidden-input"
      aria-label="Typing input"
      value=""
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      inputMode="text"
      onChange={() => undefined}
      onKeyDown={(event) => {
        const native = event.nativeEvent
        const input: KeyInput = {
          key: native.key,
          code: native.code,
          keyCode: native.keyCode,
          // event.timeStamp is when the browser received the event.
          // performance.now() is when this handler happened to run, which under
          // load is 5 to 30ms of noise in every bigram measurement.
          timeStamp: native.timeStamp,
          repeat: native.repeat,
          ctrlKey: native.ctrlKey,
          metaKey: native.metaKey,
          altKey: native.altKey,
          shiftKey: native.shiftKey,
        }

        engine.input(input)

        // Swallow only what the engine acted on. Tab, browser shortcuts and
        // function keys stay with the browser.
        if (classifyKey(input).kind !== 'ignore') {
          event.preventDefault()
        }
      }}
      onBlur={(event) => {
        engine.pause(event.nativeEvent.timeStamp)
      }}
      onFocus={(event) => {
        engine.resume(event.nativeEvent.timeStamp)
      }}
    />
  )
}
