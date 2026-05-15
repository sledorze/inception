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
// @effect-diagnostics-next-line nodeBuiltinImport:off
import { createServer } from 'node:http'
import { Config, Effect, FileSystem, ManagedRuntime, Option, Random, Stream } from 'effect'
import { makeSubmitGoal } from './application/submitGoal.ts'
import { ClarifyNotFoundError, makeRespondToGoal } from './application/respondToGoal.ts'
import { recordRejection } from './application/rejectionPattern.ts'
import { registerCapability } from './application/registerCapability.ts'
import { listPendingProposals, promoteProposal } from './application/reviewProposals.ts'
import { EventStore } from './ports/driven/EventStore.ts'
import { GeorgesToolkit, fullLayer } from './runtime/bind.ts'
import { UserGateway } from './ports/driving/UserGateway.ts'

// URL-based path avoids node:path import (P24).
const DIST = new URL('../../frontend/dist', import.meta.url).pathname

const MIME: Record<string, string> = {
  '.css': 'text/css',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
}

const extname = (filePath: string): string => {
  const dot = filePath.lastIndexOf('.')
  return dot > filePath.lastIndexOf('/') ? filePath.slice(dot) : ''
}

const rt = ManagedRuntime.make(fullLayer)
const PORT = await rt.runPromise(Config.int('PORT').pipe(Config.withDefault(3000)))

// Start the UserGateway listener as a background fiber — processes goals on :3001
rt.runFork(
  Effect.gen(function* () {
    const gw = yield* UserGateway
    const toolkit = yield* GeorgesToolkit
    yield* gw.listen(submission => makeSubmitGoal(toolkit)(submission).pipe(Effect.asVoid, Effect.orDie))
  }),
)

const TOOL_ROUTE = /^\/api\/tools\/([^/?]+)/u
const PROMOTE_ROUTE = /^\/api\/proposals\/([^/?]+)\/promote$/u
const REJECT_GOAL_ROUTE = /^\/api\/goals\/([^/?]+)\/reject$/u
const SESSION_TURNS_ROUTE = /^\/api\/sessions\/([^/?]+)\/turns$/u
const SESSION_RESPOND_ROUTE = /^\/api\/sessions\/([^/?]+)\/respond$/u

