import type { Keystroke, KeystrokeKind } from '../engine'

/**
 * Keystroke log packing.
 *
 * ARCHITECTURE.md 6.2: a 400 keystroke test is about 12KB as JSON and about
 * 900 bytes packed. Two years of daily use then fits in under 2MB, which is
 * what makes keeping the raw log affordable — and keeping the raw log is what
 * makes every future metric derivable rather than lost.
 *
 * The scheme leans on what is almost always true:
 *
 *   - Timestamps are deltas, and a delta between two keystrokes is under 255ms
 *     for anyone typing at all. One byte each, with an escape to a wider array.
 *   - Kind is carried by the character itself. A typed character is printable,
 *     so a code below 0x20 can only mean missed, backspace or delete-word.
 *   - `ok` is not stored. It is exactly `kind === 'char' && e !== '' && c === e`.
 *   - `e` is not stored when it equals `c`, which is every correct keystroke.
 *   - repeat, extras and pauses are sparse index lists, empty in most tests.
 */

export const PACK_VERSION = 1

const CONTROL_MISSED = 0x01
const CONTROL_BACKSPACE = 0x02
const CONTROL_DELETE_WORD = 0x03

/** Above every control code and below every printable character. */
const FIRST_PRINTABLE = 0x20

/** One byte holds 0 to 254; 255 says "read the next value from `wide`". */
const DELTA_ESCAPE = 0xff
const MAX_INLINE_DELTA = DELTA_ESCAPE - 1

const CONTROL_BY_KIND: Record<Exclude<KeystrokeKind, 'char'>, number> = {
  missed: CONTROL_MISSED,
  backspace: CONTROL_BACKSPACE,
  'delete-word': CONTROL_DELETE_WORD,
}

const KIND_BY_CONTROL: Record<number, KeystrokeKind> = {
  [CONTROL_MISSED]: 'missed',
  [CONTROL_BACKSPACE]: 'backspace',
  [CONTROL_DELETE_WORD]: 'delete-word',
}

export type PackedLog = {
  readonly version: number
  readonly count: number
  /** Milliseconds since the previous entry. 255 escapes to `wide`. */
  readonly deltas: Uint8Array
  /** Deltas that did not fit a byte, in order of their escapes. */
  readonly wide: Int32Array
  /** One unit per entry: the typed character, or a control code. */
  readonly chars: string
  /** Entries whose expected character differs from the typed one. */
  readonly expectedAt: Uint32Array
  readonly expected: string
  /** Character entries typed past the end of a word, which expected nothing. */
  readonly extraAt: Uint32Array
  readonly repeatAt: Uint32Array
  /** Entries at which the pause count went up by one. */
  readonly pauseAt: Uint32Array
}

const EMPTY_INDEX = new Uint32Array(0)

export const EMPTY_PACK: PackedLog = {
  version: PACK_VERSION,
  count: 0,
  deltas: new Uint8Array(0),
  wide: new Int32Array(0),
  chars: '',
  expectedAt: EMPTY_INDEX,
  expected: '',
  extraAt: EMPTY_INDEX,
  repeatAt: EMPTY_INDEX,
  pauseAt: EMPTY_INDEX,
}

function controlFor(entry: Keystroke): number | null {
  return entry.kind === 'char' ? null : CONTROL_BY_KIND[entry.kind]
}

