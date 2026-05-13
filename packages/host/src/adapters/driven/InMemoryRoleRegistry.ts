import { Effect, Layer } from 'effect'
import { RoleNotFound, RoleRegistry } from '../../ports/driven/RoleRegistry.ts'
import type { RoleDescriptor } from '../../ports/driven/RoleRegistry.ts'

// Bootstrap seed roles (bootstrap=true, §12, L3.8). §4.1 Architect/Implementer/Reviewer.
// Tool surfaces align with tools.yaml seed (src/bootstrap/tools.yaml).
export const BOOTSTRAP_ROLES: readonly RoleDescriptor[] = [
  {
    name: 'Architect',
    toolSurface: ['list-tools', 'fetch-handle-shape', 'read-workspace'],
    version: '0.1.0',
  },
  {
    name: 'Implementer',
    toolSurface: ['list-tools', 'fetch-handle-shape', 'run-script', 'read-workspace', 'write-workspace'],
    version: '0.1.0',
  },
  {
    name: 'Reviewer',
    toolSurface: ['list-tools', 'read-workspace'],
    version: '0.1.0',
  },
]

export const InMemoryRoleRegistry = {
  // Bootstrap layer: Architect + Implementer + Reviewer (§4.1).
  bootstrapLayer: Layer.effect(RoleRegistry, Effect.succeed(makeRegistry(BOOTSTRAP_ROLES))),

  // Configurable layer for tests or custom role sets.
  layer: (roles: readonly RoleDescriptor[]) => Layer.effect(RoleRegistry, Effect.succeed(makeRegistry(roles))),
}

function makeRegistry(roles: readonly RoleDescriptor[]) {
  const byName = new Map<string, RoleDescriptor>(roles.map(r => [r.name, r]))

  return RoleRegistry.of({
    getRole: name =>
      Effect.gen(function* () {
        const role = byName.get(name)
        if (role === undefined) {
          return yield* Effect.fail(new RoleNotFound({ name }))
        }
        return role
      }),

    listRoles: () => Effect.succeed([...byName.values()]),
  })
}
