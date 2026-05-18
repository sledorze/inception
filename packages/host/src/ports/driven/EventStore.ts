import { createHash } from 'node:crypto'
import type { Effect } from 'effect'
import { Context, Schema } from 'effect'
import type { CorrelationId, SessionId } from '../../domain/ids.ts'

// §9 — actor taxonomy
export type Actor = 'user' | 'georges' | 'host' | 'claude' | 'supervisor' | 'monitor' | 'witness'

export interface StoredEvent {
  readonly id: string
  readonly kind: string
  readonly actor: Actor
  readonly storyRef: string
  readonly tenantId: string
  readonly sessionId: SessionId
  readonly correlationId: CorrelationId
  readonly contentHash: string
  readonly prevHash: string // 'genesis' for first event in a session
  readonly schemaV: number
  readonly occurredAt: string // ISO-8601
  readonly payload: unknown
}

// Store assigns id, contentHash, and prevHash — caller provides business fields.
// tenantId is required: callers should read it from CurrentTenantId FiberRef (domain/tracing.ts).
export type NewEvent = Omit<StoredEvent, 'id' | 'contentHash' | 'prevHash'>

export interface EventStoreQuery {
  readonly storyRef?: string
  readonly tenantId?: string
  readonly sessionId?: SessionId
  readonly correlationId?: CorrelationId
  readonly limit?: number
}

export const EventStoreErrorTag = '@app/host/EventStoreError' as const
export class EventStoreError extends Schema.TaggedErrorClass<EventStoreError>()(EventStoreErrorTag, {
  cause: Schema.Defect,
}) {}

// §9 — sha-256(kind || schemaV || canonicalJson(payload) || correlationId || sessionId || storyRef)
// Exported so all adapters use the same formula and tests can assert it directly.
export function computeContentHash(event: NewEvent): string {
  const material =
    event.kind +
    String(event.schemaV) +
    canonicalJson(event.payload) +
    event.correlationId +
    event.sessionId +
    event.storyRef
  return createHash('sha256').update(material).digest('hex')
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }
  const obj = value as Record<string, unknown> // cast: null and Array ruled out above; TypeScript can't narrow unknown through typeof/Array.isArray
  const sorted = Object.keys(obj).toSorted()
  return `{${sorted.map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`
}

export class EventStore extends Context.Service<
  EventStore,
  {
    readonly append: (event: NewEvent) => Effect.Effect<StoredEvent, EventStoreError>
    readonly query: (filter: EventStoreQuery) => Effect.Effect<readonly StoredEvent[], EventStoreError>
    readonly replay: (
      fromId: string,
      onEvent: (e: StoredEvent) => Effect.Effect<void>,
    ) => Effect.Effect<void, EventStoreError>
  }
>()('@app/host/ports/driven/EventStore') {}
