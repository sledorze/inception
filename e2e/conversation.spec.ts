/**
 * E2E: Conversation flow — send a goal to Georges, receive a reply.
 *
 * Requires: webServer running with LLM_MODE=replay and a committed cassette.
 * Record cassettes: LLM_MODE=record LLM_MODEL=qwopus3.6-35b-a3b-v1 pnpm e2e
 * Replay check:    LLM_MODE=replay pnpm e2e
 *
 * Skipped automatically when LLM_MODE != 'replay' (cassette not yet committed).
 */
import { expect, test } from '@playwright/test'

// Skip until cassette is recorded (see docs/TODO.md 6.6 human-gated step).
test.skip(process.env['LLM_MODE'] !== 'replay', 'Requires LLM_MODE=replay — record cassette first (see TODO 6.6)')

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

/**
 * E2E: S8 clarification round-trip.
 *
 * Skipped until cassette recorded. Record with a goal like "help me" that
 * prompts Georges to call request-clarification, then answer the question.
 * Cassette must capture both LLM calls (initial + post-answer).
 *
 * Record: LLM_MODE=record LLM_MODEL=qwopus3.6-35b-a3b-v1 pnpm e2e
 * Replay: LLM_MODE=replay pnpm e2e
 */
test.skip(process.env['LLM_MODE'] !== 'replay', 'Requires LLM_MODE=replay — record cassette first (see TODO 6.9)')

test('conversation: Georges asks for clarification, User answers, final reply appears', async ({ page }) => {
  await page.goto('/')

  const goalInput = page.getByTestId('conv-goal')
  const sendBtn = page.getByTestId('conv-send')

  // Use a vague goal to encourage Georges to ask for clarification
  await goalInput.fill('help me')
  await sendBtn.click()

  await expect(sendBtn).toHaveText('Thinking…')

  // Georges should ask a clarifying question — shown inline under the goal
  const clarifyEl = page.getByTestId('conv-clarify-0')
  await expect(clarifyEl).toBeVisible({ timeout: 30_000 })
  await expect(clarifyEl).toContainText('Georges asks:')

  // The clarify answer area should appear
  const clarifyAnswerInput = page.getByTestId('conv-clarify-answer')
  await expect(clarifyAnswerInput).toBeVisible()

  // User answers the question
  await clarifyAnswerInput.fill('I need help analysing synthetic-001')
  const clarifySubmit = page.getByTestId('conv-clarify-submit')
  await clarifySubmit.click()

  await expect(clarifySubmit).toHaveText('Thinking…')

  // Final reply should appear
  const firstReply = page.getByTestId('conv-reply-0')
  await expect(firstReply).toBeVisible({ timeout: 30_000 })
  await expect(firstReply).not.toBeEmpty()
})
