/**
 * Law L2.16 — Prompt Regression.
 * "Role prompts are versioned artifacts in ContentStore. Each prompt blob carries an
 *  associated fixture set. Before any prompt change is promoted, the candidate prompt
 *  runs the fixture set in isolation."
 *
 * If-absent failure mode: prompt evolution becomes folk-art — improvements drift,
 * regressions land unobserved, and §4 cannot distinguish "better" from "louder."
 *
 * Tests:
 *  1. ContentStore.put/get round-trips a prompt blob by content hash.
 *  2. ContentStore.refSet/refGet tracks named refs (e.g. "prompt/Implementer/latest").
 *  3. agent.md is the current role-prompt artifact — it exists as a versioned file.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Effect } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { InMemoryContentStore } from '../../src/adapters/driven/InMemoryContentStore.ts'
import { ContentStore } from '../../src/ports/driven/ContentStore.ts'

const testLayer = InMemoryContentStore.layer
const REPO = path.resolve(import.meta.dirname, '../../../..')

describe('L2.16 — Prompt Regression', () => {
  it('src/bootstrap/agent.md exists (the current role-prompt artifact is versioned)', () => {
    const agentMd = path.join(REPO, 'packages', 'host', 'src', 'bootstrap', 'agent.md')
    expect(fs.existsSync(agentMd), `Expected ${agentMd} — agent.md is the versioned role prompt`).toBe(true)
  })

  it.effect('ContentStore.put/get round-trips a prompt blob by content hash', () =>
    Effect.gen(function* () {
      const store = yield* ContentStore
      const blob = new TextEncoder().encode('You are Georges, an AI inhabitant…')
      const hash = yield* store.put(blob)
      const retrieved = yield* store.get(hash)
      expect(retrieved).toBeDefined()
      expect(new TextDecoder().decode(retrieved)).toBe('You are Georges, an AI inhabitant…')
    }).pipe(Effect.provide(testLayer)),
  )

  it.effect('ContentStore.refSet/refGet tracks named prompt version refs', () =>
    Effect.gen(function* () {
      const store = yield* ContentStore
      const blob = new TextEncoder().encode('Prompt v2')
      const hash = yield* store.put(blob)
      yield* store.refSet('prompt/Implementer/latest', hash)
      const retrieved = yield* store.refGet('prompt/Implementer/latest')
      expect(retrieved).toBe(hash)
    }).pipe(Effect.provide(testLayer)),
  )
})
