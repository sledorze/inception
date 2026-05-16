import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@effect/vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')

// ── P38 green-step acceptance tests ──────────────────────────────────────────
// Pattern files promoted to .claude/commands/ and CLAUDE.md wired (TODO 10.3 done).

describe('P38 — critical pattern files promoted to .claude/commands/', () => {
  const commands = join(REPO_ROOT, '.claude', 'commands')

  it('effect-test-pattern command exists', () => {
    expect(existsSync(join(commands, 'effect-test-pattern.md'))).toBe(true)
  })

  it('schema-decode command exists', () => {
    expect(existsSync(join(commands, 'schema-decode.md'))).toBe(true)
  })

  it('composition-root command exists', () => {
    expect(existsSync(join(commands, 'composition-root.md'))).toBe(true)
  })

  it('CLAUDE.md "When in doubt" references /effect-test-pattern', () => {
    const claudeMd = readFileSync(join(REPO_ROOT, 'CLAUDE.md'), 'utf8')
    const section = claudeMd.slice(claudeMd.indexOf('When in doubt'))
    expect(section).toContain('/effect-test-pattern')
  })

  it('CLAUDE.md "When in doubt" references /schema-decode', () => {
    const claudeMd = readFileSync(join(REPO_ROOT, 'CLAUDE.md'), 'utf8')
    const section = claudeMd.slice(claudeMd.indexOf('When in doubt'))
    expect(section).toContain('/schema-decode')
  })

  it('CLAUDE.md "When in doubt" references /composition-root', () => {
    const claudeMd = readFileSync(join(REPO_ROOT, 'CLAUDE.md'), 'utf8')
    const section = claudeMd.slice(claudeMd.indexOf('When in doubt'))
    expect(section).toContain('/composition-root')
  })
})

// ── P40 green-step acceptance tests ──────────────────────────────────────────
// Shared base config now exists; all package oxlintrc files extend it.

describe('P40 — every package oxlint config extends shared baseline', () => {
  it('each packages/* directory has .oxlintrc.json extending a shared base', () => {
    const packagesDir = join(REPO_ROOT, 'packages')
    const packages = readdirSync(packagesDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)

    for (const pkg of packages) {
      const oxlintrc = join(packagesDir, pkg, '.oxlintrc.json')
      if (!existsSync(oxlintrc)) {
        continue
      }
      const config = JSON.parse(readFileSync(oxlintrc, 'utf8')) as Record<string, unknown>
      expect(
        config['extends'],
        `packages/${pkg}/.oxlintrc.json must have an "extends" field pointing to the shared base`,
      ).toBeDefined()
    }
  })
})
