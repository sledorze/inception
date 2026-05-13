/**
 * Unit tests for Monitor independent signal computation (L3.7, L3.10).
 *
 * These tests verify that the Monitor's signals.ts recomputes R1/R2/R5
 * correctly and independently from the Host Supervisor. The correctness
 * of both implementations is what makes Monitor–Supervisor divergence
 * detection meaningful.
 */
import { describe, expect, it } from 'vitest'
import { computeSignals } from '../../src/signals.ts'
import type { MonitorSignal } from '../../src/signals.ts'

// Minimal ObservedEvent shape for test purposes.
const makeEvent = (actor: string, correlationId: string, kind = 'ToolResult', sessionId = 'sess-1') => ({
  actor,
  contentHash: 'hash',
  correlationId,
  id: correlationId,
  kind,
  occurredAt: new Date().toISOString(),
  payload: {},
  prevHash: '',
  schemaV: 1,
  sessionId,
  storyRef: 'S1',
})

const findSignal = (results: readonly MonitorSignal[], riskId: string) => results.find(r => r.riskId === riskId)

describe('Monitor signals — independent recomputation (L3.7)', () => {
  it('returns R1, R2, R5 results for every session', () => {
    const results = computeSignals('sess-1', [])
    const ids = results.map(r => r.riskId).toSorted()
    expect(ids).toEqual(['R1', 'R2', 'R5'])
  })

  it('R1: zero when no HandleExhausted events', () => {
    const results = computeSignals('sess-1', [])
    expect(findSignal(results, 'R1')?.tripped).toBeFalsy()
    expect(findSignal(results, 'R1')?.currentValue).toBe(0)
  })

  it('R1: tripped when HandleExhausted event is present', () => {
    const events = [makeEvent('host', 'c1', 'HandleExhausted')]
    const results = computeSignals('sess-1', events)
    expect(findSignal(results, 'R1')?.tripped).toBeTruthy()
    expect(findSignal(results, 'R1')?.currentValue).toBe(1)
  })

  it('R2: zero ratio when no Georges events', () => {
    const results = computeSignals('sess-1', [])
    expect(findSignal(results, 'R2')?.tripped).toBeFalsy()
    expect(findSignal(results, 'R2')?.currentValue).toBe(0)
  })

  it('R2: not tripped when all Georges events are corroborated', () => {
    const events = [makeEvent('host', 'c1', 'ToolResultObserved'), makeEvent('georges', 'c1', 'ScriptSucceeded')]
    const results = computeSignals('sess-1', events)
    expect(findSignal(results, 'R2')?.tripped).toBeFalsy()
  })

  it('R2: tripped when uncorroborated ratio exceeds 5 %', () => {
    const events = [
      makeEvent('host', 'c-paired', 'ToolResultObserved'),
      makeEvent('georges', 'c-paired', 'ScriptSucceeded'),
      ...Array.from({ length: 19 }, (_, i) => makeEvent('georges', `unpaired-${i}`, 'ScriptSucceeded')),
    ]
    const results = computeSignals('sess-1', events)
    const r2 = findSignal(results, 'R2')
    expect(r2?.tripped).toBeTruthy()
    expect(r2?.currentValue).toBeGreaterThan(0.05)
  })

  it('R5: not tripped when no escape events', () => {
    const results = computeSignals('sess-1', [])
    expect(findSignal(results, 'R5')?.tripped).toBeFalsy()
  })

  it('R5: tripped when SandboxEscapeAttempt event is present', () => {
    const events = [makeEvent('host', 'c1', 'SandboxEscapeAttempt')]
    const results = computeSignals('sess-1', events)
    expect(findSignal(results, 'R5')?.tripped).toBeTruthy()
    expect(findSignal(results, 'R5')?.currentValue).toBe(1)
  })

  it('sessionId is propagated to every signal result', () => {
    const results = computeSignals('my-session', [])
    for (const r of results) {
      expect(r.sessionId).toBe('my-session')
    }
  })
})
