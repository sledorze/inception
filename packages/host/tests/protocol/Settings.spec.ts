/**
 * Protocol contract test for the Settings driven port.
 * Parametrised over all bound adapters — Liskov substitution proven by test, not intent (§2.13).
 * Laws exercised: L2.14 (port contract), §7.2 (runtime-configurable parameters).
 */
import * as path from 'node:path'
import * as os from 'node:os'
import * as fs from 'node:fs/promises'
import { Effect, Layer, ManagedRuntime } from 'effect'
import * as NodeServices from '@effect/platform-node/NodeServices'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@effect/vitest'
import { FileBackedSettings } from '../../src/adapters/driven/FileBackedSettings.ts'
import { InMemorySettings } from '../../src/adapters/driven/InMemorySettings.ts'
import { DEFAULT_SETTINGS, Settings } from '../../src/ports/driven/Settings.ts'

// ─── shared contract ─────────────────────────────────────────────────────────

function runContract(name: string, makeRuntime: () => ManagedRuntime.ManagedRuntime<Settings, never>) {
  describe(name, () => {
    let rt: ManagedRuntime.ManagedRuntime<Settings, never>

    beforeAll(() => {
      rt = makeRuntime()
    })

    afterAll(() => rt.dispose())

    const run = <A>(effect: Effect.Effect<A, unknown, Settings>) => rt.runPromise(effect)

    it('get() returns AppSettings with all required fields', async () => {
      const settings = await run(
        Effect.gen(function* () {
          const svc = yield* Settings
          return yield* svc.get()
        }),
      )
      expect(settings).toHaveProperty('llmBaseUrl')
      expect(settings).toHaveProperty('llmModel')
      expect(settings).toHaveProperty('sessionMaxTurns')
    })

    it('patch() updates a single field and returns full settings', async () => {
      const updated = await run(
        Effect.gen(function* () {
          const svc = yield* Settings
          return yield* svc.patch({ sessionMaxTurns: 42 })
        }),
      )
      expect(updated.sessionMaxTurns).toBe(42)
      expect(updated.llmBaseUrl).toBeTruthy()
      expect(updated.llmModel).toBeTruthy()
    })

    it('patch() with llmBaseUrl updates only that field', async () => {
      const updated = await run(
        Effect.gen(function* () {
          const svc = yield* Settings
          return yield* svc.patch({ llmBaseUrl: 'http://custom-host:9999/v1' })
        }),
      )
      expect(updated.llmBaseUrl).toBe('http://custom-host:9999/v1')
    })

    it('get() reflects the most recent patch', async () => {
      const seen = await run(
        Effect.gen(function* () {
          const svc = yield* Settings
          yield* svc.patch({ llmModel: 'test-model-v2' })
          return yield* svc.get()
        }),
      )
      expect(seen.llmModel).toBe('test-model-v2')
    })

    it('patch() with empty object leaves settings unchanged', async () => {
      const before = await run(
        Effect.gen(function* () {
          const svc = yield* Settings
          return yield* svc.get()
        }),
      )
      const after = await run(
        Effect.gen(function* () {
          const svc = yield* Settings
          return yield* svc.patch({})
        }),
      )
      // sessionMaxTurns may differ from DEFAULT if previous tests ran in same runtime;
      // check structural equality of the unchanged fields.
      expect(typeof after.llmBaseUrl).toBe('string')
      expect(typeof after.llmModel).toBe('string')
      expect(typeof after.sessionMaxTurns).toBe('number')
      expect(after.llmBaseUrl).toBe(before.llmBaseUrl)
      expect(after.llmModel).toBe(before.llmModel)
    })
  })
}

// ─── adapter configurations ──────────────────────────────────────────────────

runContract('InMemorySettings', () => ManagedRuntime.make(InMemorySettings.layer()))

describe('FileBackedSettings', () => {
  let tmpDir: string
  let settingsPath: string

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'settings-test-'))
    settingsPath = path.join(tmpDir, 'settings.json')
  })

  afterEach(async () => {
    // Reset file between tests so each test starts clean.
    await fs.rm(settingsPath, { force: true })
  })

  afterAll(async () => {
    await fs.rm(tmpDir, { force: true, recursive: true })
  })

  runContract('FileBackedSettings', () =>
    ManagedRuntime.make(FileBackedSettings.layer(settingsPath).pipe(Layer.provide(NodeServices.layer))),
  )

  it('FileBackedSettings uses DEFAULT_SETTINGS when file is absent', async () => {
    const rt = ManagedRuntime.make(FileBackedSettings.layer(settingsPath).pipe(Layer.provide(NodeServices.layer)))
    const result = await rt.runPromise(
      Effect.gen(function* () {
        const svc = yield* Settings
        return yield* svc.get()
      }),
    )
    await rt.dispose()
    expect(result).toEqual(DEFAULT_SETTINGS)
  })

  it('FileBackedSettings persists patch to disk', async () => {
    const rt = ManagedRuntime.make(FileBackedSettings.layer(settingsPath).pipe(Layer.provide(NodeServices.layer)))
    await rt.runPromise(
      Effect.gen(function* () {
        const svc = yield* Settings
        yield* svc.patch({ sessionMaxTurns: 99 })
      }),
    )
    await rt.dispose()
    const raw = await fs.readFile(settingsPath, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    expect(parsed).toMatchObject({ sessionMaxTurns: 99 })
  })
})
