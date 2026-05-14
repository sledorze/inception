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
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Effect, Layer } from 'effect'
import { ContentStoreError, ContentStore } from '../../ports/driven/ContentStore.ts'
import type { ContentHash } from '../../ports/driven/ContentStore.ts'

const sha256 = (bytes: Uint8Array): ContentHash => createHash('sha256').update(bytes).digest('hex')

const blobPath = (casDir: string, hash: ContentHash) => join(casDir, hash.slice(0, 2), hash.slice(2))

const refPath = (refsDir: string, name: string) => join(refsDir, ...name.split('/'))

const wrap = <A>(op: () => Promise<A>): Effect.Effect<A, ContentStoreError> =>
  Effect.tryPromise({
    catch: cause => new ContentStoreError({ cause }),
    try: op,
  })

const ensureDir = (dir: string): Effect.Effect<void, ContentStoreError> =>
  wrap(() => mkdir(dir, { recursive: true }).then(() => undefined))

const makeStore = (casDir: string, refsDir: string) =>
  ContentStore.of({
    exists: hash =>
      wrap(() =>
        stat(blobPath(casDir, hash))
          .then(() => true)
          .catch(() => false),
      ),

    gc: reachable =>
      wrap(async () => {
        let removed = 0
        let prefixDirs: string[]
        try {
          prefixDirs = await readdir(casDir)
        } catch {
          return 0
        }
        for (const prefix of prefixDirs) {
          const prefixPath = join(casDir, prefix)
          let suffixes: string[]
          try {
            suffixes = await readdir(prefixPath)
          } catch {
            continue
          }
          for (const suffix of suffixes) {
            const hash = prefix + suffix
            if (!reachable.has(hash)) {
              await rm(join(prefixPath, suffix), { force: true })
              removed++
            }
          }
        }
        return removed
      }),

    get: hash =>
      wrap(async () => {
        try {
          const buf = await readFile(blobPath(casDir, hash))
          return new Uint8Array(buf)
        } catch {
          return undefined
        }
      }),

    put: content =>
      wrap(async () => {
        const hash = sha256(content)
        const path = blobPath(casDir, hash)
        await mkdir(dirname(path), { recursive: true })
        try {
          await stat(path)
        } catch {
          await writeFile(path, content)
        }
        return hash
      }),

    refGet: name =>
      wrap(async () => {
        try {
          const text = await readFile(refPath(refsDir, name), 'utf8')
          return text.trim()
        } catch {
          return undefined
        }
      }),

    refList: prefix =>
      wrap(async () => {
        const collect = async (dir: string, base: string): Promise<string[]> => {
          let entries: string[]
          try {
            entries = await readdir(dir)
          } catch {
            return []
          }
          const results: string[] = []
          for (const entry of entries) {
            const entryPath = join(dir, entry)
            const entryKey = base.length > 0 ? `${base}/${entry}` : entry
            let s: Awaited<ReturnType<typeof stat>>
            try {
              s = await stat(entryPath)
            } catch {
              continue
            }
            if (s.isDirectory()) {
              results.push(...(await collect(entryPath, entryKey)))
            } else {
              results.push(entryKey)
            }
          }
          return results
        }

        const baseDir = prefix.length > 0 ? join(refsDir, ...prefix.split('/')) : refsDir
        const all = await collect(baseDir, prefix.length > 0 ? prefix : '')
        return all.toSorted()
      }),

    refSet: (name, hash) =>
      wrap(async () => {
        const path = refPath(refsDir, name)
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, `${hash}\n`, 'utf8')
      }),
  })

export const GitContentStore = {
  // gitRoot: absolute path to the managed workspace git repository root.
  layer: (gitRoot: string) =>
    Layer.effect(
      ContentStore,
      Effect.gen(function* () {
        const casDir = join(gitRoot, '.git', 'cas')
        const refsDir = join(gitRoot, '.git', 'cas-refs')
        yield* ensureDir(casDir)
        yield* ensureDir(refsDir)
        return makeStore(casDir, refsDir)
      }),
    ),
}
