/**
 * Unit tests for parsePainMd — contract-tested against live docs/PAIN.md.
 * Kleppmann invariant: markdown drift breaks parsers silently; the live-doc test catches it.
 */
// @effect-diagnostics-next-line nodeBuiltinImport:off
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parsePainMd } from '../../src/domain/painParser.ts'

const PAIN_MD_PATH = new URL('../../../../docs/PAIN.md', import.meta.url).pathname

describe('parsePainMd', () => {
  it('returns an array', () => {
    expect(Array.isArray(parsePainMd(''))).toBe(true)
  })

  it('parses a minimal PAIN block', () => {
    const md = `## P1 — Some problem\n**Severity:** high\nSome detail.\n`
    const items = parsePainMd(md)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: 'P1', severity: 'high', status: 'open', title: 'Some problem' })
  })

  it('falls back to "unknown" severity when no Severity field', () => {
    const md = `## P2 — No severity\nJust text.\n`
    const items = parsePainMd(md)
    expect(items[0]?.severity).toBe('unknown')
  })

  it('skips non-P-prefixed sections', () => {
    const md = `## Overview\nSome intro.\n## P3 — Real item\n**Severity:** low\n`
    const items = parsePainMd(md)
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe('P3')
  })

  it('all items from live docs/PAIN.md have id, title, status=open, severity', () => {
    const md = readFileSync(PAIN_MD_PATH, 'utf-8')
    const items = parsePainMd(md)
    // Zero items is valid — an empty PAIN.md is the goal state.
    for (const item of items) {
      expect(typeof item.id).toBe('string')
      expect(item.id.length).toBeGreaterThan(0)
      expect(typeof item.title).toBe('string')
      expect(item.title.length).toBeGreaterThan(0)
      expect(item.status).toBe('open')
      expect(typeof item.severity).toBe('string')
    }
  })
})
