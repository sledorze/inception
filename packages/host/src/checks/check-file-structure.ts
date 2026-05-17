/** @effect-diagnostics strictEffectProvide:off */
import { Effect, FileSystem, Layer, Path } from 'effect'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import * as NodePath from '@effect/platform-node/NodePath'
import * as NodeRuntime from '@effect/platform-node/NodeRuntime'

// Matches top-level React component definitions by PascalCase function name.
// Covers: function Foo(, export function Foo(, export default function Foo(
const COMPONENT_DEF_RE = /^(?:export\s+(?:default\s+)?)?function\s+[A-Z][a-zA-Z0-9]*/mu

function countComponents(content: string): number {
  return (content.match(new RegExp(COMPONENT_DEF_RE.source, 'gmu')) ?? []).length
}

const EXCLUDED_DIRS = ['components/ui', 'node_modules', 'dist', '.stryker-tmp']

const findTsxFiles = (dir: string, root: string): Effect.Effect<string[], never, FileSystem.FileSystem | Path.Path> =>
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
      const rel = path.relative(root, fullPath)
      if (EXCLUDED_DIRS.some(ex => rel.startsWith(ex) || rel.includes(`/${ex}`))) {
        continue
      }
      const stat = yield* fs.stat(fullPath).pipe(Effect.orDie)
      if (stat.type === 'Directory') {
        results.push(...(yield* findTsxFiles(fullPath, root)))
      } else if (entry.endsWith('.tsx')) {
        results.push(fullPath)
      }
    }

    return results
  })

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const rootDir = path.resolve(import.meta.dirname ?? '.', '../../../..')
  const appSrc = path.join(rootDir, 'packages/app/src')
  const backofficeSrc = path.join(rootDir, 'packages/backoffice/src')

  const files = [...(yield* findTsxFiles(appSrc, appSrc)), ...(yield* findTsxFiles(backofficeSrc, backofficeSrc))]

  type Violation = { path: string; count: number }
  const violations: Violation[] = []

  for (const file of files) {
    const content = yield* fs.readFileString(file).pipe(Effect.orDie)
    const count = countComponents(content)
    if (count > 1) {
      violations.push({ count, path: path.relative(rootDir, file) })
    }
  }

  if (violations.length > 0) {
    for (const v of violations) {
      process.stderr.write(`  ${v.path}: ${String(v.count)} components (max 1 per file)\n`)
    }
    process.stderr.write(
      `\n${String(violations.length)} file-structure violation(s). Split into one component per file.\n`,
    )
    process.exit(1)
  } else {
    process.stdout.write('File structure check passed.\n')
  }
})

program.pipe(Effect.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)), NodeRuntime.runMain)
