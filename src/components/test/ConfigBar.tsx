import { useSyncExternalStore } from 'react'

import { TIME_VALUES, WORD_VALUES, activeValue, usePrefsStore } from '../../stores/prefsStore'

import { useTestSurface } from './context'

/**
 * Mode, duration or word count, punctuation, numbers.
 *
 * It fades to nothing on the first keystroke and takes pointer-events with it,
 * so the only thing left on screen while typing is the text.
 */

type ChipProps = {
  readonly label: string
  readonly active: boolean
  readonly onSelect: () => void
}

function Chip({ label, active, onSelect }: ChipProps) {
  return (
    <button
      type="button"
      className="chip"
      data-active={active ? 'true' : 'false'}
      aria-pressed={active}
      onClick={onSelect}
    >
      {label}
    </button>
  )
}

function Divider() {
  return <span className="config-divider" aria-hidden="true" />
}

export function ConfigBar() {
  const { engine } = useTestSurface()
  const prefs = usePrefsStore()
  const status = useSyncExternalStore(
    engine.subscribeToStatus,
    engine.getStatusSnapshot,
    engine.getStatusSnapshot,
  )

  const active = status.status === 'running'
  const values = prefs.mode === 'time' ? TIME_VALUES : WORD_VALUES

  return (
    <div className="config-bar" data-hidden={active ? 'true' : 'false'}>
      <div className="config-group">
        <Chip
          label="time"
          active={prefs.mode === 'time'}
          onSelect={() => {
            prefs.setMode('time')
          }}
        />
        <Chip
          label="words"
          active={prefs.mode === 'words'}
          onSelect={() => {
            prefs.setMode('words')
          }}
        />
      </div>

      <Divider />

      <div className="config-group">
        {values.map((value) => (
          <Chip
            key={value}
            label={String(value)}
            active={activeValue(prefs) === value}
            onSelect={() => {
              prefs.setValue(value)
            }}
          />
        ))}
      </div>

      <Divider />

      <div className="config-group">
        <Chip
          label="punctuation"
          active={prefs.punctuation}
          onSelect={prefs.togglePunctuation}
        />
        <Chip label="numbers" active={prefs.numbers} onSelect={prefs.toggleNumbers} />
      </div>
    </div>
  )
}
