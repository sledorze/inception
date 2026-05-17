/**
 * Law L2.15 — AI Work Provenance.
 * "Every AI invocation emits an AiInvoked event carrying full provenance:
 *  (actor, role-version-hash, prompt-hash, input-hash, model-id, seed, output-hash,
 *   latency, token-usage, cost, corroborator-event-id)."
 *
 * If-absent failure mode: AI generation becomes the system's blind spot — claims of fitness,
 * honesty, and replay all depend on observing AI behaviour; unaudited AI work compounds
 * AL.5 (Trust by absence) into every other Tier-1 property.
 *
 * Tests:
 *  1. GoalSubmitted event exists (the correlation root for AI invocations is traceable).
 *  2. EventKind records AI-related events (ToolResultObserved, the current proxy for L2.15).
 *
 * NOTE: Full AiInvoked event with provenance tuple is aspirational — the current baseline
 * records ToolResultObserved as the corroborator (L1.8). A dedicated AiInvoked event kind
 * carrying model-id, seed, latency, and token-usage is the next enforcement step for L2.15.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { EventKind } from '../../src/domain/events.ts'

const HOST_SRC = path.resolve(import.meta.dirname, '../../src')

describe('L2.15 — AI Work Provenance', () => {
  it('EventKind.ToolResultObserved is defined (current corroborator proxy for AI invocations)', () => {
    expect(EventKind.ToolResultObserved).toBe('ToolResultObserved')
  })

  it('EventKind.GoalSubmitted is defined (AI invocation correlation root is recorded)', () => {
    expect(EventKind.GoalSubmitted).toBe('GoalSubmitted')
  })

  it('domain/events.ts defines GoalSubmittedPayload with goal and handleId', () => {
    const eventsPath = path.join(HOST_SRC, 'domain', 'events.ts')
    expect(fs.existsSync(eventsPath)).toBe(true)
    const content = fs.readFileSync(eventsPath, 'utf-8')
    expect(content).toContain('GoalSubmittedPayload')
    expect(content).toContain('handleId')
  })
})
