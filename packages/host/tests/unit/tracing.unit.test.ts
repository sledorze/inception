/**
 * Unit test for CurrentCorrelationId — Context.Reference default value.
 * The default must be 'bootstrap' so callers that don't go through
 * submitGoal (e.g., direct toolkit-handler tests) still emit valid events.
 */
import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { CurrentCorrelationId } from '../../src/domain/tracing.ts'

describe('CurrentCorrelationId reference', () => {
  it.effect('defaults to "bootstrap" when not provided', () =>
    Effect.gen(function* () {
      const id = yield* CurrentCorrelationId
      expect(id).toBe('bootstrap')
    }),
  )

  it.effect('resolves to the provided value when injected via Effect.provideService', () =>
    Effect.gen(function* () {
      let captured = ''
      yield* Effect.provideService(
        Effect.gen(function* () {
          captured = yield* CurrentCorrelationId
        }),
        CurrentCorrelationId,
        'custom-uuid',
      )
      expect(captured).toBe('custom-uuid')
    }),
  )
})