const server = createServer((req, res) => {
  const url = req.url ?? '/'

  if (url === '/health') {
    res.writeHead(200).end('ok')
    return
  }

  if (url === '/api/goals' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      let parsed: unknown
      try {
        parsed = JSON.parse(body) as unknown
      } catch {
        res.writeHead(400).end('invalid json')
        return
      }
      if (typeof parsed !== 'object' || parsed === null || !('goal' in parsed) || !('handleId' in parsed)) {
        res.writeHead(422).end('missing goal or handleId')
        return
      }
      const {
        goal,
        handleId,
        sessionId: reqSessionId,
      } = parsed as {
        goal: string
        handleId: string
        sessionId?: string
      }
      rt.runPromise(
        Effect.gen(function* () {
          const toolkit = yield* GeorgesToolkit
          const sessionId = reqSessionId ?? (yield* Random.nextUUIDv4)
          const { correlationId } = yield* makeSubmitGoal(toolkit)({ goal, handleId, sessionId })
          const store = yield* EventStore
          const events = yield* store.query({ correlationId, sessionId })
          const clarifyEvent = events.findLast(e => e.kind === 'ClarifyRequested')
          if (clarifyEvent !== undefined) {
            const { question } = clarifyEvent.payload as { question: string }
            return { clarifyQuestion: question, correlationId, sessionId }
          }
          return {
            correlationId,
            sessionId,
            ...(events.findLast(e => e.kind === 'GoalCompleted')?.payload as Record<string, unknown> | undefined),
          }
        }),
      )
        .then(payload => {
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(payload))
        })
        .catch((error: unknown) => {
          res.writeHead(500).end(String(error))
        })
    })
    return
  }

  const rejectMatch = REJECT_GOAL_ROUTE.exec(url)
  if (rejectMatch !== null && req.method === 'POST') {
    const correlationId = decodeURIComponent(rejectMatch[1] ?? '')
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      let parsed: unknown
      try {
        parsed = JSON.parse(body) as unknown
      } catch {
        res.writeHead(400).end('invalid json')
        return
      }
      const parsedObj = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
      const reason = typeof parsedObj['reason'] === 'string' ? parsedObj['reason'] : 'no reason given'
      const sessionId = typeof parsedObj['sessionId'] === 'string' ? parsedObj['sessionId'] : 'bootstrap'
      rt.runPromise(
        recordRejection({
          correlationId,
          reason,
          sessionId,
          storyRef: 'S3',
        }),
      )
        .then(() => {
          res.writeHead(204).end()
        })
        .catch((error: unknown) => {
          res.writeHead(500).end(String(error))
        })
    })
    return
  }

  if (url === '/api/proposals' && req.method === 'GET') {
    rt.runPromise(listPendingProposals)
      .then(proposals => {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(proposals))
      })
      .catch((error: unknown) => {
        res.writeHead(500).end(String(error))
      })
    return
  }

  const promoteMatch = PROMOTE_ROUTE.exec(url)
  if (promoteMatch !== null && req.method === 'POST') {
    const proposalId = decodeURIComponent(promoteMatch[1] ?? '')
    rt.runPromise(
      Effect.gen(function* () {
        yield* promoteProposal(proposalId, undefined)
        return yield* registerCapability(proposalId)
      }),
    )
      .then(version => {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ version }))
      })
      .catch((error: unknown) => {
        res.writeHead(500).end(String(error))
      })
    return
  }

  const sessionTurnsMatch = SESSION_TURNS_ROUTE.exec(url)
  if (sessionTurnsMatch !== null && req.method === 'GET') {
    const sessionId = decodeURIComponent(sessionTurnsMatch[1] ?? '')
    rt.runPromise(
      Effect.gen(function* () {
        const store = yield* EventStore
        const events = yield* store.query({ sessionId })
        const goals = new Map<string, string>()
        const replies = new Map<string, string>()
        const clarifyQuestions = new Map<string, string>()
        const clarifyAnswers = new Map<string, string>()
        const order: string[] = []
        for (const e of events) {
          if (e.kind === 'GoalSubmitted') {
            const p = e.payload as { goal: string }
            goals.set(e.correlationId, p.goal)
            order.push(e.correlationId)
          } else if (e.kind === 'GoalCompleted') {
            const p = e.payload as { text: string }
            replies.set(e.correlationId, p.text ?? '')
          } else if (e.kind === 'ClarifyRequested') {
            const p = e.payload as { question: string }
            clarifyQuestions.set(e.correlationId, p.question)
          } else if (e.kind === 'ClarifyAnswered') {
            const p = e.payload as { answer: string }
            clarifyAnswers.set(e.correlationId, p.answer)
          }
        }
        let idx = 0
        return order
          .filter(cid => replies.has(cid) || clarifyQuestions.has(cid))
          .map(cid => {
            const turn: Record<string, unknown> = {
              correlationId: cid,
              goal: goals.get(cid) ?? '',
              turnIndex: idx++,
            }
            const reply = replies.get(cid)
            const clarifyQuestion = clarifyQuestions.get(cid)
            const clarifyAnswer = clarifyAnswers.get(cid)
            if (reply !== undefined) {
              turn['reply'] = reply
            }
            if (clarifyQuestion !== undefined) {
              turn['clarifyQuestion'] = clarifyQuestion
            }
            if (clarifyAnswer !== undefined) {
              turn['clarifyAnswer'] = clarifyAnswer
            }
            return turn
          })
      }),
    )
      .then(turns => {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(turns))
      })
      .catch((error: unknown) => {
        res.writeHead(500).end(String(error))
      })
    return
  }

  const sessionRespondMatch = SESSION_RESPOND_ROUTE.exec(url)
  if (sessionRespondMatch !== null && req.method === 'POST') {
    const sessionId = decodeURIComponent(sessionRespondMatch[1] ?? '')
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      let parsed: unknown
      try {
        parsed = JSON.parse(body) as unknown
      } catch {
        res.writeHead(400).end('invalid json')
        return
      }
      const obj = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
      const correlationId = typeof obj['correlationId'] === 'string' ? obj['correlationId'] : ''
      const answer = typeof obj['answer'] === 'string' ? obj['answer'] : ''
      if (!correlationId || !answer) {
        res.writeHead(422).end('missing correlationId or answer')
        return
      }
      rt.runPromise(
        Effect.gen(function* () {
          const toolkit = yield* GeorgesToolkit
          return yield* makeRespondToGoal(toolkit)(correlationId, answer, sessionId)
        }).pipe(
          Effect.catchTag('@app/host/ClarifyNotFoundError', () => Effect.fail(new Error('no pending clarification'))),
        ),
      )
        .then(result => {
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result))
        })
        .catch((error: unknown) => {
          if (String(error).includes('no pending clarification')) {
            res.writeHead(404).end('no pending clarification for this correlationId')
          } else {
            res.writeHead(500).end(String(error))
          }
        })
    })
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
  if (toolMatch !== null && req.method === 'POST') {
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
  const filePath = `${DIST}${urlPath}`
  void rt
    .runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        return yield* fs.readFile(filePath).pipe(Effect.orDie)
      }),
    )
    .then(data => {
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' }).end(data)
    })
    .catch(() => {
      void rt
        .runPromise(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem
            return yield* fs.readFile(`${DIST}/index.html`).pipe(Effect.orDie)
          }),
        )
        .then(fallback => {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(fallback)
        })
        .catch(() => {
          res.writeHead(404).end('not found')
        })
    })
})

server.listen(PORT, () => {
  process.stdout.write(`host server on :${String(PORT)}\n`)
})

process.on('SIGTERM', () => {
  server.close()
  rt.dispose().catch(() => {
    /* ignore dispose errors on shutdown */
  })
})
