/**
 * GitContentStore — bootstrap ContentStore adapter (§10.1 Q3, TODO 1.22).
 *
 * Stores CAS blobs as files under <gitRoot>/.git/cas/<sha256[0:2]>/<sha256[2:]>.
 * Stores named refs as plain-text files under <gitRoot>/.git/cas-refs/<name>.
 * Both directories are git-ignored structures inside the workspace .git/ directory —
 * they coexist with git's own object storage without interfering with it.
 *
 * Hash algorithm: SHA-256 of raw bytes (matching the port contract comment).
 * GC: deletes blob files whose hashes are not in the reachable set.
 */
import { createHash } from 'node:crypto'
import { Effect, FileSystem, Layer, Path } from 'effect'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import * as NodePath from '@effect/platform-node/NodePath'
import { ContentStoreError, ContentStore } from '../../ports/driven/ContentStore.ts'
import type { ContentHash } from '../../ports/driven/ContentStore.ts'

const sha256 = (bytes: Uint8Array): ContentHash => createHash('sha256').update(bytes).digest('hex')

export const GitContentStore = {
  // gitRoot: absolute path to the managed workspace git repository root.
  layer: (gitRoot: string) =>
    Layer.effect(
      ContentStore,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path

        const casDir = path.join(gitRoot, '.git', 'cas')
        const refsDir = path.join(gitRoot, '.git', 'cas-refs')

        yield* fs
          .makeDirectory(casDir, { recursive: true })
          .pipe(Effect.mapError(e => new ContentStoreError({ cause: e })))
        yield* fs
          .makeDirectory(refsDir, { recursive: true })
          .pipe(Effect.mapError(e => new ContentStoreError({ cause: e })))

        const blobPath = (hash: ContentHash) => path.join(casDir, hash.slice(0, 2), hash.slice(2))

        const refPath = (name: string) => path.join(refsDir, ...name.split('/'))

        const statOrNull = (p: string) => fs.stat(p).pipe(Effect.catch(() => Effect.succeed(null)))

        const collect = (dir: string, base: string): Effect.Effect<string[]> =>
          fs.readDirectory(dir).pipe(
            Effect.catch(() => Effect.succeed([] as string[])),
            Effect.flatMap(entries =>
              Effect.all(
                entries.map(entry =>
                  Effect.gen(function* () {
                    const entryPath = path.join(dir, entry)
                    const entryKey = base.length > 0 ? `${base}/${entry}` : entry
                    const info = yield* statOrNull(entryPath)
                    if (info === null) {
                      return [] as string[]
                    }
                    if (info.type === 'Directory') {
                      return yield* collect(entryPath, entryKey)
                    }
                    return [entryKey]
                  }),
                ),
              ),
            ),
            Effect.map(arrays => arrays.flat()),
          )

        return ContentStore.of({
          exists: hash =>
            statOrNull(blobPath(hash)).pipe(
              Effect.map(info => info !== null),
              Effect.mapError(e => new ContentStoreError({ cause: e })),
            ),

          gc: reachable =>
            Effect.gen(function* () {
              let removed = 0
              const prefixDirs = yield* fs
                .readDirectory(casDir)
                .pipe(Effect.catch(() => Effect.succeed([] as string[])))
              for (const prefix of prefixDirs) {
                const prefixPath = path.join(casDir, prefix)
                const suffixes = yield* fs
                  .readDirectory(prefixPath)
                  .pipe(Effect.catch(() => Effect.succeed([] as string[])))
                for (const suffix of suffixes) {
                  const hash = prefix + suffix
                  if (!reachable.has(hash)) {
                    yield* fs.remove(path.join(prefixPath, suffix), { force: true })
                    removed++
                  }
                }
              }
              return removed
            }).pipe(Effect.mapError(e => new ContentStoreError({ cause: e }))),

          get: hash =>
            fs.readFile(blobPath(hash)).pipe(
              Effect.catch(() => Effect.succeed<Uint8Array | undefined>(undefined)),
              Effect.mapError(e => new ContentStoreError({ cause: e })),
            ),

          put: content =>
            Effect.gen(function* () {
              const hash = sha256(content)
              const bPath = blobPath(hash)
              yield* fs.makeDirectory(path.dirname(bPath), { recursive: true })
              const already = yield* statOrNull(bPath)
              if (already === null) {
                yield* fs.writeFile(bPath, content)
              }
              return hash
            }).pipe(Effect.mapError(e => new ContentStoreError({ cause: e }))),

          refGet: name =>
            fs.readFileString(refPath(name)).pipe(
              Effect.map(text => text.trim()),
              Effect.catch(() => Effect.succeed(undefined as string | undefined)),
              Effect.mapError(e => new ContentStoreError({ cause: e })),
            ),

          refList: prefix =>
            Effect.gen(function* () {
              const baseDir = prefix.length > 0 ? path.join(refsDir, ...prefix.split('/')) : refsDir
              const all = yield* collect(baseDir, prefix.length > 0 ? prefix : '')
              return all.toSorted()
            }).pipe(Effect.mapError(e => new ContentStoreError({ cause: e }))),

          refSet: (name, hash) =>
            Effect.gen(function* () {
              const rPath = refPath(name)
              yield* fs.makeDirectory(path.dirname(rPath), { recursive: true })
              yield* fs.writeFileString(rPath, `${hash}\n`)
            }).pipe(Effect.mapError(e => new ContentStoreError({ cause: e }))),
        })
      }),
    ).pipe(Layer.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer))),
}
