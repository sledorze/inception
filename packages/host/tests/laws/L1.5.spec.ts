/**
 * Law L1.5 — Reversibility-by-Proposal.
 * "No substrate change takes effect until promoted through its gate."
 *
 * In the runtime, the PolicyGate IS the gate: every tool call must be
 * covered by an active policy entry before it executes. Deny by default.
 *
 * If-absent failure mode: tools execute regardless of whether a policy
 * covers them — new or promoted capabilities can be invoked without
 * any approval, bypassing the promoter handshake (L2.6).
 *
 * Tests:
 *  1. A tool call is denied when the PolicyGate has no entry for it.
 *  2. The denial message references the policy gate (not the role surface).
 *  3. After gate.permit(), the call executes and succeeds.
 *  4. Policy gate fires before role check — permitted tool + wrong role
 *     returns a role error, not a policy error.
 */
import { Effect, Layer, Option, Stream } from 'effect'
import { expect, layer } from '@effect/vitest'
import type { ToolEntry } from '../../src/adapters/driven/InMemoryToolRegistry.ts'
import { GeorgesToolkit } from '../../src/adapters/driving/GeorgesToolkit.ts'
import { PolicyGate } from '../../src/ports/driven/PolicyGate.ts'
import { makeToolkitComponents } from '../helpers/toolkitLayer.ts'

// Full tool registry — role checks can run normally.
const TOOLS: readonly ToolEntry[] = [
  { description: 'Discovers available tools.', inputSchema: { type: 'object' }, name: 'list-tools', roles: [] },
  {
    description: 'Reads a file from the workspace.',
    inputSchema: { type: 'object' },
    name: 'read-workspace',
    roles: ['Architect', 'Implementer', 'Reviewer'],
  },
  {
    description: 'Writes a file to the workspace.',
    inputSchema: { type: 'object' },
    name: 'write-workspace',
    roles: ['Implementer'],
  },
]

// Empty PolicyGate (permittedTools=[]) — deny by default.
const { policyGateLayer, toolkitLayer } = makeToolkitComponents(TOOLS, {}, [])
const testLayer = Layer.mergeAll(toolkitLayer, policyGateLayer)

const callTool = (name: string, params: Record<string, string>) =>
  Effect.gen(function* () {
    const toolkit = yield* GeorgesToolkit
    const stream = yield* toolkit.handle(name, params)
    const last = yield* Stream.runLast(stream)
    return Option.getOrThrow(last)
  })

layer(testLayer)('L1.5 — Policy gate (deny by default)', it => {
  it.effect('tool call is denied when PolicyGate has no entry for it', () =>
    Effect.gen(function* () {
      const result = yield* callTool('read-workspace', { path: 'f.txt' })
      expect(result.isFailure).toBeTruthy()
    }),
  )

  it.effect('denial message references the policy gate, not the role surface', () =>
    Effect.gen(function* () {
      const result = yield* callTool('list-tools', { role: 'Implementer' })
      expect(result.isFailure).toBeTruthy()
      expect((result.result as { message: string }).message).toContain('no active policy')
    }),
  )

  it.effect('after gate.permit(), the tool call executes and succeeds', () =>
    Effect.gen(function* () {
      const gate = yield* PolicyGate
      yield* gate.permit('list-tools')
      const result = yield* callTool('list-tools', { role: 'Implementer' })
      expect(result.isFailure).toBeFalsy()
    }),
  )

  it.effect('policy gate fires before role check — permitted tool + wrong role → role error', () =>
    Effect.gen(function* () {
      const gate = yield* PolicyGate
      yield* gate.permit('write-workspace')
      // Policy passes; role check (L2.2) fires next — Reviewer cannot write
      const result = yield* callTool('write-workspace', {
        content: 'x',
        path: 'f.txt',
        role: 'Reviewer',
      })
      expect(result.isFailure).toBeTruthy()
      const msg = (result.result as { message: string }).message
      expect(msg).toContain("'Reviewer'")
      expect(msg).not.toContain('no active policy')
    }),
  )
})
