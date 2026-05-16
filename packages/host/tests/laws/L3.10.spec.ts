/**
 * Law L3.10 — Defence-in-Depth across Trust Domains.
 * "Every Tier-1 law has at least one enforcement point that runs outside the Host's trust domain.
 *  Single-domain enforcement is forbidden for Tier-1."
 *
 * If-absent failure mode: a single Host bug simultaneously disables every Tier-1 defence
 * (R5 — sandbox-escape — becomes a constitutional crisis instead of a contained incident).
 *
 * Tests:
 *  1. packages/monitor/ exists as a separate package (out-of-process trust domain).
 *  2. packages/monitor/package.json exists with its own package name (structural isolation).
 *  3. kernel/ directory exists (External Witness pool — third trust domain per L0.5).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO = path.resolve(import.meta.dirname, '../../../..')

describe('L3.10 — Defence-in-Depth across Trust Domains', () => {
  it('packages/monitor/ exists as a separate package (second trust domain — out-of-process)', () => {
    const monitorDir = path.join(REPO, 'packages', 'monitor')
    expect(
      fs.existsSync(monitorDir),
      `Expected packages/monitor/ to exist — L3.10 requires an out-of-domain Monitor process`,
    ).toBe(true)
    expect(fs.statSync(monitorDir).isDirectory()).toBe(true)
  })

  it('packages/monitor/package.json has its own package name (structurally separate from Host)', () => {
    const monitorPkg = path.join(REPO, 'packages', 'monitor', 'package.json')
    expect(fs.existsSync(monitorPkg), `Expected ${monitorPkg} to exist`).toBe(true)
    const pkg = JSON.parse(fs.readFileSync(monitorPkg, 'utf-8')) as { name: string }
    expect(pkg.name, 'Monitor must have its own package name (trust-domain isolation)').toBeTruthy()
    expect(pkg.name).not.toBe('@app/host')
  })

  it('kernel/ directory exists (External Witness pool — third trust domain per L0.5)', () => {
    const kernelDir = path.join(REPO, 'kernel')
    expect(
      fs.existsSync(kernelDir),
      `Expected kernel/ to exist — L3.10 requires the Witness pool as a third trust domain`,
    ).toBe(true)
  })

  it('packages/monitor/src/ exists (Monitor has its own source — not shared with Host)', () => {
    const monitorSrc = path.join(REPO, 'packages', 'monitor', 'src')
    expect(
      fs.existsSync(monitorSrc),
      `Expected packages/monitor/src/ to exist — Monitor is an independent process`,
    ).toBe(true)
  })
})
