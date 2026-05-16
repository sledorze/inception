/**
 * Law L2.14 — Ports over Implementations.
 * "Every cross-boundary capability is consumed via a typed port. Ports come in two classes:
 *  driving ports (outside calls in) and driven ports (Host calls out). Concrete adapters
 *  are bound at boot."
 *
 * If-absent failure mode: every "we'll try this" becomes a refactor; primary/secondary
 * concerns leak into each other.
 *
 * Tests:
 *  1. ports/driving/ and ports/driven/ directories exist (hexagonal structure enforced).
 *  2. adapters/driving/ and adapters/driven/ directories exist.
 *  3. .dependency-cruiser.cjs exists with deny rules (enforced by dep-cruiser in CI).
 *  4. runtime/bind.ts exists (the composition root — adapters bound at boot only here).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'

const HOST_SRC = path.resolve(import.meta.dirname, '../../src')
const REPO = path.resolve(import.meta.dirname, '../../../..')

describe('L2.14 — Ports over Implementations', () => {
  it('ports/driving/ directory exists (inbound port layer)', () => {
    expect(fs.existsSync(path.join(HOST_SRC, 'ports', 'driving'))).toBe(true)
  })

  it('ports/driven/ directory exists (outbound port layer)', () => {
    expect(fs.existsSync(path.join(HOST_SRC, 'ports', 'driven'))).toBe(true)
  })

  it('adapters/driving/ directory exists (inbound adapter implementations)', () => {
    expect(fs.existsSync(path.join(HOST_SRC, 'adapters', 'driving'))).toBe(true)
  })

  it('adapters/driven/ directory exists (outbound adapter implementations)', () => {
    expect(fs.existsSync(path.join(HOST_SRC, 'adapters', 'driven'))).toBe(true)
  })

  it('runtime/bind.ts exists (the single composition root)', () => {
    expect(fs.existsSync(path.join(HOST_SRC, 'runtime', 'bind.ts'))).toBe(true)
  })

  it('.dependency-cruiser.cjs exists with deny rules (enforced in CI)', () => {
    const dcrc = path.join(REPO, '.dependency-cruiser.cjs')
    expect(fs.existsSync(dcrc), `Expected ${dcrc} to exist — dep-cruiser enforces L2.14 hex boundary`).toBe(true)
    const content = fs.readFileSync(dcrc, 'utf-8')
    expect(content, 'Expected deny rules in .dependency-cruiser.cjs').toContain('deny')
    expect(content, 'Expected adapters/ boundary in .dependency-cruiser.cjs').toContain('adapters')
  })
})
