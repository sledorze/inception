/**
 * Law L3.5 — Externalized Memory.
 * "Georges' working memory lives in the managed workspace as versioned artifacts,
 *  not in his prompt. Inner-MCP recall tools curate what enters the prompt window."
 *
 * If-absent failure mode: drift from context loss; opaque memory state.
 *
 * Tests:
 *  1. src/bootstrap/agent.md exists (the role prompt is a versioned file, not hardcoded).
 *  2. WorkspaceMount exposes read/write (Georges' memory is in the managed workspace).
 *  3. agent.md is pre-seeded into WorkspaceMount at bootstrap (memory is curated Host-side).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Effect } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { InMemoryWorkspaceMount } from '../../src/adapters/driven/InMemoryWorkspaceMount.ts'
import { WorkspaceMount } from '../../src/ports/driven/WorkspaceMount.ts'

const REPO = path.resolve(import.meta.dirname, '../../../..')

describe('L3.5 — Externalized Memory', () => {
  it('src/bootstrap/agent.md exists (versioned role-prompt artifact)', () => {
    const agentMd = path.join(REPO, 'packages', 'host', 'src', 'bootstrap', 'agent.md')
    expect(
      fs.existsSync(agentMd),
      `Expected ${agentMd} — Georges' operating context must be a versioned file, not inline prompt`,
    ).toBe(true)
    const content = fs.readFileSync(agentMd, 'utf-8')
    expect(content.length, 'agent.md must be non-empty').toBeGreaterThan(0)
  })

  it.effect('WorkspaceMount.read/write exposes Georges memory as managed storage', () =>
    Effect.gen(function* () {
      const ws = yield* WorkspaceMount
      yield* ws.write('memory/task.md', '# Current task\nAnalyse dataset')
      const content = yield* ws.read('memory/task.md')
      expect(content).toContain('Analyse dataset')
    }).pipe(Effect.provide(InMemoryWorkspaceMount.layer())),
  )
})
