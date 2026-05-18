import { Effect, Layer, Random, Schema } from 'effect'
import { SqlClient } from 'effect/unstable/sql'
import * as SqliteClientLib from '@effect/sql-sqlite-node/SqliteClient'
import * as SqliteMigrator from '@effect/sql-sqlite-node/SqliteMigrator'
import { makeCorrelationId, makeSessionId } from '../../domain/ids.ts'
import { computeContentHash, EventStore, EventStoreError } from '../../ports/driven/EventStore.ts'
import type { NewEvent, StoredEvent } from '../../ports/driven/EventStore.ts'

// Migration 1 — initial schema with tenant_id included from the start.
// Idempotent via IF NOT EXISTS; safe re-run on any database.
// Migration 2 — adds tenant_id to pre-existing databases (L1.9 §13).
// PRAGMA table_info detects missing column; ALTER TABLE only runs when absent.
const loader = SqliteMigrator.fromRecord({
  '1_initial_schema': Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`
      CREATE TABLE IF NOT EXISTS events (
        id             TEXT    PRIMARY KEY,
        kind           TEXT    NOT NULL,
        actor          TEXT    NOT NULL,
        story_ref      TEXT    NOT NULL,
        tenant_id      TEXT    NOT NULL DEFAULT 'default',
        session_id     TEXT    NOT NULL,
        correlation_id TEXT    NOT NULL,
        content_hash   TEXT    NOT NULL UNIQUE,
        prev_hash      TEXT    NOT NULL,
        schema_v       INTEGER NOT NULL,
        occurred_at    TEXT    NOT NULL,
        payload        TEXT    NOT NULL
      )
    `
    yield* sql`CREATE INDEX IF NOT EXISTS idx_events_story_ref      ON events(story_ref)`
    yield* sql`CREATE INDEX IF NOT EXISTS idx_events_session_id     ON events(session_id)`
    yield* sql`CREATE INDEX IF NOT EXISTS idx_events_correlation_id ON events(correlation_id)`
  }),

  '2_tenant_isolation': Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    // Backward-compat: databases where migration 1 ran before tenant_id was added
    // to the schema require ALTER TABLE. On fresh databases (migration 1 already
    // includes tenant_id) the PRAGMA finds the column and the ALTER TABLE branch is
    // skipped. The IF NOT EXISTS index creation is always safe.
    const cols = yield* sql<{ name: string }>`PRAGMA table_info(events)`
    if (!cols.some(c => c.name === 'tenant_id')) {
      yield* sql`ALTER TABLE events ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default'`
      yield* sql`UPDATE events SET tenant_id = 'default' WHERE tenant_id IS NULL`
    }
    // IF NOT EXISTS — safe whether or not Migration 1 already created this index.
    yield* sql`CREATE INDEX IF NOT EXISTS idx_events_tenant_id ON events(tenant_id)`
  }),
})

const StoredEventRow = Schema.Struct({
  actor: Schema.Literals(['user', 'georges', 'host', 'claude', 'supervisor', 'monitor', 'witness']),
  content_hash: Schema.String,
  correlation_id: Schema.String,
  id: Schema.String,
  kind: Schema.String,
  occurred_at: Schema.String,
  payload: Schema.String,
  prev_hash: Schema.String,
  schema_v: Schema.Number,
  session_id: Schema.String,
  story_ref: Schema.String,
  tenant_id: Schema.String,
})

function rowToStoredEvent(row: unknown): StoredEvent {
  const r = Schema.decodeUnknownSync(StoredEventRow)(row)
  return {
    actor: r.actor,
    contentHash: r.content_hash,
    correlationId: makeCorrelationId(r.correlation_id),
    id: r.id,
    kind: r.kind,
    occurredAt: r.occurred_at,
    payload: JSON.parse(r.payload),
    prevHash: r.prev_hash,
    schemaV: r.schema_v,
    sessionId: makeSessionId(r.session_id),
    storyRef: r.story_ref,
    tenantId: r.tenant_id,
  }
}

const toEventStoreError = (cause: unknown) => new EventStoreError({ cause })

export const SqliteEventStore = {
  layer: (filename: string) => {
    const eventStoreLayer = Layer.effect(
      EventStore,
      Effect.gen(function* () {
        yield* SqliteMigrator.run({ loader }).pipe(Effect.mapError(toEventStoreError))

        const sql = yield* SqlClient.SqlClient

        return EventStore.of({
          append: (event: NewEvent) =>
            Effect.gen(function* () {
              const id = yield* Random.nextUUIDv4
              const contentHash = computeContentHash(event)

              const lastRows = yield* sql<{
                content_hash: string
              }>`SELECT content_hash FROM events WHERE session_id = ${event.sessionId} ORDER BY rowid DESC LIMIT 1`.pipe(
                Effect.mapError(toEventStoreError),
              )
              const prevHash = lastRows[0]?.content_hash ?? 'genesis'

              yield* sql`
                INSERT OR IGNORE INTO events
                  (id, kind, actor, story_ref, tenant_id, session_id, correlation_id, content_hash, prev_hash, schema_v, occurred_at, payload)
                VALUES
                  (${id}, ${event.kind}, ${event.actor}, ${event.storyRef}, ${event.tenantId}, ${event.sessionId}, ${event.correlationId}, ${contentHash}, ${prevHash}, ${event.schemaV}, ${event.occurredAt}, ${
                    // @effect-diagnostics-next-line preferSchemaOverJson:off
                    JSON.stringify(event.payload)
                  })
              `.pipe(Effect.mapError(toEventStoreError))

              const rows = yield* sql<
                Record<string, unknown>
              >`SELECT * FROM events WHERE content_hash = ${contentHash}`.pipe(Effect.mapError(toEventStoreError))

              return rowToStoredEvent(rows[0])
            }),

          query: filter =>
            Effect.gen(function* () {
              const conds: string[] = []
              const params: unknown[] = []
              if (filter.storyRef !== undefined) {
                conds.push('story_ref = ?')
                params.push(filter.storyRef)
              }
              if (filter.tenantId !== undefined) {
                conds.push('tenant_id = ?')
                params.push(filter.tenantId)
              }
              if (filter.sessionId !== undefined) {
                conds.push('session_id = ?')
                params.push(filter.sessionId)
              }
              if (filter.correlationId !== undefined) {
                conds.push('correlation_id = ?')
                params.push(filter.correlationId)
              }
              const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''
              const limit = filter.limit === undefined ? '' : `LIMIT ${Number(filter.limit)}`

              const rows = yield* sql
                .unsafe<Record<string, unknown>>(`SELECT * FROM events ${where} ORDER BY rowid ${limit}`, params)
                .pipe(Effect.mapError(toEventStoreError))

              return rows.map(rowToStoredEvent)
            }),

          replay: (fromId, onEvent) =>
            Effect.gen(function* () {
              const anchors = yield* sql<{ rowid: number }>`SELECT rowid FROM events WHERE id = ${fromId}`.pipe(
                Effect.mapError(toEventStoreError),
              )

              const anchor = anchors[0]
              if (anchor === undefined) {
                return
              }

              const rows = yield* sql<
                Record<string, unknown>
              >`SELECT * FROM events WHERE rowid >= ${anchor.rowid} ORDER BY rowid`.pipe(
                Effect.mapError(toEventStoreError),
              )

              for (const row of rows) {
                yield* onEvent(rowToStoredEvent(row))
              }
            }),
        })
      }),
    )

    return eventStoreLayer.pipe(Layer.provide(SqliteClientLib.layer({ filename })))
  },
}
