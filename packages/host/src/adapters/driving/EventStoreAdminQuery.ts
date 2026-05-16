import { Effect, FileSystem, Layer } from 'effect'
import type { LoopHealth, PainItem, TodoItem } from '../../domain/loopHealth.ts'
import { parsePainMd } from '../../domain/painParser.ts'
import { parseTodoMd } from '../../domain/todoParser.ts'
import { EventStore } from '../../ports/driven/EventStore.ts'
import { AdminQuery, AdminQueryError } from '../../ports/driving/AdminQuery.ts'
import type { ObservedEvent, TraceQuery } from '../../ports/driving/ObservabilityGateway.ts'

// Paths resolved relative to the monorepo root (5 levels up from src/adapters/driving/).
const PAIN_MD_PATH = new URL('../../../../../docs/PAIN.md', import.meta.url).pathname
const TODO_MD_PATH = new URL('../../../../../docs/TODO.md', import.meta.url).pathname

export const EventStoreAdminQuery = {
  layer: Layer.effect(
    AdminQuery,
    Effect.gen(function* () {
      const store = yield* EventStore
      const fs = yield* FileSystem.FileSystem

      const readMd = (path: string): Effect.Effect<string, AdminQueryError> =>
        fs.readFileString(path).pipe(Effect.mapError((cause): AdminQueryError => new AdminQueryError({ cause })))

      return AdminQuery.of({
        metrics: (): Effect.Effect<LoopHealth, AdminQueryError> =>
          Effect.gen(function* () {
            const painMd = yield* readMd(PAIN_MD_PATH)
            const todoMd = yield* readMd(TODO_MD_PATH)
            const painItems = parsePainMd(painMd)
            const todoItems = parseTodoMd(todoMd)
            const allEvents = yield* store
              .query({})
              .pipe(Effect.mapError((cause): AdminQueryError => new AdminQueryError({ cause })))
            const health: LoopHealth = {
              archivedPainItems: 0, // PAIN-archive.md parsing deferred to 7.C
              doneTodoItems: todoItems.filter(t => t.status === 'done').length,
              eventCount: allEvents.length,
              openPainItems: painItems.length,
              openTodoItems: todoItems.filter(t => t.status === 'todo' || t.status === 'in-progress').length,
            }
            return health
          }),

        pain: (): Effect.Effect<readonly PainItem[], AdminQueryError> =>
          readMd(PAIN_MD_PATH).pipe(Effect.map(parsePainMd)),

        trace: (q: TraceQuery): Effect.Effect<readonly ObservedEvent[], AdminQueryError> =>
          store.query(q).pipe(
            Effect.map(events =>
              events.map(
                (e): ObservedEvent => ({
                  actor: e.actor,
                  contentHash: e.contentHash,
                  correlationId: e.correlationId,
                  id: e.id,
                  kind: e.kind,
                  occurredAt: e.occurredAt,
                  payload: e.payload,
                  prevHash: e.prevHash,
                  schemaV: e.schemaV,
                  sessionId: e.sessionId,
                  storyRef: e.storyRef,
                }),
              ),
            ),
            Effect.mapError((cause): AdminQueryError => new AdminQueryError({ cause })),
          ),

        work: (): Effect.Effect<readonly TodoItem[], AdminQueryError> =>
          readMd(TODO_MD_PATH).pipe(Effect.map(parseTodoMd)),
      })
    }),
  ),
}
