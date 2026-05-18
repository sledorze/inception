/**
 * E2E: Tenant isolation — conversations scoped to the active tenant.
 *
 * Verifies that:
 * - The TenantSwitcher shows the current tenant name.
 * - A new tenant can be created and switched to.
 * - Conversations started in tenant A are NOT visible in tenant B.
 * - Switching back to tenant A restores visibility of tenant A's conversations.
 *
 * Runs with LLM_MODE=fake (default) — no cassette required.
 * The fake LLM responds deterministically with a canned reply.
 */
import { expect, test } from '@playwright/test'
import { AUTH_HEADER, TENANT_HEADER, TENANT_ID_KEY, TOKEN_KEY } from '../../packages/shared-api/src/contract.ts'
import { loginViaUi } from './helpers/auth.ts'
import { sendGoal } from './helpers/conversation.ts'

const LLM_MODE = process.env['LLM_MODE'] ?? 'fake'

test('tenant isolation: Default tenant visible on login', async ({ page }) => {
  test.skip(!['fake', 'replay'].includes(LLM_MODE), 'Requires LLM_MODE=fake or LLM_MODE=replay')

  await loginViaUi(page, 'enduser', 'enduser')
  // TenantSwitcher should show 'Default' after loading the tenant list.
  await expect(page.getByTestId('tenant-switcher-trigger')).toHaveText('Default', { timeout: 10_000 })
})

test('tenant isolation: create new tenant, switch, start conversation, switch back — tenant session invisible in Default', async ({
  page,
}) => {
  test.skip(!['fake', 'replay'].includes(LLM_MODE), 'Requires LLM_MODE=fake or LLM_MODE=replay')

  // Use a unique suffix so repeated test runs don't collide in the shared DB.
  const suffix = Date.now().toString(36)
  const tenantName = `Acme ${suffix}`
  const tenantSlug = `acme-${suffix}`

  await loginViaUi(page, 'enduser', 'enduser')

  // Start a Default-tenant conversation.
  await page.getByTestId('new-conversation').click()
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/u, { timeout: 10_000 })
  await sendGoal(page, 'Hello from Default')

  // Return to session list to confirm Default session appears.
  await page.goto('/')
  const defaultSessionEl = page.locator('[data-testid^="session-"]').first()
  await expect(defaultSessionEl).toBeVisible({ timeout: 10_000 })
  const defaultSessionId = ((await defaultSessionEl.getAttribute('data-testid')) ?? '').replace('session-', '')

  // Create a new tenant via TenantSwitcher.
  await page.getByTestId('tenant-switcher-trigger').click()
  await page.getByTestId('new-tenant-button').click()
  await page.getByTestId('new-tenant-name').fill(tenantName)
  await page.getByTestId('create-tenant-confirm').click()

  // Wait for the new tenant to appear in the dropdown.
  await expect(page.getByTestId(`tenant-option-${tenantSlug}`)).toBeVisible({ timeout: 10_000 })

  // Switch to the new tenant.
  await page.getByTestId(`tenant-option-${tenantSlug}`).click()
  await expect(page.getByTestId('tenant-switcher-trigger')).toHaveText(tenantName, { timeout: 10_000 })

  // New tenant's session list should be empty (freshly created).
  await expect(page.getByText('No conversations yet')).toBeVisible({ timeout: 5000 })

  // Start a conversation in the new tenant.
  await page.getByTestId('new-conversation').click()
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/u, { timeout: 10_000 })
  const newTenantSessionId = page.url().split('/sessions/')[1] ?? ''
  await sendGoal(page, 'Hello from new tenant')

  // Return to / and switch back to Default.
  await page.goto('/')
  await page.getByTestId('tenant-switcher-trigger').click()
  await page.getByTestId('tenant-option-default').click()
  await expect(page.getByTestId('tenant-switcher-trigger')).toHaveText('Default', { timeout: 10_000 })

  // New tenant's session must NOT appear in Default's session list.
  await expect(page.getByTestId(`session-${newTenantSessionId}`)).not.toBeVisible({ timeout: 5000 })

  // Default's own session MUST appear.
  await expect(page.getByTestId(`session-${defaultSessionId}`)).toBeVisible({ timeout: 5000 })

  // Switch back to new tenant — its session reappears.
  await page.getByTestId('tenant-switcher-trigger').click()
  await page.getByTestId(`tenant-option-${tenantSlug}`).click()
  await expect(page.getByTestId('tenant-switcher-trigger')).toHaveText(tenantName, { timeout: 10_000 })
  await expect(page.getByTestId(`session-${newTenantSessionId}`)).toBeVisible({ timeout: 5000 })
})

test('tenant isolation: cross-tenant session invisible without switching (direct URL access returns data from active tenant)', async ({
  page,
}) => {
  test.skip(!['fake', 'replay'].includes(LLM_MODE), 'Requires LLM_MODE=fake or LLM_MODE=replay')

  await loginViaUi(page, 'enduser', 'enduser')
  // The active tenant is Default. Any request to /api/sessions will be scoped
  // to the Default tenant. The session list should not include sessions from
  // other tenants even if their IDs were somehow known.
  await expect(page.getByTestId('tenant-switcher-trigger')).toHaveText('Default', { timeout: 10_000 })

  // Read auth token and current tenant from the browser's localStorage
  // (same keys used by authedFetch — TOKEN_KEY='auth_token', TENANT_KEY='tenant_id').
  const [token, tenantId] = await page.evaluate(
    ([tokenKey, tenantIdKey]) => [localStorage.getItem(tokenKey) ?? '', localStorage.getItem(tenantIdKey) ?? 'default'],
    [TOKEN_KEY, TENANT_ID_KEY],
  )
  expect(tenantId).toBe('default')

  // Direct API call mirroring what authedFetch does — should succeed for Default.
  const sessionsRes = await page.request.get('/api/sessions', {
    headers: { [AUTH_HEADER]: `Bearer ${token}`, [TENANT_HEADER]: tenantId },
  })
  expect(sessionsRes.ok()).toBe(true)
  const sessions = (await sessionsRes.json()) as unknown[]
  expect(Array.isArray(sessions)).toBe(true)

  // A fabricated tenant the enduser is not entitled to must be rejected.
  const crossRes = await page.request.get('/api/sessions', {
    headers: { [AUTH_HEADER]: `Bearer ${token}`, [TENANT_HEADER]: 'nonexistent-tenant-xyz' },
  })
  expect(crossRes.status()).toBe(403)
})
