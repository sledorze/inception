/**
 * Law L2.4 — Ratcheting.
 * "Quality gates ratchet only tighter, never looser, with two exceptions:
 *  (a) an explicit Claude-signed rollback event; (b) the first L3.8 promotion of a
 *  calibration flagged bootstrap=true."
 *
 * If-absent failure mode: slow erosion of safety, or bootstrap thresholds calcify into folklore.
 *
 * Tests:
 *  1. vitest.config.ts defines non-zero coverage thresholds (the ratchet has a floor).
 *  2. All four coverage dimensions are set (branches, functions, lines, statements).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO = path.resolve(import.meta.dirname, '../../../..')

describe('L2.4 — Ratcheting', () => {
  it('vitest.config.ts defines coverage thresholds (the ratchet has a floor)', () => {
    const config = path.join(REPO, 'vitest.config.ts')
    expect(fs.existsSync(config), `Expected ${config} to exist`).toBe(true)
    const content = fs.readFileSync(config, 'utf-8')
    expect(content, 'Expected vitest.config.ts to define thresholds').toContain('thresholds')
  })

  it('all four coverage dimensions are set (branches, functions, lines, statements)', () => {
    const config = path.join(REPO, 'vitest.config.ts')
    const content = fs.readFileSync(config, 'utf-8')
    for (const dim of ['branches', 'functions', 'lines', 'statements']) {
      expect(content, `Expected coverage dimension '${dim}' in vitest.config.ts`).toContain(dim)
    }
  })

  it('coverage thresholds are greater than zero (ratchet is not degenerate)', () => {
    const config = path.join(REPO, 'vitest.config.ts')
    const content = fs.readFileSync(config, 'utf-8')
    // Extract numeric thresholds and verify none are zero
    const thresholdMatches = [...content.matchAll(/(?:branches|functions|lines|statements):\s*(\d+)/g)]
    expect(thresholdMatches.length, 'Expected at least one numeric threshold in vitest.config.ts').toBeGreaterThan(0)
    for (const match of thresholdMatches) {
      const value = Number(match[1])
      expect(value, `Expected non-zero threshold, found ${value}`).toBeGreaterThan(0)
    }
  })
})