export function packLog(log: readonly Keystroke[]): PackedLog {
  if (log.length === 0) {
    return EMPTY_PACK
  }

  const deltas = new Uint8Array(log.length)
  const wide: number[] = []
  const chars: string[] = []
  const expectedAt: number[] = []
  const expected: string[] = []
  const extraAt: number[] = []
  const repeatAt: number[] = []
  const pauseAt: number[] = []

  let previousT = 0
  let previousPauses = 0

  log.forEach((entry, index) => {
    const delta = entry.t - previousT

    previousT = entry.t

    if (delta >= 0 && delta <= MAX_INLINE_DELTA) {
      deltas[index] = delta
    } else {
      deltas[index] = DELTA_ESCAPE
      wide.push(delta)
    }

    const control = controlFor(entry)

    if (control === null) {
      const code = entry.c.codePointAt(0) ?? 0

      if (code < FIRST_PRINTABLE) {
        throw new Error(
          `Crudu pack: a typed character below U+0020 cannot be encoded (index ${String(index)})`,
        )
      }

      chars.push(entry.c)

      if (entry.e === '') {
        extraAt.push(index)
      } else if (entry.e !== entry.c) {
        expectedAt.push(index)
        expected.push(entry.e)
      }

      if (entry.repeat) {
        repeatAt.push(index)
      }
    } else {
      chars.push(String.fromCharCode(control))

      // A missed entry carries the character the user never typed.
      if (entry.kind === 'missed') {
        expectedAt.push(index)
        expected.push(entry.e)
      }
    }

    if (entry.pauses !== previousPauses) {
      for (let step = previousPauses; step < entry.pauses; step += 1) {
        pauseAt.push(index)
      }

      previousPauses = entry.pauses
    }
  })

  return {
    version: PACK_VERSION,
    count: log.length,
    deltas,
    wide: Int32Array.from(wide),
    chars: chars.join(''),
    expectedAt: Uint32Array.from(expectedAt),
    expected: expected.join(''),
    extraAt: Uint32Array.from(extraAt),
    repeatAt: Uint32Array.from(repeatAt),
    pauseAt: Uint32Array.from(pauseAt),
  }
}

export function unpackLog(packed: PackedLog): Keystroke[] {
  if (packed.version !== PACK_VERSION) {
    throw new Error(
      `Crudu pack: cannot read version ${String(packed.version)}, expected ${String(PACK_VERSION)}`,
    )
  }

  const expectedFor = new Map<number, string>()

  packed.expectedAt.forEach((index, position) => {
    expectedFor.set(index, packed.expected[position] ?? '')
  })

  const extras = new Set(packed.extraAt)
  const repeats = new Set(packed.repeatAt)
  const pauseCounts = new Map<number, number>()

  for (const index of packed.pauseAt) {
    pauseCounts.set(index, (pauseCounts.get(index) ?? 0) + 1)
  }

  const log: Keystroke[] = []
  let t = 0
  let wideAt = 0
  let pauses = 0

  for (let index = 0; index < packed.count; index += 1) {
    const inline = packed.deltas[index] ?? 0

    if (inline === DELTA_ESCAPE) {
      t += packed.wide[wideAt] ?? 0
      wideAt += 1
    } else {
      t += inline
    }

    pauses += pauseCounts.get(index) ?? 0

    const unit = packed.chars.charCodeAt(index)
    const kind = KIND_BY_CONTROL[unit] ?? 'char'

    if (kind === 'char') {
      const c = packed.chars[index] ?? ''
      const e = extras.has(index) ? '' : (expectedFor.get(index) ?? c)

      log.push({
        kind: 'char',
        c,
        e,
        t,
        ok: e !== '' && c === e,
        repeat: repeats.has(index),
        pauses,
      })
      continue
    }

    log.push({
      kind,
      c: '',
      e: kind === 'missed' ? (expectedFor.get(index) ?? '') : '',
      t,
      ok: false,
      repeat: false,
      pauses,
    })
  }

  return log
}

/**
 * Bytes on the wire, counting the string as UTF-8 because that is what it costs
 * once it leaves the heap — in IndexedDB today and in a Postgres bytea later.
 */
export function packedByteLength(packed: PackedLog): number {
  const utf8 = new TextEncoder()

  return (
    packed.deltas.byteLength +
    packed.wide.byteLength +
    utf8.encode(packed.chars).byteLength +
    packed.expectedAt.byteLength +
    utf8.encode(packed.expected).byteLength +
    packed.extraAt.byteLength +
    packed.repeatAt.byteLength +
    packed.pauseAt.byteLength
  )
}
