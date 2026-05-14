/**
 * Application entry point.
 * Serves the inner MCP toolkit over HTTP:
 *   GET  /health            — readiness probe
 *   POST /api/tools/:name   — invoke a toolkit tool, returns HandlerResult JSON
 *   GET  /*                 — static frontend (packages/frontend/dist)
 *
 * User goals are received on the UserGateway port (CliUserGateway adapter on
 * a separate HTTP server, default :3001 — see bin/user.ts).
 */
import { readFile } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import { Effect, ManagedRuntime, Option, Stream } from 'effect'
import { makeSubmitGoal } from './application/submitGoal.ts'
import { EventStore } from './ports/driven/EventStore.ts'
import { GeorgesToolkit, fullLayer } from './runtime/bind.ts'
import { UserGateway } from './ports/driving/UserGateway.ts'

const __dir = import.meta.dirname
const PORT = parseInt(process.env['PORT'] ?? '3000', 10)
const DIST = join(__dir, '../../frontend/dist')

const MIME: Record<string, string> = {
  '.css': 'text/css',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
}

const rt = ManagedRuntime.make(fullLayer)

// Start the UserGateway listener as a background fiber — processes goals on :3001
rt.runFork(
  Effect.gen(function* () {
    const gw = yield* UserGateway
    const toolkit = yield* GeorgesToolkit
    yield* gw.listen(submission => makeSubmitGoal(toolkit)(submission).pipe(Effect.orDie))
  }),
)

const TOOL_ROUTE = /^\/api\/tools\/([^/?]+)/u

const server = createServer((req, res) => {
  const url = req.url ?? '/'

  if (url === '/health') {
    res.writeHead(200).end('ok')
    return
  }

  if (url === '/events' && req.method === 'GET') {
    rt.runPromise(
      Effect.gen(function* () {
        const store = yield* EventStore
        return yield* store.query({})
      }),
    )
      .then(events => {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(events, null, 2))
      })
      .catch((error: unknown) => {
        res.writeHead(500).end(String(error))
      })
    return
  }

  const toolMatch = TOOL_ROUTE.exec(url)
  if (toolMatch && req.method === 'POST') {
    const toolName = decodeURIComponent(toolMatch[1] ?? '')
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      let params: unknown
      try {
        params = JSON.parse(body) as unknown
      } catch {
        res.writeHead(400).end('invalid json')
        return
      }
      rt.runPromise(
        Effect.gen(function* () {
          const toolkit = yield* GeorgesToolkit
          const stream = yield* toolkit.handle(toolName as 'list-tools', params as { role: string })
          return yield* Stream.runLast(stream)
        }),
      )
        .then(last => {
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(Option.getOrNull(last)))
        })
        .catch((error: unknown) => {
          res.writeHead(500).end(String(error))
        })
    })
    return
  }

  // Static files — SPA fallback to index.html
  const urlPath = url === '/' ? '/index.html' : (url.split('?')[0] ?? '/index.html')
  const filePath = join(DIST, urlPath)
  readFile(filePath, (error, data) => {
    if (error) {
      readFile(join(DIST, 'index.html'), (error2, fallback) => {
        if (error2) {
          res.writeHead(404).end('not found')
          return
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(fallback)
      })
      return
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' }).end(data)
  })
})

server.listen(PORT, () => {
  console.log(`host server on :${PORT}`)
})

process.on('SIGTERM', () => {
  server.close()
  rt.dispose().catch(console.error)
})
