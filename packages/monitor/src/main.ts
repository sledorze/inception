/**
 * Monitor daemon entry point (L3.7, L3.10).
 *
 * Environment variables:
 *   MONITOR_SQLITE_PATH — path to the Host's SQLite event store (required).
 *   MONITOR_INTERVAL_MS — polling interval in ms (default: 30_000).
 */
import { Effect, Layer, Schedule } from 'effect'
import { SqliteEventStore } from '@app/host/src/adapters/driven/SqliteEventStore.ts'
import { EventStoreObservabilityGateway } from '@app/host/src/adapters/driving/EventStoreObservabilityGateway.ts'
import { runOneCycle } from './daemon.ts'

const sqlitePath = process.env['MONITOR_SQLITE_PATH']
if (!sqlitePath) {
  console.error('MONITOR_SQLITE_PATH is required')
  process.exit(1)
}

const intervalMs = Number(process.env['MONITOR_INTERVAL_MS'] ?? 30_000)

const monitorLayer = EventStoreObservabilityGateway.layer.pipe(Layer.provideMerge(SqliteEventStore.layer(sqlitePath)))

const program = runOneCycle.pipe(
  Effect.tap(divergences => {
    if (divergences.length > 0) {
      console.log(`[monitor] SupervisorDivergence detected: ${divergences.join(', ')}`)
    }
    return Effect.void
  }),
  Effect.repeat(Schedule.spaced(intervalMs)),
  Effect.provide(monitorLayer),
)

try {
  await Effect.runPromise(program)
} catch (error: unknown) {
  console.error('[monitor] fatal:', error)
  process.exit(1)
}
