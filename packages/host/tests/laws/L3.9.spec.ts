/**
 * Law L3.9 — Assessment Frame.
 * "Every cycle's stated goal carries an assessmentFrame with: success criteria, concern tag,
 *  experts consulted, existing-tool search, risk dimensions, ROI estimate, lock-in, measurement."
 *
 * If-absent failure mode: work begins without measurable success criteria; selection has no
 * anchor; the loop optimises for "we tried something" instead of "we achieved the stated outcome."
 *
 * Tests:
 *  1. docs/CLAUDE.md documents the per-task ritual (assessment frame is a process requirement).
 *  2. SPEC.md §14 Per-domain artifact standards exists (concern tags → artifact format mapping).
 *  3. The assessment frame ritual is encoded in CLAUDE.md working practices section.
 *
 * NOTE: Automated assessment-frame validation on submitGoal is aspirational — the Host
 * currently records GoalSubmitted without validating an attached assessmentFrame struct.
 * These tests verify the process scaffolding is in place.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO = path.resolve(import.meta.dirname, '../../../..')

describe('L3.9 — Assessment Frame', () => {
  it('CLAUDE.md documents the per-task ritual (assessment frame is a process requirement)', () => {
    const claudeMd = path.join(REPO, 'CLAUDE.md')
    expect(fs.existsSync(claudeMd)).toBe(true)
    const content = fs.readFileSync(claudeMd, 'utf-8')
    expect(content, 'Expected assessment frame ritual in CLAUDE.md').toContain('assessmentFrame')
  })

  it('docs/SPEC.md contains a §14 Per-domain artifact standards section (concern tag mapping)', () => {
    const spec = path.join(REPO, 'docs', 'SPEC.md')
    const content = fs.readFileSync(spec, 'utf-8')
    expect(
      content,
      'Expected §14 Per-domain artifact standards in SPEC.md — concern tags must map to artifact formats',
    ).toContain('Per-domain artifact')
  })

  it('CLAUDE.md includes success criteria and concern tag in the assessment frame definition', () => {
    const claudeMd = path.join(REPO, 'CLAUDE.md')
    const content = fs.readFileSync(claudeMd, 'utf-8')
    expect(content).toContain('Success criteria')
    expect(content).toContain('Concern tag')
  })
})
