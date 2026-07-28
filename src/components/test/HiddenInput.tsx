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
const INTERACTIVE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function isInteractive(node: Element | null): boolean {
  return node !== null && node.matches(INTERACTIVE)
}

/**
 * Keys that belong to whatever control has focus rather than to the test.
 *
 * The distinction is the key, not the focus. Clicking a config chip with the
 * mouse leaves focus on the chip, and the next letter typed has to come back to
 * the test — that is the whole "press any key to resume" behaviour. But Enter on
 * a focused button is meant for the button.
 */
const CONTROL_KEYS = new Set(['Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

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
    //
    // With two exceptions, both of which were trapping the keyboard. Tab is
    // navigation, not typing: pulling focus back on it meant focus left the
    // input and the next Tab dragged it straight home, so no control in the app
    // was reachable from the keyboard at all. And Enter on a button someone has
    // deliberately tabbed to belongs to that button, which is why Tab then Enter
    // on the restart control used to refocus the input and leave the test
    // running rather than restarting it.
    const onWindowKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Tab' || document.activeElement === element) {
        return
      }

      if (isInteractive(document.activeElement) && CONTROL_KEYS.has(event.key)) {
        return
      }

      element.focus()
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
