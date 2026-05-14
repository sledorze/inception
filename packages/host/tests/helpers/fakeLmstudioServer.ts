/**
 * Fixture playback server for captured LMStudio wire shapes.
 * Serves fixture JSON files in sequence on successive POST requests.
 * Reusable for any test that needs a deterministic OpenAI-compat HTTP endpoint.
 */
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { AddressInfo, Server } from 'node:net'

export interface FakeLmstudio {
  readonly baseUrl: string
  readonly close: () => Promise<void>
}

/**
 * Starts a local HTTP server that returns fixture files in order on each POST.
 * `fixturePaths` are resolved relative to the host package root (`process.cwd()`).
 * Cycles back to the last fixture once the array is exhausted.
 */
export const startFakeLmstudio = (fixturePaths: readonly string[]): Promise<FakeLmstudio> =>
  new Promise(resolve_ => {
    let i = 0
    const server: Server = createServer((req, res) => {
      const idx = Math.min(i++, fixturePaths.length - 1)
      const fixturePath = fixturePaths[idx]
      if (fixturePath === undefined) {
        res.writeHead(500).end('no fixtures configured')
        return
      }
      const body = readFileSync(resolve(process.cwd(), fixturePath), 'utf8')
      req.on('data', () => {})
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(body)
      })
    })
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo
      resolve_({
        baseUrl: `http://127.0.0.1:${addr.port}/v1`,
        close: () =>
          new Promise(r => {
            server.close(() => {
              r()
            })
          }),
      })
    })
  })
