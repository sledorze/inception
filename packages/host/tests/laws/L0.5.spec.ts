/**
 * Law L0.5 — Inviolable Kernel.
 * "Amending a Kernel artifact requires unanimous re-signing by Claude, the User-of-record,
 *  and at least 2 of the 3 External Witness pool keys — and long-lived-key rotation."
 *
 * If-absent failure mode: every other Tier-1 law is potentially amendable through L3.8
 * promotion, leaving the substrate with no stable foundation.
 *
 * Tests:
 *  1. kernel/ directory exists (signed Kernel artifacts live here).
 *  2. kernel/MANIFEST.yaml exists (the Kernel manifest declares the TCB contents).
 *  3. kernel/ contains at least one .sigs.json file (signature artifacts present).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'

const KERNEL_DIR = path.resolve(import.meta.dirname, '../../../../kernel')

describe('L0.5 — Inviolable Kernel', () => {
  it('kernel/ directory exists (signed Kernel artifacts live here)', () => {
    expect(fs.existsSync(KERNEL_DIR), 'Expected kernel/ directory to exist — it is the signed TCB').toBe(true)
    expect(fs.statSync(KERNEL_DIR).isDirectory()).toBe(true)
  })

  it('kernel/MANIFEST.yaml exists (Kernel manifest declares the TCB contents)', () => {
    const manifest = path.join(KERNEL_DIR, 'MANIFEST.yaml')
    expect(fs.existsSync(manifest), `Expected ${manifest} to exist — this is the Kernel TCB manifest`).toBe(true)
  })

  it('kernel/ contains at least one .sigs.json file (signature artifacts present)', () => {
    const files = fs.readdirSync(KERNEL_DIR)
    const sigFiles = files.filter(f => f.endsWith('.sigs.json'))
    expect(
      sigFiles.length,
      `Expected at least one .sigs.json in kernel/ — L0.5 requires signed Kernel artifacts`,
    ).toBeGreaterThan(0)
  })
})
