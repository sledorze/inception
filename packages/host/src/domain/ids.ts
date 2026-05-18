/**
 * Branded domain ID types for nominal type safety (§1, §9).
 *
 * Brands prevent accidental swaps between sessionId, correlationId, and handleId —
 * all structurally identical strings that carry distinct semantic roles.
 *
 * Decode at HTTP boundaries via the Schema exports (SessionId, CorrelationId, HandleId).
 * Construct programmatically via the maker exports (makeSessionId, makeCorrelationId, makeHandleId).
 * Generate fresh random IDs via the Effect helpers (nextSessionId, nextCorrelationId).
 */
import { Brand, Effect, Random, Schema } from 'effect'

// ─── Brand types ──────────────────────────────────────────────────────────────

export const SessionId = Schema.String.pipe(Schema.brand('SessionId'))
export type SessionId = Schema.Schema.Type<typeof SessionId>

export const CorrelationId = Schema.String.pipe(Schema.brand('CorrelationId'))
export type CorrelationId = Schema.Schema.Type<typeof CorrelationId>

export const HandleId = Schema.String.pipe(Schema.brand('HandleId'))
export type HandleId = Schema.Schema.Type<typeof HandleId>

// ─── Makers (Brand.nominal — official programmatic constructor, no schema decode needed) ──

export const makeSessionId = Brand.nominal<SessionId>()
export const makeCorrelationId = Brand.nominal<CorrelationId>()
export const makeHandleId = Brand.nominal<HandleId>()

// ─── Sentinel values ──────────────────────────────────────────────────────────

/** Used as the default session context when no real session exists (toolkit calls, tracing). */
export const bootstrapSessionId = makeSessionId('bootstrap')
/** Used as the default correlation context before a real goal is submitted. */
export const bootstrapCorrelationId = makeCorrelationId('bootstrap')
/** Used as the correlation ID in out-of-session contexts (e.g. shape-alert events). */
export const untracedCorrelationId = makeCorrelationId('untraced')
/** Used as the session ID in out-of-session contexts. */
export const untracedSessionId = makeSessionId('untraced')

// ─── Effect helpers ───────────────────────────────────────────────────────────

/** Generate a fresh random SessionId inside an Effect computation. */
export const nextSessionId: Effect.Effect<SessionId> = Random.nextUUIDv4.pipe(Effect.map(id => makeSessionId(id)))

/** Generate a fresh random CorrelationId inside an Effect computation. */
export const nextCorrelationId: Effect.Effect<CorrelationId> = Random.nextUUIDv4.pipe(
  Effect.map(id => makeCorrelationId(id)),
)
