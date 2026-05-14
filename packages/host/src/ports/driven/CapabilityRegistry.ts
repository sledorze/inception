/**
 * Versioned capability registry port (4.2).
 *
 * Each `register` call snapshots the full capability set plus the new entry and
 * increments the version counter. `rollback(v)` pins the active set to snapshot v.
 * `list()` returns the capability set at the current (or pinned) version.
 *
 * L2.9: every CapabilityEntry carries the proposalId (contentHash of the
 * CapabilityProposed event) for provenance tracing.
 */
import type { Effect } from 'effect'
import { Context, Schema } from 'effect'

export interface CapabilityEntry {
  readonly code: string
  readonly name: string
  readonly proposalId: string
  readonly promotedAt: string
  readonly scope: readonly string[]
  readonly tests: string
}

export class CapabilityRegistryError extends Schema.TaggedErrorClass<CapabilityRegistryError>()(
  '@app/host/CapabilityRegistryError',
  { cause: Schema.Defect },
) {}

export class CapabilityRegistry extends Context.Service<
  CapabilityRegistry,
  {
    readonly register: (entry: CapabilityEntry) => Effect.Effect<number, CapabilityRegistryError>
    readonly list: () => Effect.Effect<readonly CapabilityEntry[], CapabilityRegistryError>
    readonly rollback: (version: number) => Effect.Effect<void, CapabilityRegistryError>
    readonly currentVersion: () => Effect.Effect<number, CapabilityRegistryError>
  }
>()('@app/host/CapabilityRegistry') {}
