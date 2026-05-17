import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@effect/vitest'

function collectTsxFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return []
  }
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectTsxFiles(full))
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      files.push(full)
    }
  }
  return files
}

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

// ── Atom API enforcement ──────────────────────────────────────────────────────
// useAsyncFetch deleted; @effect/atom-react is the canonical async-data pattern.

describe('Atom API enforcement — useAsyncFetch must not exist', () => {
  it('packages/app does not contain a useAsyncFetch file', () => {
    expect(existsSync(join(REPO_ROOT, 'packages', 'app', 'src', 'hooks', 'useAsyncFetch.ts'))).toBe(false)
  })

  it('packages/backoffice does not contain a useAsyncFetch file', () => {
    expect(existsSync(join(REPO_ROOT, 'packages', 'backoffice', 'src', 'hooks', 'useAsyncFetch.ts'))).toBe(false)
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

// ── P43 green-step acceptance tests ──────────────────────────────────────────
// SubmitGoal deleted — Conversation is the single conversational surface.

describe('App renders a single goal-submission surface (P43)', () => {
  it('SubmitGoal.tsx does not exist (redundant surface deleted)', () => {
    expect(existsSync(join(REPO_ROOT, 'packages', 'app', 'src', 'components', 'app', 'SubmitGoal.tsx'))).toBe(false)
  })

  it('App.tsx does not import SubmitGoal', () => {
    const appSrc = readFileSync(join(REPO_ROOT, 'packages', 'app', 'src', 'App.tsx'), 'utf8')
    expect(appSrc).not.toContain('SubmitGoal')
  })
})

// ── P48 GREEN — handleErr lives only in @app/shared-api (TODO 10.11) ─────────
// Extracted to packages/shared-api/src/index.ts; app and backoffice re-export via auth.ts.

describe('Frontend api layer: handleErr declared in exactly one file (P48)', () => {
  it('handleErr is not re-declared in packages/app or packages/backoffice api/ dirs', () => {
    const apiDirs = [
      join(REPO_ROOT, 'packages', 'app', 'src', 'api'),
      join(REPO_ROOT, 'packages', 'backoffice', 'src', 'api'),
    ]
    const duplicates: string[] = []
    for (const dir of apiDirs) {
      if (!existsSync(dir)) {
        continue
      }
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile() || (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx'))) {
          continue
        }
        const src = readFileSync(join(dir, entry.name), 'utf8')
        if (src.includes('const handleErr') || src.includes('function handleErr')) {
          duplicates.push(join(dir, entry.name).replace(`${REPO_ROOT}/`, ''))
        }
      }
    }
    expect(
      duplicates,
      'handleErr duplicated in app or backoffice api/ — must live only in @app/shared-api',
    ).toHaveLength(0)
  })

  it('handleErr is defined in packages/shared-api/src/index.ts', () => {
    const sharedSrc = readFileSync(join(REPO_ROOT, 'packages', 'shared-api', 'src', 'index.ts'), 'utf8')
    expect(sharedSrc.includes('const handleErr') || sharedSrc.includes('function handleErr')).toBe(true)
  })
})

// ── P41 green-step acceptance tests ──────────────────────────────────────────
// State interpretation belongs in atoms.ts, not in presentation components.
// GREEN as of TODO 10.5 (2026-05-17): AsyncView<T> + Atom.map + it.fails removed.

describe('Frontend presentation components must not interpret async state (P41)', () => {
  const componentDirs = [
    join(REPO_ROOT, 'packages', 'backoffice', 'src', 'components'),
    join(REPO_ROOT, 'packages', 'app', 'src', 'components'),
  ]

  it('no component .tsx interprets AsyncResult/Cause directly', () => {
    const forbidden = [
      'AsyncResult.isSuccess(',
      'AsyncResult.isFailure(',
      "from 'effect/unstable/reactivity/AsyncResult'",
      'Cause.squash(',
    ]
    const violations: string[] = []
    for (const dir of componentDirs) {
      for (const file of collectTsxFiles(dir)) {
        const src = readFileSync(file, 'utf8')
        if (forbidden.some(token => src.includes(token))) {
          violations.push(file.replace(`${REPO_ROOT}/`, ''))
        }
      }
    }
    expect(violations, 'state-interpretation in component files — move to atoms.ts').toEqual([])
  })

  it('no component .tsx contains promise chaining (.then)', () => {
    const violations: string[] = []
    for (const dir of componentDirs) {
      for (const file of collectTsxFiles(dir)) {
        const src = readFileSync(file, 'utf8')
        if (src.includes('.then(')) {
          violations.push(file.replace(`${REPO_ROOT}/`, ''))
        }
      }
    }
    expect(violations, 'promise chaining in component files — use atom + useAtomRefresh').toEqual([])
  })
})
