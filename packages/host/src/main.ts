/**
 * Application entry point.
 * Serves the inner MCP toolkit over HTTP:
 *   GET  /health            — readiness probe
 *   POST /api/tools/:name   — invoke a toolkit tool, returns HandlerResult JSON
 *   POST /goals             — submit a goal; Georges processes it and returns text
 *   GET  /*                 — static frontend (packages/frontend/dist)
 */
import { readFile } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Effect, ManagedRuntime, Option, Schema, Stream } from 'effect'
import { LanguageModel } from 'effect/unstable/ai'
import { readAgentMd } from './application/session.ts'
import { GeorgesToolkit, fullLayer } from './runtime/bind.ts'

const GoalSubmissionSchema = Schema.Struct({
  goal: Schema.String,
  handleId: Schema.String,
})

const __dir = dirname(fileURLToPath(import.meta.url))
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

  // POST /goals — 2.7: inject agent.md as system prompt; 2.8: seed workspace
  if (url === '/goals' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      let raw: unknown
      try {
        raw = JSON.parse(body) as unknown
      } catch {
        res.writeHead(400).end('invalid json')
        return
      }
      rt.runPromise(
        Schema.decodeUnknownEffect(GoalSubmissionSchema)(raw).pipe(
          Effect.flatMap(submission =>
            Effect.gen(function* () {
              // 2.7: read agent.md → system prompt; 2.8: workspace seeded at boot in bind.ts
              const agentMd = yield* readAgentMd()
              const toolkit = yield* GeorgesToolkit
              const response = yield* LanguageModel.generateText({
                prompt: [
                  { content: agentMd, role: 'system' },
                  { content: [{ text: submission.goal, type: 'text' }], role: 'user' },
                ],
                toolkit,
              })
              return response.text
            }),
          ),
        ),
      )
        .then(text => {
          res.writeHead(200, { 'Content-Type': 'text/plain' }).end(text)
        })
        .catch((error: unknown) => {
          res.writeHead(422).end(String(error))
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
