/**
 * Joins class names, dropping anything falsy.
 *
 * Deliberately not clsx. The whole implementation is one line and a dependency
 * here would be a dependency in the keystroke path, where every kilobyte and
 * every function call is measured.
 */
export function cx(...parts: ReadonlyArray<string | false | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(' ')
}
