import Database from 'better-sqlite3'
import { Effect, Layer, Random } from 'effect'
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

function rowToStoredEvent(row: Record<string, unknown>): StoredEvent {
  return {
    actor: row['actor'] as StoredEvent['actor'],
    contentHash: row['content_hash'] as string,
    correlationId: row['correlation_id'] as string,
    id: row['id'] as string,
    kind: row['kind'] as string,
    occurredAt: row['occurred_at'] as string,
    payload: JSON.parse(row['payload'] as string) as unknown,
    prevHash: row['prev_hash'] as string,
    schemaV: row['schema_v'] as number,
    sessionId: row['session_id'] as string,
    storyRef: row['story_ref'] as string,
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
                      .prepare('SELECT content_hash FROM events WHERE session_id = ? ORDER BY rowid DESC LIMIT 1')
                      .get(event.sessionId) as { content_hash: string } | undefined
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
                      const existing = db
                        .prepare('SELECT * FROM events WHERE content_hash = ?')
                        .get(contentHash) as Record<string, unknown>
                      return rowToStoredEvent(existing)
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
                  const rows = db
                    .prepare(`SELECT * FROM events ${where} ORDER BY rowid ${limit}`)
                    .all(...params) as Record<string, unknown>[]
                  return rows.map(rowToStoredEvent)
                },
              }),

            replay: (fromId, onEvent) =>
              Effect.gen(function* () {
                const rows = yield* Effect.try({
                  catch: cause => new EventStoreError({ cause }),
                  try: () => {
                    const anchor = db.prepare('SELECT rowid FROM events WHERE id = ?').get(fromId) as
                      | { rowid: number }
                      | undefined
                    if (anchor === undefined) {
                      return []
                    }
                    return db
                      .prepare('SELECT * FROM events WHERE rowid >= ? ORDER BY rowid')
                      .all(anchor.rowid) as Record<string, unknown>[]
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
