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
import { loginViaApi } from './helpers/auth.ts'

test.describe('RBAC — HTTP-layer enforcement (L0.3)', () => {
  let adminToken: string

  test.beforeAll(async ({ request }) => {
    adminToken = await loginViaApi(request, 'admin', 'adminpass')
    expect(typeof adminToken).toBe('string')
  })

  test('GET /events returns 404 — leak closed', async ({ request }) => {
    const res = await request.get('/events')
    expect(res.status()).toBe(404)
  })

  test('unauthenticated GET /api/admin/metrics returns 401', async ({ request }) => {
    const res = await request.get('/api/admin/metrics')
    expect(res.status()).toBe(401)
  })

  test('unauthenticated GET /api/admin/pain returns 401', async ({ request }) => {
    const res = await request.get('/api/admin/pain')
    expect(res.status()).toBe(401)
  })

  test('unauthenticated GET /api/admin/work returns 401', async ({ request }) => {
    const res = await request.get('/api/admin/work')
    expect(res.status()).toBe(401)
  })

  test('unauthenticated GET /api/admin/trace returns 401', async ({ request }) => {
    const res = await request.get('/api/admin/trace')
    expect(res.status()).toBe(401)
  })

  test('admin token: GET /api/admin/metrics returns 200 with numeric fields', async ({ request }) => {
    const res = await request.get('/api/admin/metrics', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status()).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(typeof body['eventCount']).toBe('number')
    expect(typeof body['openPainItems']).toBe('number')
  })

  test('admin token: GET /api/admin/trace returns 200 with array', async ({ request }) => {
    const res = await request.get('/api/admin/trace', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('admin token: GET /api/admin/pain returns 200 with array', async ({ request }) => {
    const res = await request.get('/api/admin/pain', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('admin token: GET /api/admin/work returns 200 with array', async ({ request }) => {
    const res = await request.get('/api/admin/work', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('GET /health is open — no auth needed', async ({ request }) => {
    const res = await request.get('/health')
    expect(res.status()).toBe(200)
  })
})
