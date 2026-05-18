/**
 * check-test-conventions.ts — CI gate for test file naming conventions.
 *
 * Rules enforced:
 *   1. No *.test.ts files directly under e2e/ (Playwright default is .spec.ts).
 *      Host-package unit/integration tests under packages/ use *.unit.test.ts /
 *      *.integration.test.ts which is a different convention — not checked here.
 *
 * Usage: npx tsx scripts/check-test-conventions.ts
 * Exit code 1 if any violation is found.
 */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const __dirname = import.meta.dirname
const repoRoot = join(__dirname, '..')

function checkE2eNamingConvention(): string[] {
  const e2eDir = join(repoRoot, 'e2e')
  let entries: string[]
  try {
    entries = readdirSync(e2eDir)
  } catch {
    // e2e directory does not exist — nothing to check.
    return []
  }

  const violations: string[] = []
  for (const entry of entries) {
    // Only check direct children of e2e/ (not subdirectories like helpers/).
    if (entry.endsWith('.test.ts')) {
      violations.push(`e2e/${entry}: Playwright specs must use .spec.ts, not .test.ts`)
    }
  }
  return violations
}

const violations = checkE2eNamingConvention()

if (violations.length > 0) {
  console.error('Test convention violations found:')
  for (const v of violations) {
    console.error(`  ✗ ${v}`)
  }
  process.exit(1)
} else {
  console.log('Test conventions OK.')
}
