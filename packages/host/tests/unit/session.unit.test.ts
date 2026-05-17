/**
 * Unit tests for readAgentMd — the agent system-prompt loader.
 *
 * Failure modes tested:
 *   (a) success — returns the bootstrap agent.md content with a known stable marker
 *   (b) SessionError — raised with populated cause when the file is missing
 */
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import { AGENT_MD_PATH, SessionError, readAgentMd } from '../../src/application/session.ts'

describe(readAgentMd, () => {
  it.effect('returns the bootstrap agent.md content with a stable marker', () =>
    Effect.gen(function* () {
      const content = yield* readAgentMd({ path: AGENT_MD_PATH })
      // "Georges" is on line 1 of bootstrap/agent.md — stable marker.
      expect(content).toContain('Georges')
      expect(content.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(NodeFileSystem.layer)),
  )

  it.effect('raises SessionError with a populated cause when the file is missing', () =>
    Effect.gen(function* () {
      const missing = join(tmpdir(), `no-such-agent-md-${Date.now()}.md`)
      const err = yield* Effect.flip(readAgentMd({ path: missing }))
      expect(err).toBeInstanceOf(SessionError)
      expect(err.cause).toBeDefined()
    }).pipe(Effect.provide(NodeFileSystem.layer)),
  )
})
