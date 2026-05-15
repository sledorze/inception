/**
 * Protocol contract test for the CapabilityRegistry port (4.2).
 * Parametrised over all bound adapters — Liskov substitution proven by test (§2.13).
 */
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Layer } from 'effect'
import { Effect, ManagedRuntime } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from '@effect/vitest'
import { FileBackedCapabilityRegistry } from '../../src/adapters/driven/FileBackedCapabilityRegistry.ts'
import { InMemoryCapabilityRegistry } from '../../src/adapters/driven/InMemoryCapabilityRegistry.ts'
import type { CapabilityEntry } from '../../src/ports/driven/CapabilityRegistry.ts'
import { CapabilityRegistry } from '../../src/ports/driven/CapabilityRegistry.ts'

const entry = (name = 'my-tool'): CapabilityEntry => ({
  code: `function ${name}() { return 42; }`,
  description: `A capability named ${name}`,
  name,
  promotedAt: '2026-01-01T00:00:00.000Z',
  proposalId: 'proposal-hash-1',
  scope: ['Implementer'],
  tests: `it('works', () => expect(${name}()).toBe(42))`,
})

function runContract(label: string, makeLayer: () => Layer.Layer<CapabilityRegistry>) {
  describe(label, () => {
    let rt: ManagedRuntime.ManagedRuntime<CapabilityRegistry, never>

    beforeEach(() => {
      rt = ManagedRuntime.make(makeLayer())
    })

    afterEach(() => rt.dispose())

    const run = <A>(eff: Effect.Effect<A, unknown, CapabilityRegistry>) => rt.runPromise(eff)

    it('starts at version 0 with empty capability list', async () => {
      const version = await run(
        Effect.gen(function* () {
          const r = yield* CapabilityRegistry
          return yield* r.currentVersion()
        }),
      )
      expect(version).toBe(0)
      const caps = await run(
        Effect.gen(function* () {
          const r = yield* CapabilityRegistry
          return yield* r.list()
        }),
      )
      expect(caps).toHaveLength(0)
    })

    it('register increments version and returns new version number', async () => {
      const version = await run(
        Effect.gen(function* () {
          const r = yield* CapabilityRegistry
          return yield* r.register(entry())
        }),
      )
      expect(version).toBe(1)
    })

    it('list returns capabilities at the current version', async () => {
      await run(
        Effect.gen(function* () {
          const r = yield* CapabilityRegistry
          yield* r.register(entry('tool-a'))
          yield* r.register(entry('tool-b'))
        }),
      )
      const caps = await run(
        Effect.gen(function* () {
          const r = yield* CapabilityRegistry
          return yield* r.list()
        }),
      )
      expect(caps).toHaveLength(2)
      expect(caps.map(c => c.name).toSorted()).toEqual(['tool-a', 'tool-b'])
    })

    it('registering the same name replaces the previous entry', async () => {
      await run(
        Effect.gen(function* () {
          const r = yield* CapabilityRegistry
          yield* r.register({ ...entry('my-tool'), proposalId: 'v1' })
          yield* r.register({ ...entry('my-tool'), proposalId: 'v2' })
        }),
      )
      const caps = await run(
        Effect.gen(function* () {
          const r = yield* CapabilityRegistry
          return yield* r.list()
        }),
      )
      expect(caps).toHaveLength(1)
      expect(caps[0]?.proposalId).toBe('v2')
    })

    it('rollback pins the active set to a previous snapshot', async () => {
      await run(
        Effect.gen(function* () {
          const r = yield* CapabilityRegistry
          yield* r.register(entry('tool-a'))
          yield* r.register(entry('tool-b'))
          yield* r.rollback(1)
        }),
      )
      const caps = await run(
        Effect.gen(function* () {
          const r = yield* CapabilityRegistry
          return yield* r.list()
        }),
      )
      expect(caps).toHaveLength(1)
      expect(caps[0]?.name).toBe('tool-a')
    })

    it('rollback to version 0 yields empty capability set', async () => {
      await run(
        Effect.gen(function* () {
          const r = yield* CapabilityRegistry
          yield* r.register(entry())
          yield* r.rollback(0)
        }),
      )
      const caps = await run(
        Effect.gen(function* () {
          const r = yield* CapabilityRegistry
          return yield* r.list()
        }),
      )
      expect(caps).toHaveLength(0)
    })

    it('rollback to non-existent version fails', async () => {
      const result = await run(
        Effect.gen(function* () {
          const r = yield* CapabilityRegistry
          return yield* Effect.exit(r.rollback(99))
        }),
      )
      expect(result._tag).toBe('Failure')
    })

    it('capability fields round-trip faithfully', async () => {
      const original = entry('round-trip-tool')
      await run(
        Effect.gen(function* () {
          const r = yield* CapabilityRegistry
          yield* r.register(original)
        }),
      )
      const caps = await run(
        Effect.gen(function* () {
          const r = yield* CapabilityRegistry
          return yield* r.list()
        }),
      )
      expect(caps[0]).toMatchObject(original)
    })
  })
}

runContract('InMemoryCapabilityRegistry', () => InMemoryCapabilityRegistry.layer)

runContract('FileBackedCapabilityRegistry', () =>
  FileBackedCapabilityRegistry.layer(join(tmpdir(), `capability-registry-${randomUUID()}.json`)),
)
