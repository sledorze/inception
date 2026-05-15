/**
 * Integration test for bin/user.ts wiring.
 *
 * Spawns bin/user.ts against an in-process HTTP stub to verify the client
 * sends the correct JSON body and handles HTTP responses correctly.
 *
 * Uses async spawn (not spawnSync) — spawnSync would block the event loop,
 * preventing the parent from accepting connections from the child process.
 */
import { createServer } from 'node:http'
import type { AddressInfo, Server } from 'node:net'
import { spawn } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from '@effect/vitest'

const REPO_ROOT = new URL('../../../../', import.meta.url).pathname
const TSX = `${REPO_ROOT}node_modules/.bin/tsx`
const BIN = new URL('../../bin/user.ts', import.meta.url).pathname

function runBin(port: number, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise(resolve => {
    const child = spawn(TSX, [BIN, ...args], {
      encoding: 'utf8',
      env: { ...process.env, USER_GATEWAY_PORT: String(port) },
    } as Parameters<typeof spawn>[2])
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (c: Buffer) => {
      stdout += c.toString()
    })
    child.stderr?.on('data', (c: Buffer) => {
      stderr += c.toString()
    })
    child.on('close', code => resolve({ exitCode: code ?? 1, stderr, stdout }))
  })
}

describe('userBin — HTTP client wiring (bin/user.ts)', () => {
  let server: Server
  let port: number
  let lastBody: string

  beforeEach(
    () =>
      new Promise<void>(resolve => {
        lastBody = ''
        server = createServer((req, res) => {
          let raw = ''
          req.on('data', (c: Buffer) => {
            raw += c.toString()
          })
          req.on('end', () => {
            lastBody = raw
            res.writeHead(200, { 'Content-Type': 'application/json' }).end('{}')
          })
        })
        server.listen(0, '127.0.0.1', () => {
          port = (server.address() as AddressInfo).port
          resolve()
        })
      }),
  )

  afterEach(
    () =>
      new Promise<void>(resolve => {
        server.close(() => resolve())
      }),
  )

  it('POSTs goal and handleId as JSON to /goals', async () => {
    const { exitCode, stdout } = await runBin(port, ['my goal', 'handle-1'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Goal submitted.')
    const body = JSON.parse(lastBody) as { goal: string; handleId: string }
    expect(body.goal).toBe('my goal')
    expect(body.handleId).toBe('handle-1')
  })

  it('exits 1 and writes to stderr on non-200 response', async () => {
    server.removeAllListeners('request')
    server.on('request', (_req, res) => {
      res.writeHead(400).end('bad request')
    })
    const { exitCode, stderr } = await runBin(port, ['bad goal', 'h2'])
    expect(exitCode).toBe(1)
    expect(stderr).toContain('400')
  })

  it('exits 1 with usage message when args are missing', async () => {
    const { exitCode, stderr } = await runBin(port, [])
    expect(exitCode).toBe(1)
    expect(stderr).toContain('Usage')
  })
})
