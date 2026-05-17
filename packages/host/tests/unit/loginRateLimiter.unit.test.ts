import { describe, expect, it } from 'vitest'
import { makeLoginRateLimiter } from '../../src/application/loginRateLimiter.ts'

describe('makeLoginRateLimiter', () => {
  it('does not block before the limit is reached', () => {
    const limiter = makeLoginRateLimiter(60_000, 3)
    expect(limiter.check('1.2.3.4')).toBe(false)
    limiter.recordFailure('1.2.3.4')
    limiter.recordFailure('1.2.3.4')
    expect(limiter.check('1.2.3.4')).toBe(false)
  })

  it('blocks after maxAttempts failures', () => {
    const limiter = makeLoginRateLimiter(60_000, 3)
    limiter.recordFailure('1.2.3.4')
    limiter.recordFailure('1.2.3.4')
    limiter.recordFailure('1.2.3.4')
    expect(limiter.check('1.2.3.4')).toBe(true)
  })

  it('clears the counter on success', () => {
    const limiter = makeLoginRateLimiter(60_000, 3)
    limiter.recordFailure('1.2.3.4')
    limiter.recordFailure('1.2.3.4')
    limiter.recordFailure('1.2.3.4')
    expect(limiter.check('1.2.3.4')).toBe(true)
    limiter.recordSuccess('1.2.3.4')
    expect(limiter.check('1.2.3.4')).toBe(false)
  })

  it('tracks IPs independently', () => {
    const limiter = makeLoginRateLimiter(60_000, 2)
    limiter.recordFailure('192.168.1.1')
    limiter.recordFailure('192.168.1.1')
    expect(limiter.check('192.168.1.1')).toBe(true)
    expect(limiter.check('192.168.1.2')).toBe(false)
  })

  it('unblocks after the window expires', () => {
    const limiter = makeLoginRateLimiter(1, 2) // 1 ms window
    limiter.recordFailure('1.2.3.4')
    limiter.recordFailure('1.2.3.4')
    expect(limiter.check('1.2.3.4')).toBe(true)
    return new Promise<void>(resolve => {
      setTimeout(() => {
        expect(limiter.check('1.2.3.4')).toBe(false)
        resolve()
      }, 10)
    })
  })
})
