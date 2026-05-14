import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, beforeAll, describe, expect, it } from '@effect/vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const OXLINT_BIN = join(REPO_ROOT, 'node_modules', '.bin', 'oxlint')

let FIXTURE_DIR: string

beforeAll(() => {
  FIXTURE_DIR = join(tmpdir(), `oxlint-rules-${Date.now()}`)
  mkdirSync(join(FIXTURE_DIR, 'packages', 'host', 'src', 'adapters', 'driven'), { recursive: true })
  mkdirSync(join(FIXTURE_DIR, 'packages', 'host', 'src', 'application'), { recursive: true })
  mkdirSync(join(FIXTURE_DIR, 'packages', 'host', 'tests', 'unit'), { recursive: true })
})

afterAll(() => {
  rmSync(FIXTURE_DIR, { force: true, recursive: true })
})

function lint(relPath: string, src: string): { exitCode: number; stdout: string } {
  const absPath = join(FIXTURE_DIR, relPath)
  writeFileSync(absPath, src)
  const result = spawnSync(OXLINT_BIN, ['--config', join(REPO_ROOT, '.oxlintrc.json'), relPath], {
    cwd: FIXTURE_DIR,
    encoding: 'utf8',
  })
  return { exitCode: result.status ?? 1, stdout: (result.stdout ?? '') + (result.stderr ?? '') }
}

// ── no-restricted-imports — node:* built-ins matrix ──────────────────────────

const nodeImportProbes: { fn: string; module: string; expected: string }[] = [
  { expected: 'FileSystem', fn: 'readFileSync', module: 'node:fs' },
  { expected: 'FileSystem', fn: 'readFile', module: 'node:fs/promises' },
  { expected: 'Path', fn: 'join', module: 'node:path' },
  { expected: 'Command', fn: 'execFile', module: 'node:child_process' },
  { expected: 'HttpServer', fn: 'createServer', module: 'node:http' },
  { expected: 'Url', fn: 'fileURLToPath', module: 'node:url' },
]

describe('no-restricted-imports — node:* in packages/host/src/', () => {
  it.each(nodeImportProbes)('warns on $module import in src/', ({ fn, module, expected }) => {
    const { stdout } = lint(`packages/host/src/application/probe_nri_${fn}.ts`, `import { ${fn} } from '${module}'\n`)
    expect(stdout).toContain(module)
    expect(stdout).toContain(expected)
  })

  it('does NOT warn on node:* imports in tests/', () => {
    const { stdout } = lint('packages/host/tests/unit/probe_nri.ts', `import { readFileSync } from 'node:fs'\n`)
    expect(stdout).not.toContain('no-restricted-imports')
  })
})

// ── effect-patterns/no-date-clock — matrix ───────────────────────────────────

const dateClockCases: { desc: string; expectError: boolean; expectMsg?: string; path: string; src: string }[] = [
  {
    desc: 'Date.now() in src/ → error',
    expectError: true,
    expectMsg: 'Clock',
    path: 'packages/host/src/adapters/driven/probe_date.ts',
    src: `const _x = Date.now()\n`,
  },
  {
    desc: 'new Date() in src/ → error',
    expectError: true,
    expectMsg: 'Clock',
    path: 'packages/host/src/adapters/driven/probe_newdate.ts',
    src: `const _x = new Date()\n`,
  },
  {
    desc: 'new Date(ms) in src/ → allowed',
    expectError: false,
    path: 'packages/host/src/adapters/driven/probe_newdate_ok.ts',
    src: `declare const ms: number\nconst _x = new Date(ms).toISOString()\n`,
  },
  {
    desc: 'Date.now() in tests/ → allowed',
    expectError: false,
    path: 'packages/host/tests/unit/probe_date.ts',
    src: `const _x = Date.now()\n`,
  },
]

describe('effect-patterns/no-date-clock — Date.now / new Date', () => {
  it.each(dateClockCases)('$desc', ({ path, src, expectError, expectMsg }) => {
    const { exitCode, stdout } = lint(path, src)
    expect(exitCode).toBe(expectError ? 1 : 0)
    if (expectMsg !== undefined) {
      expect(stdout).toContain(expectMsg)
    }
  })
})

// ── effect-patterns/no-runpromise-in-tests — matrix ──────────────────────────

const runPromiseCases: { desc: string; expectError: boolean; path: string }[] = [
  {
    desc: 'errors on Effect.runPromise in tests/',
    expectError: true,
    path: 'packages/host/tests/unit/probe_runpromise.ts',
  },
  {
    desc: 'allows Effect.runPromise in src/',
    expectError: false,
    path: 'packages/host/src/adapters/driven/probe_runpromise.ts',
  },
]

const RUNPROMISE_SRC = `import { Effect } from 'effect'\nEffect.runPromise(Effect.void)\n`

describe('effect-patterns/no-runpromise-in-tests — Effect.runPromise', () => {
  it.each(runPromiseCases)('$desc', ({ path, expectError }) => {
    const { exitCode, stdout } = lint(path, RUNPROMISE_SRC)
    expect(exitCode).toBe(expectError ? 1 : 0)
    if (expectError) {
      expect(stdout).toContain('runPromise')
      expect(stdout).toContain('it.effect')
    }
  })
})

// ── effect-patterns/no-effect-gen-without-vitest ──────────────────────────────

