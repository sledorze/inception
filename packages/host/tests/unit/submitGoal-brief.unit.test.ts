import { describe, it } from '@effect/vitest'

// ── P42 red-step acceptance tests ────────────────────────────────────────────
// buildInitialMessages does not exist yet. Tests are marked `it.todo` until the
// green commit exports the pure function. Replace with real assertions and cite
// this file in docs/PAIN-archive.md when closing P42.

describe('buildInitialMessages includes full agent brief (P42)', () => {
  it.todo('system message contains every tool name')
  it.todo('system message contains the handle id and schema')
  it.todo('first user message contains the bare goal text')
})
