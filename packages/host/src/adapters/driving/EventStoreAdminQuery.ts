import { Effect, FileSystem, Layer } from 'effect'
import type { LoopHealth, PainItem, TodoItem } from '../../domain/loopHealth.ts'
import { EventStore } from '../../ports/driven/EventStore.ts'
import { AdminQuery, AdminQueryError } from '../../ports/driving/AdminQuery.ts'
import type { ObservedEvent, TraceQuery } from '../../ports/driving/ObservabilityGateway.ts'

// Paths resolved relative to the monorepo root (5 levels up from src/adapters/driving/).
const PAIN_MD_PATH = new URL('../../../../../docs/PAIN.md', import.meta.url).pathname
const TODO_MD_PATH = new URL('../../../../../docs/TODO.md', import.meta.url).pathname

/** Type-guard for TodoItem status — avoids any `as` cast. */
const parseTodoStatus = (s: string): TodoItem['status'] | undefined => {
  if (s === 'todo') {
    return 'todo'
  }
  if (s === 'in-progress') {
    return 'in-progress'
  }
  if (s === 'done') {
    return 'done'
  }
  if (s === 'blocked') {
    return 'blocked'
  }
  if (s === 'parked') {
    return 'parked'
  }
  return undefined
}

/** Minimal regex-based parser for PAIN.md open items (## P<n> — <title> blocks). */
const parsePainMd = (md: string): readonly PainItem[] => {
  const items: PainItem[] = []
  const blocks = md.split(/^## /mu).slice(1)
  for (const block of blocks) {
    const headerMatch = /^(P\d+) — (.+)/u.exec(block)
    if (headerMatch === null) {
      continue
    }
    const id = headerMatch[1] ?? ''
    const title = headerMatch[2]?.trim() ?? ''
    const severityMatch = /\*\*Severity:\*\*\s*(.+)/u.exec(block)
    const severity = severityMatch?.[1]?.trim() ?? 'unknown'
    items.push({ id, severity, status: 'open', title })
  }
  return items
}

/** Minimal regex-based parser for TODO.md items. */
const parseTodoMd = (md: string): readonly TodoItem[] => {
  const items: TodoItem[] = []
  const lineRe = /^- \[(todo|in-progress|done|blocked|parked)\] \*\*(\d+\.\w+)\*\* (.+)/mu
  let phaseLabel = 'unknown'
  for (const line of md.split('\n')) {
    const phaseMatch = /^## Phase (.+)/u.exec(line)
    if (phaseMatch !== null) {
      phaseLabel = phaseMatch[1]?.trim() ?? 'unknown'
      continue
    }
    const m = lineRe.exec(line)
    if (m === null) {
      continue
    }
    const status = parseTodoStatus(m[1] ?? '')
    if (status === undefined) {
      continue
    }
    const id = m[2] ?? ''
    const title = m[3]?.trim() ?? ''
    items.push({ id, phase: phaseLabel, status, title })
  }
  return items
}

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
              archivedPainItems: 0, // PAIN-archive.md parsing deferred to 7.B
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