describe('effect-patterns/no-effect-gen-without-vitest — Effect.gen in tests', () => {
  it('errors when Effect.gen used without @effect/vitest import', () => {
    const { exitCode, stdout } = lint(
      'packages/host/tests/unit/probe_gen_novitest.ts',
      [
        `import { Effect } from 'effect'`,
        `import { describe, it } from 'vitest'`,
        `describe('x', () => {`,
        `  it('y', () => { Effect.gen(function*() { yield* Effect.void }) })`,
        `})`,
        ``,
      ].join('\n'),
    )
    expect(exitCode).toBe(1)
    expect(stdout).toContain('@effect/vitest')
  })

  it('allows Effect.gen when @effect/vitest is imported', () => {
    const { exitCode } = lint(
      'packages/host/tests/unit/probe_gen_vitest.ts',
      [
        `import { Effect } from 'effect'`,
        `import { it } from '@effect/vitest'`,
        `it.effect('y', () => Effect.gen(function*() { yield* Effect.void }))`,
        ``,
      ].join('\n'),
    )
    expect(exitCode).toBe(0)
  })

  it('allows Effect.gen when runPromise bridge is used (ManagedRuntime pattern)', () => {
    const { exitCode } = lint(
      'packages/host/tests/unit/probe_gen_bridge.ts',
      [
        `import { Effect, ManagedRuntime, Layer } from 'effect'`,
        `import { describe, it } from 'vitest'`,
        `const rt = ManagedRuntime.make(Layer.empty)`,
        `const run = <A>(e: Effect.Effect<A>) => rt.runPromise(e)`,
        `describe('x', () => {`,
        `  it('y', async () => { await run(Effect.gen(function*() { yield* Effect.void })) })`,
        `})`,
        ``,
      ].join('\n'),
    )
    expect(exitCode).toBe(0)
  })

  it('does NOT fire on Effect.gen in src/', () => {
    const { exitCode } = lint(
      'packages/host/src/adapters/driven/probe_gen.ts',
      `import { Effect } from 'effect'\nconst _x = Effect.gen(function*() { yield* Effect.void })\n`,
    )
    expect(exitCode).toBe(0)
  })
})

// ── effect-patterns/no-inline-correlation-id ──────────────────────────────────

const correlationIdCases: { desc: string; expectError: boolean; path: string; src: string }[] = [
  {
    desc: 'errors on correlationId: randomUUID() in src/',
    expectError: true,
    path: 'packages/host/src/adapters/driven/probe_corr.ts',
    src: `import { randomUUID } from 'node:crypto'\nconst _e = { correlationId: randomUUID(), kind: 'X' }\n`,
  },
  {
    desc: 'allows correlationId = randomUUID() variable assignment',
    expectError: false,
    path: 'packages/host/src/application/probe_submitgoal.ts',
    src: `import { randomUUID } from 'node:crypto'\nexport const correlationId = randomUUID()\n`,
  },
  {
    desc: 'allows correlationId: someOtherId (not randomUUID)',
    expectError: false,
    path: 'packages/host/src/adapters/driven/probe_corr_ok.ts',
    src: `declare const id: string\nconst _e = { correlationId: id, kind: 'X' }\n`,
  },
]

describe('effect-patterns/no-inline-correlation-id — correlationId: randomUUID()', () => {
  it.each(correlationIdCases)('$desc', ({ path, src, expectError }) => {
    const { exitCode, stdout } = lint(path, src)
    expect(exitCode).toBe(expectError ? 1 : 0)
    if (expectError) {
      expect(stdout).toContain('correlationId')
      expect(stdout).toContain('CurrentCorrelationId')
    }
  })
})

// ── P12 — bare vitest imports in integration tests ────────────────────────────

describe("P12 — bare 'vitest' imports in integration test files (acceptance)", () => {
  it("no integration test file imports from bare 'vitest'", () => {
    const result = spawnSync(
      'grep',
      ['--include=*.integration.test.ts', '-r', '-l', "from 'vitest'", join(REPO_ROOT, 'packages', 'host', 'tests')],
      { encoding: 'utf8' },
    )
    expect(result.stdout.trim()).toBe('')
  })
})

// ── P13 — node:* built-in imports in integration tests ───────────────────────

describe('P13 — node:os / node:path / node:crypto imports in integration tests (acceptance)', () => {
  it.fails('RED: no integration test file should import from node:os, node:path, or node:crypto', () => {
    const result = spawnSync(
      'grep',
      [
        '--include=*.integration.test.ts',
        '-r',
        '-l',
        '-e',
        "from 'node:os'",
        '-e',
        "from 'node:path'",
        '-e',
        "from 'node:crypto'",
        join(REPO_ROOT, 'packages', 'host', 'tests'),
      ],
      { encoding: 'utf8' },
    )
    // RED: observeBin and p7ReasoningContent tests import node:* directly.
    // After fix (use Effect / @effect/platform equivalents): stdout is empty.
    expect(result.stdout.trim()).toBe('')
  })
})

// ── P23 — no-restricted-imports "off" override is a closed allow-list ─────────

const ALLOWED_OFF_PATHS = [
  '**/packages/host/src/adapters/**/*.ts',
  '**/packages/host/src/checks/**/*.ts',
  '**/packages/host/src/runtime/**/*.ts',
  '**/packages/host/src/main.ts',
] as const

describe('P23 — no-restricted-imports "off" override is a closed allow-list (acceptance)', () => {
  it('the override allow-list contains exactly the sanctioned paths — nothing more', () => {
    const raw = readFileSync(join(REPO_ROOT, '.oxlintrc.json'), 'utf8')
    const config = JSON.parse(raw) as {
      overrides: { files: string[]; rules: Record<string, unknown> }[]
    }
    const offOverrides = config.overrides.filter(o => o.rules['no-restricted-imports'] === 'off')
    expect(offOverrides.length).toBe(1)
    expect([...(offOverrides[0]?.files ?? [])].toSorted()).toEqual([...ALLOWED_OFF_PATHS].toSorted())
  })
})
