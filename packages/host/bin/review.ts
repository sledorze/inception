#!/usr/bin/env node
/**
 * Claude-mediated capability review CLI (4.1 / 4.2).
 *
 * Usage:
 *   EVENT_STORE_PATH=data/events.db node --import tsx bin/review.ts list
 *   EVENT_STORE_PATH=data/events.db node --import tsx bin/review.ts promote <id> [--notes "..."]
 *   EVENT_STORE_PATH=data/events.db node --import tsx bin/review.ts reject <id> [--notes "..."]
 *   EVENT_STORE_PATH=data/events.db node --import tsx bin/review.ts rollback <version>
 *
 * Stdout carries human-readable output only. Effect logs go to stderr.
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Console, Effect, Layer, Logger } from 'effect'
import { NodeRuntime } from '@effect/platform-node'
import { FileBackedCapabilityRegistry } from '../src/adapters/driven/FileBackedCapabilityRegistry.ts'
import { SqliteEventStore } from '../src/adapters/driven/SqliteEventStore.ts'
import { registerCapability } from '../src/application/registerCapability.ts'
import { listPendingProposals, promoteProposal, rejectProposal } from '../src/application/reviewProposals.ts'
import { CapabilityRegistry } from '../src/ports/driven/CapabilityRegistry.ts'

const __dir = import.meta.dirname
const DB_PATH = process.env['EVENT_STORE_PATH'] ?? join(__dir, '..', 'data', 'events.db')
const REGISTRY_PATH = process.env['REGISTRY_PATH'] ?? join(__dir, '..', 'data', 'capabilities.json')
mkdirSync(dirname(DB_PATH), { recursive: true })
mkdirSync(dirname(REGISTRY_PATH), { recursive: true })

const command = process.argv[2]
const args = process.argv.slice(3)

function parseNotes(rest: readonly string[]): string | undefined {
  const idx = rest.indexOf('--notes')
  return idx === -1 ? undefined : rest[idx + 1]
}

const program = Effect.gen(function* () {
  if (command === 'list') {
    const proposals = yield* listPendingProposals
    if (proposals.length === 0) {
      yield* Console.log('No pending proposals.')
      return
    }
    yield* Console.log(`${proposals.length} pending proposal(s):\n`)
    for (const p of proposals) {
      const payload = p.payload as { name?: string; rationale?: string }
      yield* Console.log(`  id:         ${p.contentHash}`)
      yield* Console.log(`  name:       ${payload['name'] ?? '(unknown)'}`)
      yield* Console.log(`  session:    ${p.sessionId}`)
      yield* Console.log(`  occurredAt: ${p.occurredAt}`)
      yield* Console.log('')
    }
  } else if (command === 'promote') {
    const [proposalId, ...noteArgs] = args
    if (proposalId === undefined) {
      return yield* Effect.die('Usage: review promote <proposalId> [--notes "..."]')
    }
    yield* promoteProposal(proposalId, parseNotes(noteArgs))
    const version = yield* registerCapability(proposalId)
    yield* Console.log(`Promoted: ${proposalId} → registry v${version}`)
  } else if (command === 'reject') {
    const [proposalId, ...noteArgs] = args
    if (proposalId === undefined) {
      return yield* Effect.die('Usage: review reject <proposalId> [--notes "..."]')
    }
    yield* rejectProposal(proposalId, parseNotes(noteArgs))
    yield* Console.log(`Rejected: ${proposalId}`)
  } else if (command === 'rollback') {
    const [versionStr] = args
    if (versionStr === undefined) {
      return yield* Effect.die('Usage: review rollback <version>')
    }
    const version = Number.parseInt(versionStr, 10)
    if (Number.isNaN(version)) {
      return yield* Effect.die(`Invalid version: ${versionStr}`)
    }
    const registry = yield* CapabilityRegistry
    yield* registry.rollback(version).pipe(Effect.orDie)
    yield* Console.log(`Rolled back to registry v${version}`)
  } else {
    return yield* Effect.die(`Unknown command: "${command ?? ''}". Use: list | promote | reject | rollback`)
  }
})

const mainLayer = Layer.mergeAll(
  SqliteEventStore.layer(DB_PATH),
  FileBackedCapabilityRegistry.layer(REGISTRY_PATH),
  Logger.layer([Logger.consolePretty({ stderr: true })]),
)

NodeRuntime.runMain()(Effect.provide(program, mainLayer))
