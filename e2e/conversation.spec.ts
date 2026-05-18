/**
 * E2E: Conversation flow — send a goal to Georges, receive a reply.
 *
 * Three test modes:
 *   fake   (default) — deterministic fake LLM; runs automatically in CI.
 *   replay           — serves recorded cassettes; hashes include model name.
 *   record           — records a new cassette against a live LMStudio endpoint.
 *
 * Record:  LLM_MODE=record LLM_MODEL=<model> pnpm test:e2e
 * Replay:  LLM_MODE=replay pnpm test:e2e   (LLM_MODEL defaults to cassette model in playwright.config.ts)
 */
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { FAKE_CLARIFY_TRIGGER } from '../packages/host/src/adapters/driven/RecordReplayLlmProvider.ts'
import { loginViaUi } from './helpers/auth.ts'
import { sendGoal } from './helpers/conversation.ts'

const LLM_MODE = process.env['LLM_MODE'] ?? 'fake'

/** Log in as the enduser, then open a fresh persistent session. */
async function loginAsEnduser(page: Page): Promise<void> {
  await loginViaUi(page, 'enduser', 'enduser')
  // Post-login lands on the session list (/). Start a new conversation —
  // routes to /sessions/<uuid> where the goal composer lives.
  await page.getByTestId('new-conversation').click({ timeout: 10_000 })
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/u, { timeout: 10_000 })
  await expect(page.getByTestId('conv-goal')).toBeVisible({ timeout: 10_000 })
}

// ── Core reply test (fake + replay) ──────────────────────────────────────────

test('conversation: send a goal and receive a non-empty reply', async ({ page }) => {
  test.skip(!['fake', 'replay'].includes(LLM_MODE), 'Requires LLM_MODE=fake or LLM_MODE=replay')

  await loginAsEnduser(page)

  await sendGoal(page, 'What is synthetic-001?')

  // Reply appears near-instantly in fake/replay mode; 10 s is generous headroom
  const firstReply = page.getByTestId('conv-reply-0')
  await expect(firstReply).toBeVisible({ timeout: 10_000 })
  await expect(firstReply).not.toBeEmpty()

  // The session ID is present (proves it was threaded)
  const sessionIdEl = page.getByTestId('conv-session-id')
  await expect(sessionIdEl).toContainText('Session:')
})

// ── P42 grounding check (replay only — requires cassette recorded post-fix) ──

test('conversation: reply is grounded — references handle columns', async ({ page }) => {
  // Skipped until a cassette is recorded after the P42 briefing fix.
  // GREEN cycle: record with LLM_MODE=record; reply must reference 'id' or 'value'
  // (handle column names injected via buildInitialMessages).
  // Cite this file in docs/PAIN-archive.md when closing P42.
  test.skip(LLM_MODE !== 'replay', 'Grounding check requires LLM_MODE=replay cassette recorded after P42 fix')

  await loginAsEnduser(page)

  await sendGoal(page, 'What is synthetic-001?')

  await expect(page.getByTestId('conv-send')).toHaveText('Thinking…')

  const firstReply = page.getByTestId('conv-reply-0')
  await expect(firstReply).toBeVisible({ timeout: 10_000 })

  // Post-fix: Georges must ground its reply in the handle schema (injected in the
  // system brief). At least one of the known column names must appear in the reply.
  const replyText = await firstReply.textContent()
  const isGrounded = (replyText ?? '').includes('id') || (replyText ?? '').includes('value')
  expect(isGrounded, `Expected reply to reference handle columns (id/value) but got: ${replyText}`).toBe(true)
})

// ── S8 clarification round-trip (fake only — uses deterministic trigger) ─────

test('conversation: Georges asks for clarification, User answers, final reply appears', async ({ page }) => {
  // Uses FAKE_CLARIFY_TRIGGER which only works in fake mode (hardcoded in the provider).
  // In replay mode there is no cassette for this goal — skip to avoid hash-miss failure.
  test.skip(LLM_MODE !== 'fake', 'Clarification round-trip requires LLM_MODE=fake (uses FAKE_CLARIFY_TRIGGER)')

  await loginAsEnduser(page)

  const goalInput = page.getByTestId('conv-goal')
  const sendBtn = page.getByTestId('conv-send')

  // Use a vague goal to encourage Georges to ask for clarification
  await goalInput.fill(FAKE_CLARIFY_TRIGGER)
  await sendBtn.click()

  await expect(sendBtn).toHaveText('Thinking…')

  // Georges should ask a clarifying question — shown inline under the goal
  const clarifyEl = page.getByTestId('conv-clarify-0')
  await expect(clarifyEl).toBeVisible({ timeout: 10_000 })
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
  await expect(firstReply).toBeVisible({ timeout: 10_000 })
  await expect(firstReply).not.toBeEmpty()
})
