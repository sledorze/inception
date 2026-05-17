import { describe, expect, it } from '@effect/vitest'
import { buildInitialMessages } from '../../src/application/submitGoal.ts'

// ── P42 green-step acceptance tests ──────────────────────────────────────────
// Verifies that buildInitialMessages produces a system message containing the
// agent's tool brief and handle schema. These tests replace the it.todo stubs
// committed in the red-step (docs(P42,P43)). Cited in docs/PAIN-archive.md.

describe('buildInitialMessages includes full agent brief (P42)', () => {
  const brief = {
    agentMd: 'You are Georges.',
    goal: 'What is synthetic-001?',
    handles: [{ id: 'synthetic-001', redactedSample: { id: 1, value: 'x' }, schema: { columns: ['id', 'value'] } }],
    role: 'enduser',
    tools: [
      { description: 'List the tools available to you.', name: 'list-tools' },
      { description: 'Fetch the shape of a data handle.', name: 'fetch-handle-shape' },
    ],
  }

  it('system message contains every tool name', () => {
    const messages = buildInitialMessages(brief)
    const system = messages.find(m => m.role === 'system')
    expect(typeof system?.content).toBe('string')
    const text = system?.content as string
    expect(text).toContain('list-tools')
    expect(text).toContain('fetch-handle-shape')
  })

  it('system message contains the handle id and schema', () => {
    const messages = buildInitialMessages(brief)
    const system = messages.find(m => m.role === 'system')
    const text = system?.content as string
    expect(text).toContain('synthetic-001')
    // Schema JSON is embedded — column names must appear
    expect(text).toContain('id')
    expect(text).toContain('value')
  })

  it('first user message contains the bare goal text', () => {
    const messages = buildInitialMessages(brief)
    const user = messages.find(m => m.role === 'user')
    const content = JSON.stringify(user?.content)
    expect(content).toContain('What is synthetic-001?')
  })

  it('system message contains the active role', () => {
    const messages = buildInitialMessages(brief)
    const system = messages.find(m => m.role === 'system')
    const text = system?.content as string
    expect(text).toContain('enduser')
  })

  it('system message contains the MUST-call-tools directive', () => {
    const messages = buildInitialMessages(brief)
    const system = messages.find(m => m.role === 'system')
    const text = system?.content as string
    expect(text).toContain('MUST')
    expect(text).toContain('list-tools')
  })
})
