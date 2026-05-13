import { describe, expect, it } from 'vitest'

import { add, greet, multiply } from './example.js'

describe('example', () => {
  describe('addition', () => {
    it('adds two positive numbers', () => {
      expect(add(2, 3)).toBe(5)
    })

    it('adds negative numbers', () => {
      expect(add(-1, -2)).toBe(-3)
    })

    it('adds zero', () => {
      expect(add(5, 0)).toBe(5)
    })
  })

  describe('multiplication', () => {
    it('multiplies two positive numbers', () => {
      expect(multiply(3, 4)).toBe(12)
    })

    it('multiplies by zero', () => {
      expect(multiply(5, 0)).toBe(0)
    })
  })

  describe('greeting', () => {
    it('greets by name', () => {
      expect(greet('World')).toBe('Hello, World!')
    })
  })
})
