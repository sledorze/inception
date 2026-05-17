import { Effect, FileSystem, Layer } from 'effect'
import type { LoopHealth, PainItem, TodoItem } from '../../domain/loopHealth.ts'
import { parsePainMd } from '../../domain/painParser.ts'
import { parseTodoMd } from '../../domain/todoParser.ts'
import { EventStore } from '../../ports/driven/EventStore.ts'
import { AdminQuery, AdminQueryError } from '../../ports/driving/AdminQuery.ts'
import type { ObservedEvent, TraceQuery } from '../../ports/driving/ObservabilityGateway.ts'

export interface AdminQueryPaths {
  readonly painMd: string
  readonly todoMd: string
}

export const EventStoreAdminQuery = {
  layer: (paths: AdminQueryPaths) =>
    Layer.effect(
      AdminQuery,
      Effect.gen(function* () {
        const store = yield* EventStore
        const fs = yield* FileSystem.FileSystem

        const readMd = (path: string): Effect.Effect<string, AdminQueryError> =>
          fs.readFileString(path).pipe(Effect.mapError((cause): AdminQueryError => new AdminQueryError({ cause })))

        const query = AdminQuery.of({
          metrics: (): Effect.Effect<LoopHealth, AdminQueryError> =>
            Effect.gen(function* () {
              // Run both file reads and the store scan concurrently — all three are independent.
              const [painItems, todoItems, allEvents] = yield* Effect.all(
                [
                  query.pain(),
                  query.work(),
                  store.query({}).pipe(Effect.mapError((cause): AdminQueryError => new AdminQueryError({ cause }))),
                ],
                { concurrency: 'unbounded' },
              )
              return {
                archivedPainItems: 0, // TODO: parse PAIN-archive.md (see P44)
                doneTodoItems: todoItems.filter(t => t.status === 'done').length,
                eventCount: allEvents.length,
                openPainItems: painItems.length,
                openTodoItems: todoItems.filter(t => t.status === 'todo' || t.status === 'in-progress').length,
              }
            }),

          pain: (): Effect.Effect<readonly PainItem[], AdminQueryError> =>
            readMd(paths.painMd).pipe(Effect.map(parsePainMd)),

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
            readMd(paths.todoMd).pipe(Effect.map(parseTodoMd)),
        })
        return query
      }),
    ),
}
