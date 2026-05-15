import Database from 'better-sqlite3'
import { Effect, Layer, Random, Schema } from 'effect'
import { computeContentHash, EventStore, EventStoreError } from '../../ports/driven/EventStore.ts'
import type { NewEvent, StoredEvent } from '../../ports/driven/EventStore.ts'

const DDL = `
  CREATE TABLE IF NOT EXISTS events (
    id            TEXT    PRIMARY KEY,
    kind          TEXT    NOT NULL,
    actor         TEXT    NOT NULL,
    story_ref     TEXT    NOT NULL,
    session_id    TEXT    NOT NULL,
    correlation_id TEXT   NOT NULL,
    content_hash  TEXT    NOT NULL UNIQUE,
    prev_hash     TEXT    NOT NULL,
    schema_v      INTEGER NOT NULL,
    occurred_at   TEXT    NOT NULL,
    payload       TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_events_story_ref      ON events(story_ref);
  CREATE INDEX IF NOT EXISTS idx_events_session_id     ON events(session_id);
  CREATE INDEX IF NOT EXISTS idx_events_correlation_id ON events(correlation_id);
`

const INSERT = `
  INSERT OR IGNORE INTO events
    (id, kind, actor, story_ref, session_id, correlation_id, content_hash, prev_hash, schema_v, occurred_at, payload)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`

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
})

function rowToStoredEvent(row: unknown): StoredEvent {
  const r = Schema.decodeUnknownSync(StoredEventRow)(row)
  return {
    actor: r.actor,
    contentHash: r.content_hash,
    correlationId: r.correlation_id,
    id: r.id,
    kind: r.kind,
    occurredAt: r.occurred_at,
    payload: JSON.parse(r.payload) as unknown,
    prevHash: r.prev_hash,
    schemaV: r.schema_v,
    sessionId: r.session_id,
    storyRef: r.story_ref,
  }
}

export const SqliteEventStore = {
  layer: (filename: string) =>
    Layer.effect(
      EventStore,
      Effect.try({
        catch: cause => new EventStoreError({ cause }),
        try: () => {
          const db = new Database(filename)
          db.pragma('journal_mode = WAL')
          db.exec(DDL)

          return EventStore.of({
            append: (event: NewEvent) =>
              Effect.gen(function* () {
                const id = yield* Random.nextUUIDv4
                return yield* Effect.try({
                  catch: cause => new EventStoreError({ cause }),
                  try: () => {
                    const contentHash = computeContentHash(event)
                    const lastRow = db
                      .prepare<
                        [string],
                        { content_hash: string }
                      >('SELECT content_hash FROM events WHERE session_id = ? ORDER BY rowid DESC LIMIT 1')
                      .get(event.sessionId)
                    const prevHash = lastRow?.content_hash ?? 'genesis'

                    const info = db.prepare(INSERT).run(
                      id,
                      event.kind,
                      event.actor,
                      event.storyRef,
                      event.sessionId,
                      event.correlationId,
                      contentHash,
                      prevHash,
                      event.schemaV,
                      event.occurredAt,
                      // @effect-diagnostics-next-line preferSchemaOverJson:off
                      JSON.stringify(event.payload),
                    )

                    if (info.changes === 0) {
                      // Duplicate content hash — return the already-stored event (idempotent)
                      return rowToStoredEvent(
                        db.prepare('SELECT * FROM events WHERE content_hash = ?').get(contentHash),
                      )
                    }

                    return { ...event, contentHash, id, prevHash } satisfies StoredEvent
                  },
                })
              }),

            query: filter =>
              Effect.try({
                catch: cause => new EventStoreError({ cause }),
                try: () => {
                  const conds: string[] = []
                  const params: unknown[] = []
                  if (filter.storyRef !== undefined) {
                    conds.push('story_ref = ?')
                    params.push(filter.storyRef)
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
                  return db
                    .prepare(`SELECT * FROM events ${where} ORDER BY rowid ${limit}`)
                    .all(...params)
                    .map(rowToStoredEvent)
                },
              }),

            replay: (fromId, onEvent) =>
              Effect.gen(function* () {
                const rows = yield* Effect.try({
                  catch: cause => new EventStoreError({ cause }),
                  try: () => {
                    const anchor = db
                      .prepare<[string], { rowid: number }>('SELECT rowid FROM events WHERE id = ?')
                      .get(fromId)
                    if (anchor === undefined) {
                      return []
                    }
                    return db.prepare('SELECT * FROM events WHERE rowid >= ? ORDER BY rowid').all(anchor.rowid)
                  },
                })
                for (const row of rows) {
                  yield* onEvent(rowToStoredEvent(row))
                }
              }),
          })
        },
      }),
    ),
}
