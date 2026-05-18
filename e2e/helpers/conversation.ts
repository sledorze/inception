import type { Page } from '@playwright/test'

// Submit a goal and wait for a reply
export async function sendGoal(page: Page, goal: string): Promise<void> {
  await page.getByTestId('conv-goal').fill(goal)
  await page.getByTestId('conv-send').click()
  await page.waitForSelector('[data-testid^="conv-reply-"]', { timeout: 15_000 })
}
