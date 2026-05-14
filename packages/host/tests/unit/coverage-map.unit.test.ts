/**
 * Programmatic invariant: every module in src/domain/ and src/application/
 * must have at least one importer inside tests/.
 *
 * Fails when a utility is added without a paired test (direct or via a law test).
 * Self-enforcing: adding src/domain/foo.ts without a test breaks this check.
 *
 * Scope note: indirect coverage via law tests counts — the check reads all test
 * file content and matches any `from '.../<basename>'` import. Unit tests that
 * use the module directly and law tests that import it both satisfy the invariant.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const HOST_ROOT = join(import.meta.filename, '..', '..', '..')
const SRC_DIRS = ['src/domain', 'src/application']
const TESTS_DIR = join(HOST_ROOT, 'tests')

function collectTestContent(dir: string): string {
  let content = ''
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      content += collectTestContent(full)
    } else if (entry.name.endsWith('.ts')) {
      content += `${readFileSync(full, 'utf8')}\n`
    }
  }
  return content
}

describe('utility coverage map', () => {
  it('every src/domain and src/application module has at least one importer in tests/', () => {
    const allTestContent = collectTestContent(TESTS_DIR)
    const uncovered: string[] = []

    for (const dir of SRC_DIRS) {
      const fullDir = join(HOST_ROOT, dir)
      for (const entry of readdirSync(fullDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.ts')) {
          continue
        }
        const basename = entry.name.replace(/\.ts$/u, '')
        // Match: from '../../src/domain/<basename>' or from '.../<basename>.ts'
        const pattern = new RegExp(`from\\s+['"][^'"]*[/\\\\]${basename}(\\.ts)?['"]`, 'u')
        if (!pattern.test(allTestContent)) {
          uncovered.push(`${dir}/${entry.name}`)
        }
      }
    }

    expect(
      uncovered,
      `These modules have no importer in tests/ — add a unit test, law test, or integration test:\n${uncovered.join('\n')}`,
    ).toEqual([])
  })
})
