/**
 * Application entry point.
 * Serves the inner MCP toolkit over HTTP:
 *   GET  /health            — readiness probe
 *   POST /api/tools/:name   — invoke a toolkit tool, returns HandlerResult JSON
 *   GET  /*                 — static frontend (packages/frontend/dist)
 */
import { readFile } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Effect, Layer, ManagedRuntime, Option, Stream } from 'effect'
import { InMemoryEventStore } from './adapters/driven/InMemoryEventStore.ts'
import { InMemoryToolRegistry } from './adapters/driven/InMemoryToolRegistry.ts'
import { InMemoryWorkspaceMount } from './adapters/driven/InMemoryWorkspaceMount.ts'
import { GeorgesToolkit, GeorgesToolkitLive } from './adapters/driving/GeorgesToolkit.ts'

const __dir = dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env['PORT'] ?? '3000', 10)
const TOOLS_YAML = join(__dir, 'bootstrap', 'tools.yaml')
const DIST = join(__dir, '../../frontend/dist')

const MIME: Record<string, string> = {
  '.css': 'text/css',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
}

const appLayer = GeorgesToolkitLive.pipe(
  Layer.provide(InMemoryEventStore.layer),
  Layer.provide(InMemoryToolRegistry.layerFromYamlFile(TOOLS_YAML)),
  Layer.provide(InMemoryWorkspaceMount.layer()),
)

const rt = ManagedRuntime.make(appLayer)

const TOOL_ROUTE = /^\/api\/tools\/([^/?]+)/

const server = createServer((req, res) => {
  const url = req.url ?? '/'

  if (url === '/health') {
    res.writeHead(200).end('ok')
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
