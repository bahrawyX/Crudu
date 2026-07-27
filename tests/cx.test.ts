import { describe, expect, it } from 'vitest'

import { cx } from '../src/components/ui/cx'

describe('cx', () => {
  it('joins class names with a single space', () => {
    expect(cx('char', 'wrong')).toBe('char wrong')
  })

  it('drops false, null, undefined and the empty string', () => {
    expect(cx('char', false, null, undefined, '', 'active')).toBe('char active')
  })

  it('returns an empty string when nothing survives', () => {
    expect(cx(false, undefined)).toBe('')
  })

  it('takes no arguments', () => {
    expect(cx()).toBe('')
  })
})
