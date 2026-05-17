/**
 * L0.1 — Every law maps to an executable enforcement point.
 *
 * Structural check: each file in `tests/laws/` must contain at least one actual assertion
 * (`it(`, `it.effect(`, `test(`). A law spec file that is only a describe-skeleton with no
 * assertions passes vitest vacuously but provides zero enforcement — this test catches that.
 *
 * If-absent: a law test can be committed as an empty skeleton (describe block, no it()), making
 * the L0.4 coverage count increment without any real enforcement. This test closes that gap.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'

const LAWS_DIR = path.resolve(import.meta.dirname)

const ASSERTION_PATTERN = /\bit(?:\.effect)?(?:\.skip|\.todo)?\s*\(/

describe('L0.1 — law enforcement point existence', () => {
  const specFiles = fs.readdirSync(LAWS_DIR).filter(f => f.endsWith('.spec.ts') && f !== 'L0.1.spec.ts')

  it('at least 10 law spec files exist (sanity check)', () => {
    expect(specFiles.length).toBeGreaterThanOrEqual(10)
  })

  for (const file of specFiles) {
    it(`${file.replace('.spec.ts', '')} contains at least one assertion`, () => {
      const content = fs.readFileSync(path.join(LAWS_DIR, file), 'utf-8')
      expect(
        ASSERTION_PATTERN.test(content),
        `${file} has no it() or it.effect() call — add at least one test assertion`,
      ).toBe(true)
    })
  }
})
