/**
 * Law L3.8 — Calibration by Evidence.
 * "Every calibrated parameter ships as a bootstrap default flagged bootstrap=true.
 *  Refinement is driven by evidence the system produces by doing."
 *
 * If-absent failure mode: either the system stalls trying to negotiate parameters
 * before running, or initial guesses freeze into folklore.
 *
 * Tests:
 *  1. vitest.config.ts coverage thresholds exist (they are the calibrated quality gate).
 *  2. docs/SPEC.md §12 (Bootstrap inventory) exists (calibrations are documented).
 *  3. BudgetVectorSchema dimensions are documented as bootstrap defaults in SPEC.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO = path.resolve(import.meta.dirname, '../../../..')

describe('L3.8 — Calibration by Evidence', () => {
  it('docs/SPEC.md contains a §12 Bootstrap inventory section (calibrations are documented)', () => {
    const spec = path.join(REPO, 'docs', 'SPEC.md')
    expect(fs.existsSync(spec)).toBe(true)
    const content = fs.readFileSync(spec, 'utf-8')
    expect(content, 'Expected §12 Bootstrap inventory in SPEC.md — all calibrations must be rowed here').toContain(
      'Bootstrap inventory',
    )
  })

  it('SPEC.md uses bootstrap=true flag to mark initial calibrations', () => {
    const spec = path.join(REPO, 'docs', 'SPEC.md')
    const content = fs.readFileSync(spec, 'utf-8')
    expect(content, 'Expected bootstrap=true in SPEC.md — L3.8 requires calibrations to be so flagged').toContain(
      'bootstrap=true',
    )
  })

  it('vitest.config.ts coverage thresholds exist (the ratcheted quality-gate calibration)', () => {
    const config = path.join(REPO, 'vitest.config.ts')
    const content = fs.readFileSync(config, 'utf-8')
    expect(content).toContain('thresholds')
  })
})
