/**
 * Unit tests for parseTodoMd — contract-tested against live docs/TODO.md.
 * Kleppmann invariant: markdown drift breaks parsers silently; the live-doc test catches it.
 */
// @effect-diagnostics-next-line nodeBuiltinImport:off
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseTodoMd } from '../../src/domain/todoParser.ts'

const TODO_MD_PATH = new URL('../../../../docs/TODO.md', import.meta.url).pathname

const VALID_STATUSES = ['todo', 'in-progress', 'done', 'blocked', 'parked'] as const

describe('parseTodoMd', () => {
  it('returns an array', () => {
    expect(Array.isArray(parseTodoMd(''))).toBe(true)
  })

  it('parses a minimal TODO line', () => {
    const md = `## Phase 1\n- [todo] **1.1** Do something\n`
    const items = parseTodoMd(md)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: '1.1', phase: '1', status: 'todo', title: 'Do something' })
  })

  it('assigns phase label from nearest preceding ## Phase header', () => {
    const md = `## Phase Alpha\n- [done] **1.1** First\n## Phase Beta\n- [in-progress] **2.1** Second\n`
    const items = parseTodoMd(md)
    expect(items[0]?.phase).toBe('Alpha')
    expect(items[1]?.phase).toBe('Beta')
  })

  it('skips lines that do not match the item pattern', () => {
    const md = `## Phase 2\nSome prose.\n- [todo] **2.1** Valid item\n- not an item\n`
    const items = parseTodoMd(md)
    expect(items).toHaveLength(1)
  })

  it('all items from live docs/TODO.md have id, phase, title, and a valid status', () => {
    const md = readFileSync(TODO_MD_PATH, 'utf-8')
    const items = parseTodoMd(md)
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(typeof item.id).toBe('string')
      expect(item.id.length).toBeGreaterThan(0)
      expect(typeof item.phase).toBe('string')
      expect(typeof item.title).toBe('string')
      expect(item.title.length).toBeGreaterThan(0)
      expect(VALID_STATUSES).toContain(item.status)
    }
  })
})
