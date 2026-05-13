import * as fs from 'node:fs'
import * as path from 'node:path'

import type { FileContent } from './TestConventionChecker.ts'
import { checkTestConventions, defaultCategories } from './TestConventionChecker.ts'

const findTestFiles = (dir: string): string[] => {
  const results: string[] = []
  if (!fs.existsSync(dir)) {
    return results
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.stryker-tmp' || entry.name === 'dist') {
        continue
      }
      results.push(...findTestFiles(fullPath))
    } else if (/\.test\.tsx?$/.test(entry.name)) {
      results.push(fullPath)
    }
  }
  return results
}

const rootDir = path.resolve(import.meta.dirname ?? '.', '../../..')
const backendTests = findTestFiles(path.join(rootDir, 'packages/backend/src'))
const frontendTests = findTestFiles(path.join(rootDir, 'packages/frontend/src'))
const testFiles = [...backendTests, ...frontendTests]

const files: FileContent[] = testFiles.map(filePath => ({
  content: fs.readFileSync(filePath, 'utf8'),
  path: path.relative(rootDir, filePath),
}))

const violations = checkTestConventions(files, defaultCategories)

if (violations.length > 0) {
  console.error(`\nTest convention violations found:\n`)
  for (const v of violations) {
    console.error(`  ${v.path}: ${v.reason}`)
  }
  console.error(`\n${violations.length} violation(s) found.\n`)
  process.exit(1)
} else {
  console.log('All test files follow naming conventions.')
}
