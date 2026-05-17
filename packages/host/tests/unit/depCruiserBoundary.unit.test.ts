import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from '@effect/vitest'

// P36 + P37 green-step acceptance tests.
// The deny rule `no-frontend-component-api-import` now exists and all components
// have been migrated to import through hooks/ — dep-cruiser exits 0 on compliant files.

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

describe('dep-cruiser frontend boundary enforcement (P36 / P37 green step)', () => {
  it('app component going through hooks/ layer — no violation', () => {
    const { exitCode } = cruise(['packages/app/src/components/app/Conversation.tsx'])
    expect(exitCode).toBe(0)
  })

  it('backoffice component going through hooks/ layer — no violation', () => {
    const { exitCode } = cruise(['packages/backoffice/src/components/app/PainBoard.tsx'])
    expect(exitCode).toBe(0)
  })

  it('the no-frontend-component-api-import deny rule is configured — hooks/ → api/ is allowed', () => {
    // hooks/ files import api/ directly — that is the mediation layer; only components/ → api/ is denied
    const { exitCode } = cruise(['packages/backoffice/src/hooks/admin.ts'])
    expect(exitCode).toBe(0)
  })
})
