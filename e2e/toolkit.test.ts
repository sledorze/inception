/**
 * E2E: Toolkit UI — list-tools, write-workspace, read-workspace.
 *
 * These tests target the back-office admin UI (packages/backoffice).
 * The playwright webServer currently only serves packages/app (end-user).
 * Re-enable once the backoffice webServer is wired into playwright.config.ts
 * (TODO Phase 7.D).
 */
import { expect, test } from '@playwright/test'

// Skip until Phase 7.D wires the backoffice into the e2e webServer
test.skip(true, 'Requires backoffice webServer (TODO Phase 7.D)')

test('list-tools returns tool names for Implementer', async ({ page }) => {
  await page.goto('/')
  await page.fill('[data-testid="lt-role"]', 'Implementer')
  await page.click('[data-testid="lt-submit"]')
  await page.waitForSelector('[data-testid="lt-result"] pre')
  const text = await page.textContent('[data-testid="lt-result"] pre')
  expect(text).toContain('list-tools')
  expect(text).toContain('read-workspace')
  expect(text).toContain('write-workspace')
})

test('write-workspace then read-workspace round-trip', async ({ page }) => {
  await page.goto('/')
  await page.fill('[data-testid="ww-role"]', 'Implementer')
  await page.fill('[data-testid="ww-path"]', 'e2e-test.txt')
  await page.fill('[data-testid="ww-content"]', 'hello from e2e')
  await page.click('[data-testid="ww-submit"]')
  await page.waitForSelector('[data-testid="ww-result"] pre')

  await page.fill('[data-testid="rw-path"]', 'e2e-test.txt')
  await page.click('[data-testid="rw-submit"]')
  await page.waitForSelector('[data-testid="rw-result"] pre')
  const text = await page.textContent('[data-testid="rw-result"] pre')
  expect(text).toContain('hello from e2e')
})

test('write-workspace is denied for Reviewer', async ({ page }) => {
  await page.goto('/')
  await page.fill('[data-testid="ww-role"]', 'Reviewer')
  await page.fill('[data-testid="ww-path"]', 'denied.txt')
  await page.fill('[data-testid="ww-content"]', 'should not land')
  await page.click('[data-testid="ww-submit"]')
  await page.waitForSelector('[data-testid="ww-result"] pre')
  const text = await page.textContent('[data-testid="ww-result"] pre')
  expect(text).toContain('Permission denied')
})
