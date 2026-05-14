/**
 * Protocol contract for the PolicyGate port.
 * Parametrised over all bound adapters — Liskov substitution proven by test.
 *
 * Invariants every adapter must satisfy:
 *  1. check(unknown) fails with PolicyDenied before permit.
 *  2. check(permitted) succeeds after permit.
 *  3. PolicyDenied carries the blocked tool name.
 *  4. permit is idempotent — double-permitting does not error.
 *  5. Pre-seeded tools are permitted from construction.
 */
import type { Layer } from 'effect'
import { Effect } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { InMemoryPolicyGate } from '../../src/adapters/driven/InMemoryPolicyGate.ts'
import { PolicyDenied, PolicyGate } from '../../src/ports/driven/PolicyGate.ts'

const adapters: readonly { label: string; layer: Layer.Layer<PolicyGate> }[] = [
  { label: 'InMemoryPolicyGate (empty)', layer: InMemoryPolicyGate.layer([]) },
  { label: 'InMemoryPolicyGate (pre-seeded)', layer: InMemoryPolicyGate.layer(['seeded-tool']) },
]

for (const { label, layer: adapterLayer } of adapters) {
  describe(`PolicyGate — ${label}`, () => {
    it.effect('check(unknown) → PolicyDenied before permit', () =>
      Effect.gen(function* () {
        const gate = yield* PolicyGate
        const error = yield* gate.check('unknown-tool').pipe(Effect.flip)
        expect(error).toBeInstanceOf(PolicyDenied)
        expect(error.toolName).toBe('unknown-tool')
      }).pipe(Effect.provide(adapterLayer)),
    )

    it.effect('check(permitted) → void after permit', () =>
      Effect.gen(function* () {
        const gate = yield* PolicyGate
        yield* gate.permit('new-tool')
        yield* gate.check('new-tool')
      }).pipe(Effect.provide(adapterLayer)),
    )

    it.effect('PolicyDenied carries the blocked tool name and a reason string', () =>
      Effect.gen(function* () {
        const gate = yield* PolicyGate
        const error = yield* gate.check('blocked-tool').pipe(Effect.flip)
        expect(error.toolName).toBe('blocked-tool')
        expect(typeof error.reason).toBe('string')
        expect(error.reason.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(adapterLayer)),
    )

    it.effect('permit is idempotent — double-permitting does not error', () =>
      Effect.gen(function* () {
        const gate = yield* PolicyGate
        yield* gate.permit('dup-tool')
        yield* gate.permit('dup-tool')
        yield* gate.check('dup-tool')
      }).pipe(Effect.provide(adapterLayer)),
    )
  })
}

// Pre-seeded adapter: verify seeded tool is permitted from construction.
describe('PolicyGate — InMemoryPolicyGate (pre-seeded initial state)', () => {
  it.effect('pre-seeded tool is permitted without explicit permit call', () =>
    Effect.gen(function* () {
      const gate = yield* PolicyGate
      yield* gate.check('seeded-tool')
    }).pipe(Effect.provide(InMemoryPolicyGate.layer(['seeded-tool']))),
  )
})
