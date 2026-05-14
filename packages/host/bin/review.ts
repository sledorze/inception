#!/usr/bin/env node
/**
 * Claude-mediated capability review CLI (4.1).
 *
 * Usage:
 *   EVENT_STORE_PATH=data/events.db node --import tsx bin/review.ts list
 *   EVENT_STORE_PATH=data/events.db node --import tsx bin/review.ts promote <id> [--notes "..."]
 *   EVENT_STORE_PATH=data/events.db node --import tsx bin/review.ts reject <id> [--notes "..."]
 *
 * Stdout carries human-readable output only. Effect logs go to stderr.
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Console, Effect, Layer, Logger } from 'effect'
import { NodeRuntime } from '@effect/platform-node'
import { SqliteEventStore } from '../src/adapters/driven/SqliteEventStore.ts'
import { listPendingProposals, promoteProposal, rejectProposal } from '../src/application/reviewProposals.ts'

const __dir = import.meta.dirname
const DB_PATH = process.env['EVENT_STORE_PATH'] ?? join(__dir, '..', 'data', 'events.db')
mkdirSync(dirname(DB_PATH), { recursive: true })

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
      const payload = p.payload as { tool?: string; rationale?: string }
      yield* Console.log(`  id:         ${p.contentHash}`)
      yield* Console.log(`  tool:       ${payload['tool'] ?? '(unknown)'}`)
      yield* Console.log(`  session:    ${p.sessionId}`)
      yield* Console.log(`  occurredAt: ${p.occurredAt}`)
      if (payload['rationale'] !== undefined) {
        yield* Console.log(`  rationale:  ${payload['rationale']}`)
      }
      yield* Console.log('')
    }
  } else if (command === 'promote') {
    const [proposalId, ...noteArgs] = args
    if (proposalId === undefined) {
      return yield* Effect.die('Usage: review promote <proposalId> [--notes "..."]')
    }
    yield* promoteProposal(proposalId, parseNotes(noteArgs))
    yield* Console.log(`Promoted: ${proposalId}`)
  } else if (command === 'reject') {
    const [proposalId, ...noteArgs] = args
    if (proposalId === undefined) {
      return yield* Effect.die('Usage: review reject <proposalId> [--notes "..."]')
    }
    yield* rejectProposal(proposalId, parseNotes(noteArgs))
    yield* Console.log(`Rejected: ${proposalId}`)
  } else {
    return yield* Effect.die(`Unknown command: "${command ?? ''}". Use: list | promote | reject`)
  }
})

const mainLayer = Layer.mergeAll(
  SqliteEventStore.layer(DB_PATH),
  Logger.layer([Logger.consolePretty({ stderr: true })]),
)

NodeRuntime.runMain()(Effect.provide(program, mainLayer))
