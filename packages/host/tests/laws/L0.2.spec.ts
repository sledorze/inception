/**
 * Law L0.2 — Reflexivity.
 * "This SPEC and the laws-to-enforcement map are themselves versioned artifacts;
 *  changes follow the same promotion gate as any substrate change (L2.6)."
 *
 * If-absent failure mode: laws shift silently; outer-loop trust erodes; the constitution
 * cannot be amended at all or collapses to Claude-alone authority; the consensus protocol
 * harbours race/deadlock/liveness bugs invisible without model-checking.
 *
 * Tests:
 *  1. formal/promoter.tla exists (TLA+ spec for the promoter handshake — verified by tlc in CI).
 *  2. EventKind.Promoted is defined (promoter cannot emit a promotion without it).
 *  3. SPEC.md and SPEC-nav.md are in the repo (reflexivity artifacts are themselves versioned).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { EventKind } from '../../src/domain/events.ts'

const REPO = path.resolve(import.meta.dirname, '../../../..')

describe('L0.2 — Reflexivity', () => {
  it('formal/promoter.tla exists (TLA+ spec model-checked in CI)', () => {
    const tla = path.join(REPO, 'formal', 'promoter.tla')
    expect(
      fs.existsSync(tla),
      `Expected ${tla} to exist — L0.2 requires a formal spec for the promoter handshake`,
    ).toBe(true)
  })

  it('EventKind.Promoted is defined (promoter handshake cannot emit without it)', () => {
    expect(EventKind.Promoted).toBe('Promoted')
  })

  it('docs/SPEC.md exists (the SPEC is itself a versioned artifact)', () => {
    const spec = path.join(REPO, 'docs', 'SPEC.md')
    expect(fs.existsSync(spec), `Expected ${spec} to exist — SPEC is the versioned constitution`).toBe(true)
  })

  it('docs/SPEC-nav.md exists (laws-to-test mapping is a versioned artifact)', () => {
    const nav = path.join(REPO, 'docs', 'SPEC-nav.md')
    expect(fs.existsSync(nav), `Expected ${nav} to exist — SPEC-nav is the laws-to-enforcement map`).toBe(true)
  })
})
