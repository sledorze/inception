/**
 * Protocol contract test for the WorkspaceMount driven port.
 * Parametrised over all bound backing adapters — Liskov substitution proven by test, not intent (§2.13).
 * Laws exercised: L2.14 (port contract), L1.5 (workspace boundary checked on boot).
 */
import { execFile } from 'node:child_process'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { Layer } from 'effect'
import { Effect, ManagedRuntime } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from '@effect/vitest'
import { GitWorkspaceMount } from '../../src/adapters/driven/GitWorkspaceMount.ts'
import { InMemoryWorkspaceMount } from '../../src/adapters/driven/InMemoryWorkspaceMount.ts'
import type { WorkspaceMountError } from '../../src/ports/driven/WorkspaceMount.ts'
import { WorkspaceMount } from '../../src/ports/driven/WorkspaceMount.ts'

const execFileAsync = promisify(execFile)

// Create an isolated git repo in a temp directory.
const makeTempGitRepo = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ws-test-'))
  await execFileAsync('git', ['-C', dir, 'init'])
  await execFileAsync('git', ['-C', dir, 'config', 'user.email', 'test@test.local'])
  await execFileAsync('git', ['-C', dir, 'config', 'user.name', 'Test'])
  return dir
}

// ─── shared helpers ───────────────────────────────────────────────────────────

const rootPath = Effect.gen(function* () {
  const wm = yield* WorkspaceMount
  return yield* wm.rootPath
})

const read = (path: string) =>
  Effect.gen(function* () {
    const wm = yield* WorkspaceMount
    return yield* wm.read(path)
  })

const write = (path: string, content: string) =>
  Effect.gen(function* () {
    const wm = yield* WorkspaceMount
    return yield* wm.write(path, content)
  })

const list = (dir: string) =>
  Effect.gen(function* () {
    const wm = yield* WorkspaceMount
    return yield* wm.list(dir)
  })

// ─── shared contract ─────────────────────────────────────────────────────────

type TestLayer = Layer.Layer<WorkspaceMount>

function runContract(name: string, makeLayer: () => Promise<TestLayer> | TestLayer) {
  describe(name, () => {
    let rt: ManagedRuntime.ManagedRuntime<WorkspaceMount, never>

    beforeEach(async () => {
      rt = ManagedRuntime.make(await makeLayer())
    })

    afterEach(() => rt.dispose())

    const run = <A>(effect: Effect.Effect<A, WorkspaceMountError | unknown, WorkspaceMount>) => rt.runPromise(effect)

    it('rootPath returns a non-empty string', async () => {
      const path = await run(rootPath)
      expect(path).toBeTypeOf('string')
      expect(path.length).toBeGreaterThan(0)
    })

    it('write then read round-trips content', async () => {
      await run(write('hello.txt', 'world'))
      const content = await run(read('hello.txt'))
      expect(content).toBe('world')
    })

    it('write creates nested directories', async () => {
      await run(write('sub/dir/file.txt', 'nested'))
      const content = await run(read('sub/dir/file.txt'))
      expect(content).toBe('nested')
    })

    it('read returns WorkspaceMountError for missing file', async () => {
      await expect(run(read('nonexistent.txt'))).rejects.toThrow()
    })

    it('list returns file names written into a directory', async () => {
      await run(write('docs/a.txt', 'a'))
      await run(write('docs/b.txt', 'b'))
      const entries = await run(list('docs'))
      expect(entries).toContain('a.txt')
      expect(entries).toContain('b.txt')
    })
  })
}

// ─── adapter configurations ──────────────────────────────────────────────────

runContract('InMemoryWorkspaceMount', () => InMemoryWorkspaceMount.layer())

runContract('GitWorkspaceMount', async () => {
  const dir = await makeTempGitRepo()
  return GitWorkspaceMount.layer(dir)
})
