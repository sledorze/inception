/**
 * Protocol contract test for the RoleRegistry driven port.
 * Parametrised over all bound adapters — Liskov substitution proven by test, not intent (§2.13).
 * Laws exercised: L2.10 (roles versioned; tool surface role-scoped), L2.14 (port contract).
 */
import { Effect, ManagedRuntime } from 'effect'
import { afterAll, beforeAll, describe, expect, it } from '@effect/vitest'
import { BOOTSTRAP_ROLES, InMemoryRoleRegistry } from '../../src/adapters/driven/InMemoryRoleRegistry.ts'
import { RoleNotFound, RoleRegistry } from '../../src/ports/driven/RoleRegistry.ts'
import type { RoleDescriptor } from '../../src/ports/driven/RoleRegistry.ts'

// ─── shared contract ─────────────────────────────────────────────────────────

function runContract(name: string, makeLayer: () => ManagedRuntime.ManagedRuntime<RoleRegistry, never>) {
  describe(name, () => {
    let rt: ManagedRuntime.ManagedRuntime<RoleRegistry, never>

    beforeAll(() => {
      rt = makeLayer()
    })

    afterAll(() => rt.dispose())

    const run = <A>(effect: Effect.Effect<A, unknown, RoleRegistry>) => rt.runPromise(effect)

    it('listRoles returns a non-empty array', async () => {
      const roles: readonly RoleDescriptor[] = await run(
        Effect.gen(function* () {
          const registry = yield* RoleRegistry
          return yield* registry.listRoles()
        }),
      )
      expect(roles.length).toBeGreaterThan(0)
    })

    it('each role has name, version, and toolSurface', async () => {
      const roles = await run(
        Effect.gen(function* () {
          const registry = yield* RoleRegistry
          return yield* registry.listRoles()
        }),
      )
      for (const role of roles) {
        expect(role.name).toBeTypeOf('string')
        expect(role.version).toBeTypeOf('string')
        expect(Array.isArray(role.toolSurface)).toBeTruthy()
      }
    })

    it('getRole returns a known role by name (L2.10)', async () => {
      const role = await run(
        Effect.gen(function* () {
          const registry = yield* RoleRegistry
          return yield* registry.getRole('Implementer')
        }),
      )
      expect(role.name).toBe('Implementer')
    })

    it('getRole returns RoleNotFound for an unknown name (L2.10)', async () => {
      await expect(
        run(
          Effect.gen(function* () {
            const registry = yield* RoleRegistry
            return yield* registry.getRole('NoSuchRole')
          }),
        ),
      ).rejects.toSatisfy((e: unknown) => e instanceof RoleNotFound)
    })

    it('Implementer tool surface includes run-script (L2.10)', async () => {
      const role = await run(
        Effect.gen(function* () {
          const registry = yield* RoleRegistry
          return yield* registry.getRole('Implementer')
        }),
      )
      expect(role.toolSurface).toContain('run-script')
    })

    it('Reviewer tool surface does NOT include run-script (L2.10, defaults-deny)', async () => {
      const role = await run(
        Effect.gen(function* () {
          const registry = yield* RoleRegistry
          return yield* registry.getRole('Reviewer')
        }),
      )
      expect(role.toolSurface).not.toContain('run-script')
    })
  })
}

// ─── adapter configurations ──────────────────────────────────────────────────

runContract('InMemoryRoleRegistry (bootstrap roles)', () => ManagedRuntime.make(InMemoryRoleRegistry.bootstrapLayer))

runContract('InMemoryRoleRegistry (custom roles)', () =>
  ManagedRuntime.make(InMemoryRoleRegistry.layer(BOOTSTRAP_ROLES)),
)
