import { expect, test } from '@playwright/test'

// Placeholder E2E test — replace once you have a running server.
// Uncomment webServer in playwright.config.ts first.
test.skip('homepage loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/.*/)
})
