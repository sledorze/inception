import { describe, expect, it } from 'vitest'
import { cn } from './utils.ts'

describe(cn, () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('resolves conflicting tailwind classes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('filters falsy values', () => {
    expect(cn('foo', undefined, 'baz')).toBe('foo baz')
  })
})
