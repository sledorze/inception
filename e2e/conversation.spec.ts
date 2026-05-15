/**
 * E2E: Conversation flow — send a goal to Georges, receive a reply.
 *
 * Requires: webServer running with LLM_MODE=replay and a committed cassette.
 * Record cassettes: LLM_MODE=record LLM_MODEL=qwopus3.6-35b-a3b-v1 pnpm e2e
 * Replay check:    LLM_MODE=replay pnpm e2e
 */
import { expect, test } from '@playwright/test'

test('conversation: send a goal and receive a non-empty reply', async ({ page }) => {
  await page.goto('/')

  const goalInput = page.getByTestId('conv-goal')
  const sendBtn = page.getByTestId('conv-send')

  await goalInput.fill('What is synthetic-001?')
  await sendBtn.click()

  // Thinking… button means the request is in flight
  await expect(sendBtn).toHaveText('Thinking…')

  // Wait up to 30 s for the first reply to appear in the transcript
  const firstReply = page.getByTestId('conv-reply-0')
  await expect(firstReply).toBeVisible({ timeout: 30_000 })
  await expect(firstReply).not.toBeEmpty()

  // The session ID is present (proves it was threaded)
  const sessionIdEl = page.getByTestId('conv-session-id')
  await expect(sessionIdEl).toContainText('Session:')
})
