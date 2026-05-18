import { describe, expect, it } from '@effect/vitest'
import { buildInitialMessages } from '../../src/application/submitGoal.ts'

// ── P42 green-step acceptance tests ──────────────────────────────────────────
// Verifies that buildInitialMessages produces a correctly-split prompt:
//   messages[0] = static agent.md root (byte-identical cross-session)
//   messages[1] = volatile session brief (role + handle schemas, no tool prose, no sample)
//   messages[2] = user goal

describe('buildInitialMessages — split prompt layout (P42 / cache-prefix)', () => {
  const brief = {
    agentMd: 'You are Georges.',
    goal: 'What is synthetic-001?',
    handles: [{ id: 'synthetic-001', redactedSample: { id: 1, value: 'x' }, schema: { columns: ['id', 'value'] } }],
    priorTurns: [] as { goal: string; reply: string }[],
    role: 'enduser',
    tools: [
      { description: 'List the tools available to you.', name: 'list-tools' },
      { description: 'Fetch the shape of a data handle.', name: 'fetch-handle-shape' },
    ],
  }

  it('messages[0] is the static agent.md root — content equals brief.agentMd verbatim', () => {
    const messages = buildInitialMessages(brief)
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toBe(brief.agentMd)
  })

  it('messages[0] is byte-identical regardless of handles, role, or goal', () => {
    const a = buildInitialMessages(brief)
    const b = buildInitialMessages({ ...brief, goal: 'Another goal', handles: [], role: 'analyst' })
    expect(a[0].content).toBe(b[0].content)
  })

  it('messages[1] is the session brief and contains the active role', () => {
    const messages = buildInitialMessages(brief)
    expect(messages[1].role).toBe('system')
    const text = messages[1].content as string
    expect(text).toContain('enduser')
  })

  it('messages[1] contains the handle id and schema columns', () => {
    const messages = buildInitialMessages(brief)
    const text = messages[1].content as string
    expect(text).toContain('synthetic-001')
    expect(text).toContain('id')
    expect(text).toContain('value')
  })

  it('messages[1] contains tool names via the directive (structural, not prose list)', () => {
    const messages = buildInitialMessages(brief)
    const text = messages[1].content as string
    expect(text).toContain('list-tools')
    expect(text).toContain('fetch-handle-shape')
  })

  it('messages[1] contains the MUST-call-tools directive', () => {
    const messages = buildInitialMessages(brief)
    const text = messages[1].content as string
    expect(text).toContain('MUST')
  })

  it('redactedSample value is absent from all system messages', () => {
    const messages = buildInitialMessages(brief)
    const systemTexts = messages.filter(m => m.role === 'system').map(m => m.content as string)
    for (const text of systemTexts) {
      expect(text).not.toContain('"id":1')
      expect(text).not.toContain('"value":"x"')
    }
  })

  it('messages[1] schema rendering is deterministic regardless of key insertion order', () => {
    const briefA = { ...brief, handles: [{ id: 'h', redactedSample: {}, schema: { a: 1, b: 2 } }] }
    const briefB = { ...brief, handles: [{ id: 'h', redactedSample: {}, schema: { a: 1, b: 2 } }] }
    const msgsA = buildInitialMessages(briefA)
    const msgsB = buildInitialMessages(briefB)
    expect(msgsA[1].content).toBe(msgsB[1].content)
  })

  it('messages[2] (user) contains the bare goal text', () => {
    const messages = buildInitialMessages(brief)
    const content = JSON.stringify(messages[2]?.content)
    expect(content).toContain('What is synthetic-001?')
  })

  it('produces exactly 3 messages when priorTurns is empty: [system, system, user]', () => {
    const messages = buildInitialMessages(brief)
    expect(messages).toHaveLength(3)
    expect(messages[0].role).toBe('system')
    expect(messages[1].role).toBe('system')
    expect(messages[2].role).toBe('user')
  })

  it('interleaves priorTurns as user/assistant pairs between brief and current goal (oldest→newest)', () => {
    const withPrior = {
      ...brief,
      priorTurns: [
        { goal: 'Turn 1 goal', reply: 'Turn 1 reply' },
        { goal: 'Turn 2 goal', reply: 'Turn 2 reply' },
      ],
    }
    const messages = buildInitialMessages(withPrior)
    // [0] agent.md, [1] brief, [2] T1-user, [3] T1-assistant, [4] T2-user, [5] T2-assistant, [6] current-user
    expect(messages).toHaveLength(7)
    expect(messages[2].role).toBe('user')
    expect(JSON.stringify(messages[2].content)).toContain('Turn 1 goal')
    expect(messages[3].role).toBe('assistant')
    expect(JSON.stringify(messages[3].content)).toContain('Turn 1 reply')
    expect(messages[4].role).toBe('user')
    expect(JSON.stringify(messages[4].content)).toContain('Turn 2 goal')
    expect(messages[5].role).toBe('assistant')
    expect(JSON.stringify(messages[5].content)).toContain('Turn 2 reply')
    expect(messages[6].role).toBe('user')
    expect(JSON.stringify(messages[6].content)).toContain('What is synthetic-001?')
  })
})
