import { describe, expect, it } from 'vitest'

import {
  LOG_RETENTION_DAYS,
  NAMESPACES,
  SCHEMA_VERSION,
  bigramStatKey,
  isNamespace,
  keyStatKey,
  metaKey,
  parseKey,
  testKey,
} from '../../src/storage/schema'

describe('key builders mirror the future Postgres schema', () => {
  it('builds a test key', () => {
    expect(testKey('01HQ8')).toBe('test:01HQ8')
  })

  it('builds a per character key', () => {
    expect(keyStatKey('e')).toBe('key:e')
  })

  it('builds a per bigram key', () => {
    expect(bigramStatKey('ol')).toBe('bigram:ol')
  })

  it('builds a meta key', () => {
    expect(metaKey('schemaVersion')).toBe('meta:schemaVersion')
  })
})

describe('parseKey round-trips every builder', () => {
  it.each([
    ['test', testKey('01HQ8'), '01HQ8'],
    ['key', keyStatKey('e'), 'e'],
    ['bigram', bigramStatKey('ol'), 'ol'],
    ['meta', metaKey('lastPrunedAt'), 'lastPrunedAt'],
  ])('reads back %s', (namespace, key, id) => {
    expect(parseKey(key)).toEqual({ namespace, id })
  })

  it('handles a space, which is a real bigram character', () => {
    const key = bigramStatKey('e ')

    expect(parseKey(key)).toEqual({ namespace: 'bigram', id: 'e ' })
  })
})

describe('parseKey rejects anything a builder did not produce', () => {
  it.each([
    ['no separator', 'test'],
    ['unknown namespace', 'session:01HQ8'],
    ['empty namespace', ':01HQ8'],
    ['empty id', 'test:'],
    ['empty string', ''],
  ])('returns null for %s', (_label, key) => {
    expect(parseKey(key)).toBeNull()
  })
})

describe('key builders reject ids that would corrupt the namespace', () => {
  it('rejects an empty id', () => {
    expect(() => testKey('')).toThrow(/must not be empty/)
  })

  it('rejects an id containing the separator', () => {
    expect(() => metaKey('a:b')).toThrow(/must not contain/)
  })
})

describe('namespace guard', () => {
  it.each(NAMESPACES)('accepts %s', (namespace) => {
    expect(isNamespace(namespace)).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isNamespace('session')).toBe(false)
  })
})

describe('storage constants', () => {
  it('starts at schema version 1', () => {
    expect(SCHEMA_VERSION).toBe(1)
  })

  it('keeps full keystroke logs for 90 days', () => {
    expect(LOG_RETENTION_DAYS).toBe(90)
  })
})
