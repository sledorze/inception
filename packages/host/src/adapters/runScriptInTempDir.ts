import { execFile } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface RunScriptOptions {
  readonly code: string
  readonly env?: NodeJS.ProcessEnv
  readonly filename?: string
  readonly prefix?: string
  readonly timeout?: number
}

// Returns a Promise chain (no async keyword) suitable for Effect.tryPromise.try.
export const runScriptInTempDir = (opts: RunScriptOptions): Promise<string> =>
  mkdtemp(join(tmpdir(), opts.prefix ?? 'script-'))
    .then(dir => {
      const scriptPath = join(dir, opts.filename ?? 'script.js')
      return writeFile(scriptPath, opts.code, 'utf8').then(() => scriptPath)
    })
    .then(scriptPath =>
      execFileAsync(process.execPath, [scriptPath], {
        env: opts.env ?? process.env,
        timeout: opts.timeout ?? 30_000,
      }).then(({ stdout }) => stdout),
    )
