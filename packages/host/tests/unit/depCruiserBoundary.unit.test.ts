import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from '@effect/vitest'

// P36 + P37 red-step acceptance tests.
// Skipped: deny rule does not exist yet. Remove .skip in TODO 10.2 once the rule lands.
// Proof of gap: dep-cruiser exits 0 on component→api imports (allow-all rule).

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const DEPCRUISE_BIN = join(REPO_ROOT, 'node_modules', '.bin', 'depcruise')
const DEP_CONFIG = join(REPO_ROOT, '.dependency-cruiser.cjs')

function cruise(paths: string[]): { exitCode: number; stdout: string } {
  const result = spawnSync(DEPCRUISE_BIN, ['--validate', DEP_CONFIG, '--output-type', 'err', ...paths], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
  return { exitCode: result.status ?? 1, stdout: (result.stdout ?? '') + (result.stderr ?? '') }
}

describe.skip('dep-cruiser frontend boundary enforcement (P36 / P37 red step)', () => {
  it('app component importing api/ directly → violation (no-frontend-component-api-import)', () => {
    // packages/app/src/components/app/Metrics.tsx imports ../../api/admin.ts directly.
    // Once TODO 10.2 adds the deny rule this exits non-zero.
    // Currently exits 0 (allow-all) → test FAILS.
    const { exitCode, stdout } = cruise(['packages/app/src/components/app/Metrics.tsx'])
    expect(exitCode).not.toBe(0)
    expect(stdout).toContain('no-frontend-component-api-import')
  })

  it('backoffice component importing api/ directly → same violation', () => {
    const { exitCode, stdout } = cruise(['packages/backoffice/src/components/app/PainBoard.tsx'])
    expect(exitCode).not.toBe(0)
    expect(stdout).toContain('no-frontend-component-api-import')
  })
})
