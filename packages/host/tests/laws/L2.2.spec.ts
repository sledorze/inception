/**
 * Law L2.2 — Bounded Mutability.
 * "What Georges may change is itself a versioned artifact — the mutability manifest.
 *  Widening it is a substrate change requiring L2.6."
 *
 * If-absent failure mode: self-improvement drifts unbounded.
 *
 * Tests:
 *  1. src/bootstrap/tools.yaml exists (the mutability manifest — versioned in the repo).
 *  2. write-workspace requires role membership — callers outside the manifest are rejected.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Effect, Layer, Stream, Option } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import type { ToolEntry } from '../../src/adapters/driven/InMemoryToolRegistry.ts'
import { GeorgesToolkit } from '../../src/adapters/driving/GeorgesToolkit.ts'
import { makeToolkitComponents } from '../helpers/toolkitLayer.ts'

const REPO = path.resolve(import.meta.dirname, '../../../..')

const TOOLS: readonly ToolEntry[] = [
  { description: 'Lists tools.', inputSchema: { type: 'object' }, name: 'list-tools', roles: [] },
  {
    description: 'Writes a workspace file.',
    inputSchema: { type: 'object' },
    name: 'write-workspace',
    roles: ['Implementer'],
  },
]

const { storeLayer, toolkitLayer } = makeToolkitComponents(TOOLS)
const testLayer = Layer.mergeAll(toolkitLayer, storeLayer)

describe('L2.2 — Bounded Mutability', () => {
  it('src/bootstrap/tools.yaml exists (versioned mutability manifest)', () => {
    const manifest = path.join(REPO, 'packages', 'host', 'src', 'bootstrap', 'tools.yaml')
    expect(fs.existsSync(manifest), `Expected ${manifest} — tools.yaml is the L2.2 mutability manifest`).toBe(true)
  })

  it.effect('write-workspace rejects callers outside the tool surface (role not in manifest)', () =>
    Effect.gen(function* () {
      const toolkit = yield* GeorgesToolkit
      const stream = yield* toolkit.handle('write-workspace', {
        content: 'test',
        path: 'test.txt',
        role: 'Reviewer',
      })
      const last = yield* Stream.runLast(stream)
      const result = Option.getOrThrow(last)
      expect(result.isFailure).toBeTruthy()
      expect((result.result as { message: string }).message).toContain('Permission denied')
    }).pipe(Effect.provide(testLayer)),
  )
})
