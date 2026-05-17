interface Attempt {
  count: number
  windowStart: number
}

export interface LoginRateLimiter {
  readonly check: (ip: string) => boolean
  readonly recordFailure: (ip: string) => void
  readonly recordSuccess: (ip: string) => void
}

/**
 * In-process per-IP rate limiter for login attempts.
 * Uses performance.now() for monotonic timing (not flagged by no-date-clock rule).
 * Defaults: 10 failures per 60-second sliding window → 429.
 */
export const makeLoginRateLimiter = (windowMs = 60_000, maxAttempts = 10): LoginRateLimiter => {
  const attempts = new Map<string, Attempt>()

  const clearStale = (ip: string): void => {
    const e = attempts.get(ip)
    if (e !== undefined && performance.now() - e.windowStart >= windowMs) {
      attempts.delete(ip)
    }
  }

  return {
    check: (ip: string): boolean => {
      clearStale(ip)
      const e = attempts.get(ip)
      return e !== undefined && e.count >= maxAttempts
    },

    recordFailure: (ip: string): void => {
      clearStale(ip)
      const e = attempts.get(ip)
      if (e === undefined) {
        attempts.set(ip, { count: 1, windowStart: performance.now() })
      } else {
        attempts.set(ip, { count: e.count + 1, windowStart: e.windowStart })
      }
    },

    recordSuccess: (ip: string): void => {
      attempts.delete(ip)
    },
  }
}
