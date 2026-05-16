import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@effect/vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')

// ── P38 red-step acceptance tests ─────────────────────────────────────────────
// Pattern files are passive docs not surfaced at the point of decision.
// Fix (TODO 10.3): promote to .claude/commands/ slash commands + wire CLAUDE.md.
//
// Skipped: commands do not exist yet. Remove .skip in TODO 10.3 once the promotion lands.
describe.skip('P38 red step — critical pattern files promoted to .claude/commands/', () => {
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
