import type { Effect } from 'effect'
import { Context, Schema } from 'effect'

export const RoleDescriptorSchema = Schema.Struct({
  name: Schema.String,
  // Tools this role may call (subset of ToolRegistry entries). Defaults-deny (L2.10).
  toolSurface: Schema.Array(Schema.String),
  // Semver or content-hash; increments on any field change (L2.10).
  version: Schema.String,
})

export type RoleDescriptor = typeof RoleDescriptorSchema.Type

export class RoleNotFound extends Schema.TaggedErrorClass<RoleNotFound>()('@app/host/RoleNotFound', {
  name: Schema.String,
}) {}

export class RoleRegistry extends Context.Service<
  RoleRegistry,
  {
    readonly getRole: (name: string) => Effect.Effect<RoleDescriptor, RoleNotFound>
    readonly listRoles: () => Effect.Effect<readonly RoleDescriptor[]>
  }
>()('@app/host/RoleRegistry') {}
