export interface FileContent {
  readonly path: string
  readonly content: string
}

export interface CategoryConfig {
  readonly forbiddenImportPatterns: readonly RegExp[]
  readonly suffix: string
}

export interface Violation {
  readonly path: string
  readonly reason: string
}

const TEST_FILE_PATTERN = /\.test\.tsx?$/u

const EXEMPT_PATTERNS = [/\.test\.tsx$/u, /^packages\/frontend\//u]

export const defaultCategories: readonly CategoryConfig[] = [
  {
    forbiddenImportPatterns: [
      // Add patterns for imports forbidden in unit tests, e.g.:
      // /@effect\/sql-sqlite-node/,
      // /\/Database\.ts/,
    ],
    suffix: '.unit.test.ts',
  },
  {
    forbiddenImportPatterns: [],
    suffix: '.integration.test.ts',
  },
]

const extractImportPaths = (content: string): readonly string[] => {
  const importRegex = /^import\s[\s\S]*?from\s+['"]([^'"]+)['"]|^import\s+['"]([^'"]+)['"]/gmu
  const paths: string[] = []
  let match: RegExpExecArray | null
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1] ?? match[2]
    if (importPath) {
      paths.push(importPath)
    }
  }
  return paths
}

export const checkTestConventions = (
  files: readonly FileContent[],
  categories: readonly CategoryConfig[],
): readonly Violation[] => {
  const violations: Violation[] = []

  for (const file of files) {
    if (!TEST_FILE_PATTERN.test(file.path)) {
      continue
    }

    if (EXEMPT_PATTERNS.some(p => p.test(file.path))) {
      continue
    }

    const matchedCategory = categories.find(c => file.path.endsWith(c.suffix))

    if (!matchedCategory) {
      violations.push({
        path: file.path,
        reason: `uncategorized test file — must use one of: ${categories.map(c => c.suffix).join(', ')}`,
      })
      continue
    }

    const importPaths = extractImportPaths(file.content)
    for (const pattern of matchedCategory.forbiddenImportPatterns) {
      if (importPaths.some(p => pattern.test(p))) {
        violations.push({
          path: file.path,
          reason: `forbidden import matching ${pattern.source} in ${matchedCategory.suffix} file`,
        })
      }
    }
  }

  return violations
}
