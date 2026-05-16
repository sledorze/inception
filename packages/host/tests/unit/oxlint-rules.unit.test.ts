import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, beforeAll, describe, expect, it } from '@effect/vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const OXLINT_BIN = join(REPO_ROOT, 'node_modules', '.bin', 'oxlint')
const HOST_CONFIG = join(REPO_ROOT, 'packages', 'host', '.oxlintrc.json')
const FRONTEND_CONFIG = join(REPO_ROOT, 'packages', 'app', '.oxlintrc.json')

let FIXTURE_DIR: string

beforeAll(() => {
  FIXTURE_DIR = join(tmpdir(), `oxlint-rules-${Date.now()}`)
  mkdirSync(join(FIXTURE_DIR, 'packages', 'host', 'src', 'adapters', 'driven'), { recursive: true })
  mkdirSync(join(FIXTURE_DIR, 'packages', 'host', 'src', 'application'), { recursive: true })
  mkdirSync(join(FIXTURE_DIR, 'packages', 'host', 'tests', 'unit'), { recursive: true })
  mkdirSync(join(FIXTURE_DIR, 'packages', 'app', 'src', 'components', 'ui'), { recursive: true })
})

afterAll(() => {
  rmSync(FIXTURE_DIR, { force: true, recursive: true })
})

function lint(relPath: string, src: string, config: string = HOST_CONFIG): { exitCode: number; stdout: string } {
  const absPath = join(FIXTURE_DIR, relPath)
  writeFileSync(absPath, src)
  const result = spawnSync(OXLINT_BIN, ['--config', config, relPath], {
    cwd: FIXTURE_DIR,
    encoding: 'utf8',
  })
  return { exitCode: result.status ?? 1, stdout: (result.stdout ?? '') + (result.stderr ?? '') }
}

// ── no-restricted-imports — node:* built-ins matrix ──────────────────────────

const nodeImportProbes: { fn: string; module: string }[] = [
  { fn: 'readFileSync', module: 'node:fs' },
  { fn: 'readFile', module: 'node:fs/promises' },
  { fn: 'join', module: 'node:path' },
  { fn: 'execFile', module: 'node:child_process' },
  { fn: 'createServer', module: 'node:http' },
  { fn: 'fileURLToPath', module: 'node:url' },
]

