/**
 * Protocol contract test for the ContentStore driven port.
 * Parametrised over all bound adapters — Liskov substitution proven by test, not intent (§2.13).
 * Laws exercised: L2.14 (port contract); §10.1 Q3 (CAS semantics: put/get/exists/refSet/refGet/refList/gc).
 */
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { Effect, ManagedRuntime } from 'effect'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GitContentStore } from '../../src/adapters/driven/GitContentStore.ts'
import { InMemoryContentStore } from '../../src/adapters/driven/InMemoryContentStore.ts'
import { ContentStore } from '../../src/ports/driven/ContentStore.ts'

const execFileAsync = promisify(execFile)

// ─── helpers ─────────────────────────────────────────────────────────────────

const enc = (s: string) => new TextEncoder().encode(s)
const dec = (b: Uint8Array) => new TextDecoder().decode(b)

// SHA-256 hex: 64 lowercase hex characters.
const SHA256_RE = /^[0-9a-f]{64}$/u

const makeTempGitRepo = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'cas-test-'))
  await execFileAsync('git', ['init', dir])
  await execFileAsync('git', ['-C', dir, 'config', 'user.email', 'test@example.com'])
  await execFileAsync('git', ['-C', dir, 'config', 'user.name', 'Test'])
  return dir
}

// ─── shared contract ─────────────────────────────────────────────────────────

function runContract(name: string, makeLayer: () => Promise<ManagedRuntime.ManagedRuntime<ContentStore, never>>) {
  describe(name, () => {
    let rt: ManagedRuntime.ManagedRuntime<ContentStore, never>

    beforeAll(async () => {
      rt = await makeLayer()
    })

    afterAll(() => rt.dispose())

    const run = <A>(effect: Effect.Effect<A, unknown, ContentStore>) => rt.runPromise(effect)

    it('put returns a SHA-256 content hash', async () => {
      const hash = await run(
        Effect.gen(function* () {
          const store = yield* ContentStore
          return yield* store.put(enc('hello world'))
        }),
      )
      expect(hash).toMatch(SHA256_RE)
    })

    it('put is content-addressed: same bytes yield same hash', async () => {
      const [h1, h2] = await Promise.all([
        run(
          Effect.gen(function* () {
            const store = yield* ContentStore
            return yield* store.put(enc('deterministic'))
          }),
        ),
        run(
          Effect.gen(function* () {
            const store = yield* ContentStore
            return yield* store.put(enc('deterministic'))
          }),
        ),
      ])
      expect(h1).toBe(h2)
    })

    it('put + get round-trips the bytes', async () => {
      const result = await run(
        Effect.gen(function* () {
          const store = yield* ContentStore
          const hash = yield* store.put(enc('round-trip content'))
          return yield* store.get(hash)
        }),
      )
      expect(dec(result as Uint8Array)).toBe('round-trip content')
    })

    it('get returns undefined for an unknown hash', async () => {
      const result = await run(
        Effect.gen(function* () {
          const store = yield* ContentStore
          return yield* store.get('0'.repeat(64))
        }),
      )
      expect(result).toBeUndefined()
    })

    it('exists returns true after put', async () => {
      const result = await run(
        Effect.gen(function* () {
          const store = yield* ContentStore
          const hash = yield* store.put(enc('exists-test'))
          return yield* store.exists(hash)
        }),
      )
      expect(result).toBeTruthy()
    })

    it('exists returns false for an unknown hash', async () => {
      const result = await run(
        Effect.gen(function* () {
          const store = yield* ContentStore
          return yield* store.exists('a'.repeat(64))
        }),
      )
      expect(result).toBeFalsy()
    })

    it('refSet + refGet round-trips the hash', async () => {
      const fetched = await run(
        Effect.gen(function* () {
          const store = yield* ContentStore
          const hash = yield* store.put(enc('ref-content'))
          yield* store.refSet('test/my-ref', hash)
          return yield* store.refGet('test/my-ref')
        }),
      )
      expect(fetched).toMatch(SHA256_RE)
    })

    it('refGet returns undefined for unknown ref', async () => {
      const result = await run(
        Effect.gen(function* () {
          const store = yield* ContentStore
          return yield* store.refGet('test/no-such-ref')
        }),
      )
      expect(result).toBeUndefined()
    })

    it('refList returns refs matching prefix', async () => {
      const names = await run(
        Effect.gen(function* () {
          const store = yield* ContentStore
          const hash = yield* store.put(enc('list-content'))
          yield* store.refSet('list-test/alpha', hash)
          yield* store.refSet('list-test/beta', hash)
          yield* store.refSet('other/gamma', hash)
          return yield* store.refList('list-test')
        }),
      )
      expect(names).toContain('list-test/alpha')
      expect(names).toContain('list-test/beta')
      expect(names).not.toContain('other/gamma')
    })

    it('gc removes unreachable blobs and returns count', async () => {
      const removed = await run(
        Effect.gen(function* () {
          const store = yield* ContentStore
          const keep = yield* store.put(enc('keep-me'))
          yield* store.put(enc('remove-me'))
          return yield* store.gc(new Set([keep]))
        }),
      )
      expect(removed).toBeGreaterThanOrEqual(1)
    })

    it('gc leaves reachable blobs intact', async () => {
      const bytes = await run(
        Effect.gen(function* () {
          const store = yield* ContentStore
          const hash = yield* store.put(enc('survive-gc'))
          yield* store.gc(new Set([hash]))
          return yield* store.get(hash)
        }),
      )
      expect(dec(bytes as Uint8Array)).toBe('survive-gc')
    })
  })
}

// ─── adapter configurations ──────────────────────────────────────────────────

runContract('InMemoryContentStore', async () => ManagedRuntime.make(InMemoryContentStore.layer))

runContract('GitContentStore', async () => {
  const repoDir = await makeTempGitRepo()
  return ManagedRuntime.make(GitContentStore.layer(repoDir))
})
