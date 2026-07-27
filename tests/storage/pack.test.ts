import { describe, expect, it } from 'vitest'

import type { Keystroke } from '../../src/engine'
import { EMPTY_PACK, PACK_VERSION, packLog, packedByteLength, unpackLog } from '../../src/storage/pack'

/**
 * ARCHITECTURE.md 6.2. The raw log is the source of truth, so packing it has to
 * be lossless; keeping it is only affordable because packing makes it small.
 */

const PRINTABLE = 'abcdefghijklmnopqrstuvwxyz .,'

function mulberry32(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d_2b_79_f5) | 0

    let t = Math.imul(state ^ (state >>> 15), 1 | state)

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t

    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

/** A test-shaped log: mostly correct characters, some errors, a few edits. */
function syntheticLog(count: number, random: () => number): Keystroke[] {
  const log: Keystroke[] = []
  let t = 0
  let pauses = 0

  for (let i = 0; i < count; i += 1) {
    t += Math.floor(random() * 260)

    if (random() < 0.01) {
      // A blur, which bumps the pause count and leaves no gap in test time.
      pauses += 1
    }

    const roll = random()
    const c = PRINTABLE[Math.floor(random() * PRINTABLE.length)] ?? 'a'
    const e = PRINTABLE[Math.floor(random() * PRINTABLE.length)] ?? 'a'

    if (roll < 0.04) {
      log.push({ kind: 'missed', c: '', e, t, ok: false, repeat: false, pauses })
      continue
    }

    if (roll < 0.08) {
      log.push({ kind: 'backspace', c: '', e: '', t, ok: false, repeat: false, pauses })
      continue
    }

    if (roll < 0.1) {
      log.push({ kind: 'delete-word', c: '', e: '', t, ok: false, repeat: false, pauses })
      continue
    }

    if (roll < 0.14) {
      // An extra: typed past the end of a word, so nothing was expected.
      log.push({ kind: 'char', c, e: '', t, ok: false, repeat: false, pauses })
      continue
    }

    const wrong = roll < 0.22
    const expected = wrong ? e : c

    log.push({
      kind: 'char',
      c,
      e: expected,
      t,
      ok: expected !== '' && c === expected,
      repeat: random() < 0.03,
      pauses,
    })
  }

  return log
}

describe('round trip', () => {
  it('is lossless over 1000 randomised tests', () => {
    for (let seed = 1; seed <= 1_000; seed += 1) {
      const random = mulberry32(seed)
      const log = syntheticLog(50 + Math.floor(random() * 400), random)
      const restored = unpackLog(packLog(log))

      expect(restored, `seed ${String(seed)}`).toEqual(log)
    }
  })

  it('handles an empty log', () => {
    expect(packLog([])).toEqual(EMPTY_PACK)
    expect(unpackLog(EMPTY_PACK)).toEqual([])
  })

  it('survives a gap far wider than a byte', () => {
    const log: Keystroke[] = [
      { kind: 'char', c: 'a', e: 'a', t: 0, ok: true, repeat: false, pauses: 0 },
      { kind: 'char', c: 'b', e: 'b', t: 400_000, ok: true, repeat: false, pauses: 0 },
    ]

    expect(unpackLog(packLog(log))).toEqual(log)
  })

  it('refuses a version it does not know', () => {
    expect(() => unpackLog({ ...EMPTY_PACK, version: PACK_VERSION + 1 })).toThrow(/cannot read version/)
  })

  it('refuses a control character as typed input', () => {
    const log: Keystroke[] = [
      { kind: 'char', c: '', e: '', t: 0, ok: true, repeat: false, pauses: 0 },
    ]

    expect(() => packLog(log)).toThrow(/below U\+0020/)
  })
})

describe('size', () => {
  it('packs a 400 keystroke test to well under 1200 bytes', () => {
    const log = syntheticLog(400, mulberry32(7))
    const bytes = packedByteLength(packLog(log))

    expect(bytes).toBeLessThan(1_200)
  })

  it('packs a clean 400 keystroke test near the 900 bytes ARCHITECTURE quotes', () => {
    const log: Keystroke[] = Array.from({ length: 400 }, (_value, i) => ({
      kind: 'char' as const,
      c: 'a',
      e: 'a',
      t: i * 150,
      ok: true,
      repeat: false,
      pauses: 0,
    }))

    expect(packedByteLength(packLog(log))).toBeLessThan(1_000)
  })

  it('is far smaller than the JSON it replaces', () => {
    const log = syntheticLog(400, mulberry32(11))
    const json = new TextEncoder().encode(JSON.stringify(log)).byteLength

    expect(packedByteLength(packLog(log))).toBeLessThan(json / 8)
  })
})