describe('no-restricted-imports — node:* in packages/host/src/', () => {
  it.each(nodeImportProbes)('warns on $module import in src/', ({ fn, module }) => {
    const { exitCode, stdout } = lint(
      `packages/host/src/application/probe_nri_${fn}.ts`,
      `import { ${fn} } from '${module}'\n`,
    )
    expect(exitCode).not.toBe(0)
    expect(stdout).toContain(module)
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
  it('no integration test file imports from node:os, node:path, or node:crypto', () => {
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
    expect(result.stdout.trim()).toBe('')
  })
})

// ── P23 — no-restricted-imports "off" override is a closed allow-list ─────────

const ALLOWED_OFF_PATHS = [
  '**/src/adapters/**/*.ts',
  '**/src/checks/**/*.ts',
  '**/src/runtime/**/*.ts',
  '**/src/main.ts',
] as const

describe('P23 — oxlint overrides are a closed list (acceptance)', () => {
  it('root config override count is exactly 1 — any new block must update this test', () => {
    const raw = readFileSync(join(REPO_ROOT, '.oxlintrc.json'), 'utf8')
    const config = JSON.parse(raw) as {
      overrides: { files: string[]; rules: Record<string, unknown> }[]
    }
    expect(config.overrides.length).toBe(1)
  })

  it('host config override count is exactly 4 — any new block must update this test', () => {
    const raw = readFileSync(HOST_CONFIG, 'utf8')
    const config = JSON.parse(raw) as {
      overrides: { files: string[]; rules: Record<string, unknown> }[]
    }
    expect(config.overrides.length).toBe(4)
  })

  it('the no-restricted-imports "off" override allow-list contains exactly the sanctioned paths', () => {
    const raw = readFileSync(HOST_CONFIG, 'utf8')
    const config = JSON.parse(raw) as {
      overrides: { files: string[]; rules: Record<string, unknown> }[]
    }
    const offOverrides = config.overrides.filter(o => o.rules['no-restricted-imports'] === 'off')
    expect(offOverrides.length).toBe(1)
    expect([...(offOverrides[0]?.files ?? [])].toSorted()).toEqual([...ALLOWED_OFF_PATHS].toSorted())
  })

  it('every host override block has exactly the expected rule names and severities — no silent "off" can be added', () => {
    const raw = readFileSync(HOST_CONFIG, 'utf8')
    const config = JSON.parse(raw) as {
      overrides: { files: string[]; rules: Record<string, unknown> }[]
    }
    const { overrides } = config
    const sev = (v: unknown): string => (Array.isArray(v) ? String(v[0]) : String(v))

    // Block 0: **/src/**/*.ts — effect-patterns + no-restricted-imports enforced
    const b0 = overrides[0]?.rules ?? {}
    expect(Object.keys(b0).toSorted()).toEqual([
      'effect-patterns/no-async-in-src',
      'effect-patterns/no-date-clock',
      'effect-patterns/no-inline-correlation-id',
      'effect-patterns/no-raw-promise',
      'effect-patterns/no-try-catch-in-src',
      'no-restricted-imports',
    ])
    expect(sev(b0['effect-patterns/no-async-in-src'])).toBe('error')
    expect(sev(b0['effect-patterns/no-date-clock'])).toBe('error')
    expect(sev(b0['effect-patterns/no-inline-correlation-id'])).toBe('error')
    expect(sev(b0['effect-patterns/no-raw-promise'])).toBe('error')
    expect(sev(b0['effect-patterns/no-try-catch-in-src'])).toBe('error')
    expect(sev(b0['no-restricted-imports'])).toBe('error')

    // Block 1: adapters/checks/runtime/main — no-restricted-imports off (sanctioned escape hatch, files locked above)
    const b1 = overrides[1]?.rules ?? {}
    expect(Object.keys(b1).toSorted()).toEqual(['no-restricted-imports'])
    expect(sev(b1['no-restricted-imports'])).toBe('off')

    // Block 2: **/tests/**/*.ts — Effect test-discipline rules + barrel import ban enforced
    const b2 = overrides[2]?.rules ?? {}
    expect(Object.keys(b2).toSorted()).toEqual([
      'effect-patterns/no-effect-gen-without-vitest',
      'effect-patterns/no-runpromise-in-tests',
      'no-restricted-imports',
    ])
    expect(sev(b2['effect-patterns/no-effect-gen-without-vitest'])).toBe('error')
    expect(sev(b2['effect-patterns/no-runpromise-in-tests'])).toBe('error')
    expect(sev(b2['no-restricted-imports'])).toBe('error')

    // Block 3: **/tests/helpers/**/*.ts — one rule relaxed for helper authors writing Effect-native helpers
    const b3 = overrides[3]?.rules ?? {}
    expect(Object.keys(b3).toSorted()).toEqual(['effect-patterns/no-effect-gen-without-vitest'])
    expect(sev(b3['effect-patterns/no-effect-gen-without-vitest'])).toBe('off')
  })

  it('the effect-gen "off" override applies only to **/tests/helpers/**', () => {
    const raw = readFileSync(HOST_CONFIG, 'utf8')
    const config = JSON.parse(raw) as {
      overrides: { files: string[]; rules: Record<string, unknown> }[]
    }
    const helperOverrides = config.overrides.filter(
      o => o.rules['effect-patterns/no-effect-gen-without-vitest'] === 'off',
    )
    expect(helperOverrides.length).toBe(1)
    expect([...(helperOverrides[0]?.files ?? [])].toSorted()).toEqual(['**/tests/helpers/**/*.ts'])
  })
})

// ── P20 — process.env access banned in packages/host/src/ ────────────────────

describe('P20 — process.env access banned in packages/host/src/ (acceptance)', () => {
  it('no process.env[ access anywhere in src/', () => {
    const result = spawnSync(
      'grep',
      ['-rln', '--include=*.ts', String.raw`process.env\[`, join(REPO_ROOT, 'packages', 'host', 'src')],
      { encoding: 'utf8' },
    )
    expect(result.stdout.trim()).toBe('')
  })
})

// ── design-system/no-raw-interactive-element — matrix ────────────────────────

const RULE = 'no-raw-interactive-element'

const designSystemCases: { desc: string; expectError: boolean; path: string; src: string }[] = [
  {
    desc: 'raw <button> in src/ → error',
    expectError: true,
    path: 'packages/app/src/Probe.tsx',
    src: `export const Probe = () => <button type="button">x</button>\n`,
  },
  {
    desc: 'raw <textarea> in src/ → error',
    expectError: true,
    path: 'packages/app/src/ProbeTa.tsx',
    src: `export const ProbeTa = () => <textarea />\n`,
  },
  {
    desc: 'shadcn <Button> component in src/ → allowed',
    expectError: false,
    path: 'packages/app/src/ProbeOk.tsx',
    src: `import { Button } from '@/components/ui/button'\nexport const ProbeOk = () => <Button>x</Button>\n`,
  },
  {
    desc: 'raw <button> in src/components/ui/ → allowed (shadcn wraps raw elements)',
    expectError: false,
    path: 'packages/app/src/components/ui/probe-ui.tsx',
    src: `export const ProbeUi = () => <button type="button">x</button>\n`,
  },
]

describe('design-system/no-raw-interactive-element — raw HTML vs shadcn/ui', () => {
  it.each(designSystemCases)('$desc', ({ path, src, expectError }) => {
    const { stdout } = lint(path, src, FRONTEND_CONFIG)
    if (expectError) {
      expect(stdout).toContain(RULE)
    } else {
      expect(stdout).not.toContain(RULE)
    }
  })

  it('the diagnostic invites the shadcn component + install command', () => {
    const { stdout } = lint(
      'packages/app/src/ProbeMsg.tsx',
      `export const ProbeMsg = () => <button type="button">x</button>\n`,
      FRONTEND_CONFIG,
    )
    expect(stdout).toContain('<Button>')
    expect(stdout).toContain('@/components/ui/button')
    expect(stdout).toContain('npx shadcn add button')
  })
})

// ── design-system/no-raw-color-utility — matrix ──────────────────────────────

const COLOR_RULE = 'no-raw-color-utility'

const colorCases: { desc: string; expectError: boolean; path: string; src: string }[] = [
  {
    desc: 'raw palette color in string literal className → error',
    expectError: true,
    path: 'packages/app/src/ProbeColor.tsx',
    src: `export const X = () => <div className="bg-red-50 text-red-800">x</div>\n`,
  },
  {
    desc: 'raw palette color in template literal ternary → error',
    expectError: true,
    path: 'packages/app/src/ProbeColorTmpl.tsx',
    src: "export const X = (f: boolean) => <div className={`base ${f ? 'bg-red-50' : 'bg-green-50'}`}>x</div>\n",
  },
  {
    desc: 'semantic token in className → allowed',
    expectError: false,
    path: 'packages/app/src/ProbeColorOk.tsx',
    src: `export const X = () => <div className="bg-destructive text-muted-foreground">x</div>\n`,
  },
  {
    desc: 'semantic token with opacity modifier → allowed',
    expectError: false,
    path: 'packages/app/src/ProbeColorOpacity.tsx',
    src: `export const X = () => <div className="bg-destructive/10 text-success">x</div>\n`,
  },
  {
    desc: 'raw palette color in src/components/ui/ → allowed (shadcn internals)',
    expectError: false,
    path: 'packages/app/src/components/ui/probe-color-ui.tsx',
    src: `export const X = () => <div className="bg-red-50">x</div>\n`,
  },
]

describe('design-system/no-raw-color-utility — palette colors vs semantic tokens', () => {
  it.each(colorCases)('$desc', ({ path, src, expectError }) => {
    const { stdout } = lint(path, src, FRONTEND_CONFIG)
    if (expectError) {
      expect(stdout).toContain(COLOR_RULE)
    } else {
      expect(stdout).not.toContain(COLOR_RULE)
    }
  })

  it('the diagnostic names the matched token and invites semantic alternatives', () => {
    const { stdout } = lint(
      'packages/app/src/ProbeColorMsg.tsx',
      `export const X = () => <div className="text-gray-500">x</div>\n`,
      FRONTEND_CONFIG,
    )
    expect(stdout).toContain("'text-gray-500'")
    expect(stdout).toContain('text-muted-foreground')
    expect(stdout).toContain('index.css')
  })
})

// ── design-system/no-inline-style — matrix ───────────────────────────────────

const STYLE_RULE = 'no-inline-style'

describe('design-system/no-inline-style — style={{}} bypass', () => {
  it('style={{}} in src/ → error', () => {
    const { stdout } = lint(
      'packages/app/src/ProbeStyle.tsx',
      `export const X = () => <div style={{ color: 'red' }}>x</div>\n`,
      FRONTEND_CONFIG,
    )
    expect(stdout).toContain(STYLE_RULE)
  })

  it('no style attr → allowed', () => {
    const { stdout } = lint(
      'packages/app/src/ProbeStyleOk.tsx',
      `export const X = () => <div className="text-foreground">x</div>\n`,
      FRONTEND_CONFIG,
    )
    expect(stdout).not.toContain(STYLE_RULE)
  })

  it('style={{}} in src/components/ui/ → allowed', () => {
    const { stdout } = lint(
      'packages/app/src/components/ui/probe-style-ui.tsx',
      `export const X = () => <div style={{ color: 'red' }}>x</div>\n`,
      FRONTEND_CONFIG,
    )
    expect(stdout).not.toContain(STYLE_RULE)
  })
})

// ── design-system/no-raw-interactive-element — <section> → Card ──────────────

describe('design-system/no-raw-interactive-element — <section> invitation', () => {
  it('raw <section> in src/ → error with Card invite', () => {
    const { stdout } = lint(
      'packages/app/src/ProbeSection.tsx',
      `export const X = () => <section className="p-4"><h2>Title</h2></section>\n`,
      FRONTEND_CONFIG,
    )
    expect(stdout).toContain('no-raw-interactive-element')
    expect(stdout).toContain('<Card>')
    expect(stdout).toContain('npx shadcn add card')
  })

  it('shadcn <Card> in src/ → allowed', () => {
    const { stdout } = lint(
      'packages/app/src/ProbeSectionOk.tsx',
      `import { Card } from '@/components/ui/card'\nexport const X = () => <Card className="p-4"><h2>Title</h2></Card>\n`,
      FRONTEND_CONFIG,
    )
    expect(stdout).not.toContain('no-raw-interactive-element')
  })
})

// ── effect-patterns/no-async-in-src (P35 red step) ───────────────────────────
// These tests verify the rule that now exists (TODO 10.1 green step).

describe('effect-patterns/no-async-in-src (P35) — async keyword banned in host/src/', () => {
  it('async function declaration in src/ → error', () => {
    const { exitCode, stdout } = lint(
      'packages/host/src/application/probe_async_fn.ts',
      `async function foo(): Promise<void> { await Promise.resolve() }\n`,
    )
    expect(exitCode).not.toBe(0)
    expect(stdout).toContain('no-async-in-src')
  })

  it('async arrow in src/ → error', () => {
    const { exitCode, stdout } = lint(
      'packages/host/src/application/probe_async_arrow.ts',
      `const bar = async (): Promise<string> => 'ok'\n`,
    )
    expect(exitCode).not.toBe(0)
    expect(stdout).toContain('no-async-in-src')
  })
})

// ── effect-patterns/no-try-catch-in-src (P39 green step) ────────────────────
// These tests verify the rule that now exists (TODO 10.4 green step).

describe('effect-patterns/no-try-catch-in-src (P39) — try/catch banned in host/src/', () => {
  it('try/catch block in src/ → error', () => {
    const { exitCode, stdout } = lint(
      'packages/host/src/application/probe_try_catch.ts',
      `function probe(x: unknown): boolean { try { return !!x } catch { return false } }\n`,
    )
    expect(exitCode).not.toBe(0)
    expect(stdout).toContain('no-try-catch-in-src')
  })

  it('try/catch-with-binding in src/ → error', () => {
    const { exitCode, stdout } = lint(
      'packages/host/src/application/probe_try_catch_binding.ts',
      `function probe(): void { try { throw new Error() } catch (e) { console.error(e) } }\n`,
    )
    expect(exitCode).not.toBe(0)
    expect(stdout).toContain('no-try-catch-in-src')
  })
})
