import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { Effect, Ref } from 'effect'
import { DataHandleError, HandleRevoked } from '../../ports/driven/DataHandle.ts'

const execFileAsync = promisify(execFile)

export interface FileBackedHandleOptions {
  readonly id: string
  readonly filePath: string
  readonly schema?: unknown
  readonly redactedSample?: unknown
}

// Bootstrap entropy estimator: 8 bits per byte of returned output (L1.7 phase-1).
const estimateBits = (stdout: string) => stdout.length * 8

const runScriptInProcess = async (script: string, filePath: string) => {
  const dir = await mkdtemp(join(tmpdir(), 'handle-script-'))
  const scriptPath = join(dir, 'script.js')
  await writeFile(scriptPath, script, 'utf8')
  const { stdout } = await execFileAsync(process.execPath, [scriptPath], {
    env: { ...process.env, DATA_FILE: filePath },
    timeout: 30_000,
  })
  return stdout
}

export const FileBackedHandle = {
  create: (opts: FileBackedHandleOptions) =>
    Effect.gen(function* () {
      const alive = yield* Ref.make(true)

      return {
        fetchShape: () =>
          Effect.succeed({
            redactedSample: opts.redactedSample ?? {},
            schema: opts.schema ?? {},
          }),

        id: opts.id,

        isAlive: () => Ref.get(alive),

        revoke: () => Ref.set(alive, false),

        runScript: (script: string) =>
          Effect.gen(function* () {
            if (!(yield* Ref.get(alive))) {
              return yield* Effect.fail(new HandleRevoked({ handleId: opts.id }))
            }
            const stdout = yield* Effect.tryPromise({
              catch: cause => new DataHandleError({ cause }),
              try: () => runScriptInProcess(script, opts.filePath),
            })
            const stdoutHash = createHash('sha256').update(stdout).digest('hex')
            return {
              bitsConsumed: estimateBits(stdout),
              exitCode: 0,
              stdoutHash,
              summary: stdout.slice(0, 512),
            }
          }),
      }
    }),
}
