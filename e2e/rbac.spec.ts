/**
 * E2E RBAC smoke tests — HTTP-level, no browser needed.
 * Uses Playwright's `request` fixture to verify the RBAC enforcement at the HTTP layer.
 *
 * L0.3 scenarios:
 *  (a) enduser cannot reach /api/admin/* → 403
 *  (b) admin can reach /api/admin/metrics and /api/admin/trace → 200
 *  (c) GET /events → 404 (leak closed)
 *  (d) unauthenticated → 401
 *
 * Requires the webServer (playwright.config.ts) to be running with default credentials.
 * Default admin: username=admin password=adminpass (data/credentials.json).
 * Default enduser: none pre-seeded; we register by calling /api/login with wrong creds → 401
 * and confirm the admin routes remain guarded even on 401.
 *
 * NOTE: There is no default enduser in credentials.json; this test validates that:
 * - a missing/invalid token → 401 on any guarded route
 * - the admin token grants access to admin routes
 * - GET /events is unconditionally 404
 */
import { expect, test } from '@playwright/test'

const BASE = 'http://localhost:3100'

test.describe('RBAC — HTTP-layer enforcement (L0.3)', () => {
  let adminToken: string

  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${BASE}/api/login`, {
      data: { password: 'adminpass', username: 'admin' },
    })
    expect(res.status()).toBe(200)
    const body = (await res.json()) as { token: string }
    adminToken = body.token
  })

  test('GET /events returns 404 — leak closed', async ({ request }) => {
    const res = await request.get(`${BASE}/events`)
    expect(res.status()).toBe(404)
  })

  test('unauthenticated GET /api/admin/metrics returns 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/metrics`)
    expect(res.status()).toBe(401)
  })

  test('unauthenticated GET /api/admin/pain returns 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/pain`)
    expect(res.status()).toBe(401)
  })

  test('unauthenticated GET /api/admin/work returns 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/work`)
    expect(res.status()).toBe(401)
  })

  test('unauthenticated GET /api/admin/trace returns 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/trace`)
    expect(res.status()).toBe(401)
  })

  test('admin token: GET /api/admin/metrics returns 200 with numeric fields', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status()).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(typeof body['eventCount']).toBe('number')
    expect(typeof body['openPainItems']).toBe('number')
  })

  test('admin token: GET /api/admin/trace returns 200 with array', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/trace`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('admin token: GET /api/admin/pain returns 200 with array', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/pain`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('admin token: GET /api/admin/work returns 200 with array', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/work`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('GET /health is open — no auth needed', async ({ request }) => {
    const res = await request.get(`${BASE}/health`)
    expect(res.status()).toBe(200)
  })
})

test.describe('Rate limiting — POST /api/login (P49)', () => {
  // NOTE: This test intentionally exhausts the per-IP counter and leaves the rate limiter
  // locked for 60 seconds. In CI (fresh server each run) this is harmless. In dev mode
  // with reuseExistingServer, restart the webServer (or wait 60 s) before re-running the
  // full e2e suite.
  let alreadyLocked = false

  test.beforeAll(async ({ request }) => {
    // A successful admin login calls recordSuccess → resets the counter to 0.
    // If this itself returns 429, the server is locked from a previous run; skip.
    const setup = await request.post(`${BASE}/api/login`, {
      data: { password: 'adminpass', username: 'admin' },
    })
    alreadyLocked = setup.status() === 429
  })

  test('returns 401 before limit then 429 + Retry-After header after maxAttempts failures', async ({ request }) => {
    test.skip(alreadyLocked, 'Rate limiter locked from a previous run — wait 60 s or restart the webServer')

    // 10 wrong-password attempts — each must return 401 (counter not yet at limit).
    for (let i = 0; i < 10; i++) {
      const res = await request.post(`${BASE}/api/login`, {
        data: { password: 'definitely-wrong-password', username: `nonexistent-${String(i)}` },
      })
      expect(res.status()).toBe(401)
    }

    // 11th attempt from same IP — counter is at maxAttempts; must be blocked before credential check.
    const blocked = await request.post(`${BASE}/api/login`, {
      data: { password: 'definitely-wrong-password', username: 'nonexistent-final' },
    })
    expect(blocked.status()).toBe(429)
    expect(blocked.headers()['retry-after']).toBe('60')
  })
})
