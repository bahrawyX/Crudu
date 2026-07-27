/**
 * The IndexedDB key namespace.
 *
 * ARCHITECTURE.md section 6.3: mirror the future Postgres schema in the local
 * layer today. If keys are `test:{id}`, `bigram:{pair}` and `key:{char}`, then
 * migrating to a server is a sync script that reads local records and INSERTs
 * them, which is an afternoon. If they are not, it is a rewrite.
 *
 * The builders and the parser are a matched pair. tests/storage/schema.test.ts
 * round-trips them.
 */

export const SCHEMA_VERSION = 1

/**
 * Full keystroke logs are kept this long. Derived metrics are kept forever.
 * ARCHITECTURE.md section 6.2: retention is a one-line config now and a
 * migration later.
 */
export const LOG_RETENTION_DAYS = 90

export const NAMESPACES = ['test', 'key', 'bigram', 'meta'] as const

export type Namespace = (typeof NAMESPACES)[number]

const SEPARATOR = ':'

export type StorageKey<N extends Namespace = Namespace> = `${N}${typeof SEPARATOR}${string}`

/** A completed test: config, derived metrics and the packed keystroke log. */
export function testKey(id: string): StorageKey<'test'> {
  return `test${SEPARATOR}${assertIdentifier(id)}`
}

/** Rolling per-character latency and error aggregates. */
export function keyStatKey(char: string): StorageKey<'key'> {
  return `key${SEPARATOR}${assertIdentifier(char)}`
}

/** Rolling per-bigram latency and error aggregates. The product's differentiator. */
export function bigramStatKey(pair: string): StorageKey<'bigram'> {
  return `bigram${SEPARATOR}${assertIdentifier(pair)}`
}

/** Schema version, prune timestamps, active config pointer. */
export function metaKey(name: string): StorageKey<'meta'> {
  return `meta${SEPARATOR}${assertIdentifier(name)}`
}

export type ParsedKey = {
  readonly namespace: Namespace
  readonly id: string
}

/**
 * Splits a stored key back into namespace and id. Returns null for anything
 * that did not come from a builder above, so a prune pass can skip foreign keys
 * rather than delete them.
 */
export function parseKey(key: string): ParsedKey | null {
  const separatorAt = key.indexOf(SEPARATOR)

  if (separatorAt <= 0 || separatorAt === key.length - 1) {
    return null
  }

  const namespace = key.slice(0, separatorAt)
  const id = key.slice(separatorAt + 1)

  if (!isNamespace(namespace)) {
    return null
  }

  return { namespace, id }
}

export function isNamespace(value: string): value is Namespace {
  return (NAMESPACES as readonly string[]).includes(value)
}

/**
 * Ids may not contain the separator. A bigram pair or a character never does,
 * and a test id is generated, so this only ever fires on a programming error.
 */
function assertIdentifier(id: string): string {
  if (id.length === 0) {
    throw new Error('Crudu storage: key id must not be empty')
  }

  if (id.includes(SEPARATOR)) {
    throw new Error(`Crudu storage: key id must not contain "${SEPARATOR}": ${id}`)
  }

  return id
}
