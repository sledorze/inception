import { describe, expect, it } from '@effect/vitest'
import { checkTestConventions, defaultCategories } from '../../src/checks/TestConventionChecker.ts'
import type { FileContent } from '../../src/checks/TestConventionChecker.ts'

const file = (path: string, content: string): FileContent => ({ content, path })

describe('checkTestConventions — file categorisation', () => {
  it('passes for a correctly named unit test file', () => {
    const violations = checkTestConventions([file('packages/host/tests/unit/foo.unit.test.ts', '')], defaultCategories)
    expect(violations).toHaveLength(0)
  })

  it('passes for a correctly named integration test file', () => {
    const violations = checkTestConventions(
      [file('packages/host/tests/integration/foo.integration.test.ts', '')],
      defaultCategories,
    )
    expect(violations).toHaveLength(0)
  })

  it('flags a test file that matches no known suffix', () => {
    const violations = checkTestConventions([file('packages/host/tests/foo.test.ts', '')], defaultCategories)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.reason).toContain('uncategorized')
  })

  it('ignores non-test files', () => {
    const violations = checkTestConventions([file('packages/host/src/application/session.ts', '')], defaultCategories)
    expect(violations).toHaveLength(0)
  })

  it('exempts app/backoffice test files', () => {
    const violations = checkTestConventions([file('packages/app/src/api/goals.test.ts', '')], defaultCategories)
    expect(violations).toHaveLength(0)
  })

  it('exempts .test.tsx files', () => {
    const violations = checkTestConventions([file('packages/host/tests/foo.test.tsx', '')], defaultCategories)
    expect(violations).toHaveLength(0)
  })
})

describe('checkTestConventions — forbidden import detection', () => {
  it('flags a unit test that imports a forbidden pattern', () => {
    const categories = [
      {
        forbiddenImportPatterns: [/sqlite/u],
        suffix: '.unit.test.ts',
      },
    ]
    const content = `import { db } from '@effect/sql-sqlite-node'`
    const violations = checkTestConventions([file('packages/host/tests/foo.unit.test.ts', content)], categories)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.reason).toContain('forbidden import')
  })

  it('passes when a unit test has no forbidden imports', () => {
    const categories = [{ forbiddenImportPatterns: [/sqlite/u], suffix: '.unit.test.ts' }]
    const violations = checkTestConventions(
      [file('packages/host/tests/foo.unit.test.ts', `import { effect } from 'effect'`)],
      categories,
    )
    expect(violations).toHaveLength(0)
  })
})
