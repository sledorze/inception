/** @effect-diagnostics strictEffectProvide:off */
import { Effect, FileSystem, Layer, Path } from 'effect'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import * as NodePath from '@effect/platform-node/NodePath'
import type { FileContent } from './TestConventionChecker.ts'
import { checkTestConventions, defaultCategories } from './TestConventionChecker.ts'

const findTestFiles = (dir: string): Effect.Effect<string[], never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const exists = yield* fs.exists(dir).pipe(Effect.orDie)
    if (!exists) {
      return []
    }

    const entries = yield* fs.readDirectory(dir).pipe(Effect.orDie)
    const results: string[] = []

    for (const entry of entries) {
      const fullPath = path.join(dir, entry)
      const stat = yield* fs.stat(fullPath).pipe(Effect.orDie)
      if (stat.type === 'Directory') {
        if (entry !== 'node_modules' && entry !== '.stryker-tmp' && entry !== 'dist') {
          results.push(...(yield* findTestFiles(fullPath)))
        }
      } else if (/\.test\.tsx?$/u.test(entry)) {
        results.push(fullPath)
      }
    }

    return results
  })

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const rootDir = path.resolve(import.meta.dirname ?? '.', '../../../..')
  const backendTests = yield* findTestFiles(path.join(rootDir, 'packages/host/src'))
  const frontendTests = yield* findTestFiles(path.join(rootDir, 'packages/frontend/src'))
  const testFiles = [...backendTests, ...frontendTests]

  const files: FileContent[] = yield* Effect.forEach(
    testFiles,
    filePath =>
      fs.readFileString(filePath).pipe(
        Effect.orDie,
        Effect.map(content => ({ content, path: path.relative(rootDir, filePath) })),
      ),
    { concurrency: 10 },
  )

  const violations = checkTestConventions(files, defaultCategories)

  if (violations.length > 0) {
    for (const v of violations) {
      process.stderr.write(`  ${v.path}: ${v.reason}\n`)
    }
    process.stderr.write(`\n${String(violations.length)} violation(s) found.\n`)
    process.exit(1)
  } else {
    process.stdout.write('All test files follow naming conventions.\n')
  }
})

await Effect.runPromise(program.pipe(Effect.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer))))
