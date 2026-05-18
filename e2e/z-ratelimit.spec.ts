/**
 * Rate limiting E2E test — intentionally runs LAST (z- prefix ensures alphabetical ordering).
 *
 * This test exhausts the per-IP login counter (10 failures + 1 blocked → 429) and leaves
 * the rate limiter locked for 60 seconds. It MUST run after all other e2e tests that use
 * /api/login (conversation.spec.ts, tenant-isolation.test.ts) so it doesn't block them.
 *
 * P49: POST /api/login rate limit — 10 failures per 60-second window → 429 + Retry-After.
 */
import { expect, test } from '@playwright/test'

test.describe('Rate limiting — POST /api/login (P49)', () => {
  let alreadyLocked = false

  test.beforeAll(async ({ request }) => {
    // A successful admin login calls recordSuccess → resets the counter to 0.
    // If this returns 429, the server is locked from a previous run; skip.
    const setup = await request.post('/api/login', {
      data: { password: 'adminpass', username: 'admin' },
    })
    alreadyLocked = setup.status() === 429
  })

  test('returns 401 before limit then 429 + Retry-After header after maxAttempts failures', async ({ request }) => {
    test.skip(alreadyLocked, 'Rate limiter locked from a previous run — wait 60 s or restart the webServer')

    // 10 wrong-password attempts — each must return 401 (counter not yet at limit).
    for (let i = 0; i < 10; i++) {
      const res = await request.post('/api/login', {
        data: { password: 'definitely-wrong-password', username: `nonexistent-${String(i)}` },
      })
      expect(res.status()).toBe(401)
    }

    // 11th attempt from same IP — counter is at maxAttempts; blocked before credential check.
    const blocked = await request.post('/api/login', {
      data: { password: 'definitely-wrong-password', username: 'nonexistent-final' },
    })
    expect(blocked.status()).toBe(429)
    expect(blocked.headers()['retry-after']).toBe('60')
  })
})
