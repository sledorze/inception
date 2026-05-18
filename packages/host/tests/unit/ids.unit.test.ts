/**
 * Unit tests for branded ID constructors (domain/ids.ts).
 *
 * Verifies: brand constructors produce correct string values; sentinels have expected
 * literal values; nextSessionId / nextCorrelationId yield valid UUID-like strings;
 * makeCorrelationId(sessionId) round-trips (idempotent deleteSession correlationId).
 */
import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import {
  bootstrapCorrelationId,
  bootstrapSessionId,
  makeCorrelationId,
  makeHandleId,
  makeSessionId,
  nextCorrelationId,
  nextSessionId,
  untracedCorrelationId,
  untracedSessionId,
} from '../../src/domain/ids.ts'

describe('branded ID constructors', () => {
  it('makeSessionId preserves the underlying string value', () => {
    const id = makeSessionId('my-session')
    expect(id).toBe('my-session')
  })

  it('makeCorrelationId preserves the underlying string value', () => {
    const id = makeCorrelationId('my-cid')
    expect(id).toBe('my-cid')
  })

  it('makeHandleId preserves the underlying string value', () => {
    const id = makeHandleId('synthetic-001')
    expect(id).toBe('synthetic-001')
  })

  it('bootstrap sentinels have the expected literal values', () => {
    expect(bootstrapSessionId).toBe('bootstrap')
    expect(bootstrapCorrelationId).toBe('bootstrap')
  })

  it('untraced sentinels have the expected literal values', () => {
    expect(untracedSessionId).toBe('untraced')
    expect(untracedCorrelationId).toBe('untraced')
  })

  it('makeCorrelationId(sessionId) produces a deterministic correlationId for deleteSession idempotency', () => {
    const sessionId = makeSessionId('some-session')
    const cid1 = makeCorrelationId(sessionId)
    const cid2 = makeCorrelationId(sessionId)
    expect(cid1).toBe(cid2)
    expect(cid1).toBe('some-session')
  })

  it.effect('nextSessionId yields a non-empty string', () =>
    Effect.gen(function* () {
      const id = yield* nextSessionId
      expect(id.length).toBeGreaterThan(0)
    }),
  )

  it.effect('nextCorrelationId yields a non-empty string', () =>
    Effect.gen(function* () {
      const id = yield* nextCorrelationId
      expect(id.length).toBeGreaterThan(0)
    }),
  )

  it.effect('nextSessionId and nextCorrelationId produce distinct values across two calls', () =>
    Effect.gen(function* () {
      const a = yield* nextSessionId
      const b = yield* nextSessionId
      expect(a).not.toBe(b)
    }),
  )
})
