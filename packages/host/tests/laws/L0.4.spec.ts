/**
 * L0.4 — Every law in SPEC §3 must have a paired test file in `tests/laws/<id>.spec.ts`.
 *
 * This test is self-enforcing: it reads all law IDs from docs/SPEC-nav.md, then asserts each has
 * a corresponding spec file. It fails as long as any law lacks coverage, and tracks convergence
 * automatically as new law tests are added.
 *
 * If-absent: law drift goes undetected — a law can be added to SPEC-nav.md without anyone noticing
 * it has no enforcement test. This test closes that gap.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'

const SPEC_NAV = path.resolve(import.meta.dirname, '../../../../docs/SPEC-nav.md')
const LAWS_DIR = path.resolve(import.meta.dirname)

function extractLawIds(content: string): readonly string[] {
  const ids: string[] = []
  for (const match of content.matchAll(/\bL(\d+)\.(\d+)\b/g)) {
    const id = `L${match[1]}.${match[2]}`
    if (!ids.includes(id)) {
      ids.push(id)
    }
  }
  return ids.sort()
}

describe('L0.4 — law test existence', () => {
  const navContent = fs.readFileSync(SPEC_NAV, 'utf-8')
  const lawIds = extractLawIds(navContent)
  const existingFiles = new Set(fs.readdirSync(LAWS_DIR).filter(f => f.endsWith('.spec.ts')))

  it('SPEC-nav.md contains at least 30 law IDs (sanity check)', () => {
    expect(lawIds.length).toBeGreaterThanOrEqual(30)
  })

  it('reports coverage percentage', () => {
    const covered = lawIds.filter(id => existingFiles.has(`${id}.spec.ts`))
    const pct = Math.round((covered.length / lawIds.length) * 100)
    // This is informational — not a hard assertion. The per-law tests below are the gate.
    console.log(`Law test coverage: ${pct}% (${covered.length}/${lawIds.length} laws)`)
    const missing = lawIds.filter(id => !existingFiles.has(`${id}.spec.ts`))
    if (missing.length > 0) {
      console.log(`Missing: ${missing.join(', ')}`)
    }
  })

  // One assertion per law — fails individually so the output shows exactly which laws are missing.
  for (const id of lawIds) {
    it(`${id} has a paired spec file`, () => {
      expect(existingFiles.has(`${id}.spec.ts`), `Missing tests/laws/${id}.spec.ts — add a law test per L0.4`).toBe(
        true,
      )
    })
  }
})
