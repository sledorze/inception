import { createServer } from 'node:http'
import { Config, Effect, Layer, Queue, Schema } from 'effect'
import { UserGateway, UserGatewayError } from '../../ports/driving/UserGateway.ts'
import type { GoalSubmission } from '../../ports/driving/UserGateway.ts'

const GoalSubmissionSchema = Schema.Struct({
  goal: Schema.String,
  handleId: Schema.String,
})

const makeListenEffect = <R>(
  port: number,
  onGoal: (submission: GoalSubmission) => Effect.Effect<void, never, R>,
): Effect.Effect<void, UserGatewayError, R> =>
  Effect.gen(function* () {
    const queue = yield* Queue.unbounded<GoalSubmission>()
    const ctx = yield* Effect.context<R>()

    // HTTP server enqueues only — no service requirements at boundary
    yield* Effect.forkDetach(
      Effect.callback<void, UserGatewayError>(resume => {
        const server = createServer((req, res) => {
          if (req.method !== 'POST' || req.url !== '/goals') {
            res.writeHead(404).end()
            return
          }
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
            void Effect.runPromiseWith(ctx)(
              Schema.decodeUnknownEffect(GoalSubmissionSchema)(raw).pipe(
                Effect.flatMap(submission => Queue.offer(queue, submission)),
                Effect.orDie,
              ),
            )
              .then(() => res.writeHead(202).end())
              .catch(() => res.writeHead(422).end('invalid submission'))
          })
        })

        server.on('error', err => {
          resume(Effect.fail(new UserGatewayError({ cause: err })))
        })

        server.listen(port, '127.0.0.1')

        return Effect.sync(() => {
          server.close()
        })
      }),
    )

    // Drain queue inside Effect context — onGoal's service requirements are satisfied
    return yield* Effect.forever(
      Effect.gen(function* () {
        const submission = yield* Queue.take(queue)
        yield* Effect.forkDetach(onGoal(submission))
      }),
    )
  }) as Effect.Effect<void, UserGatewayError, R>

export const CliUserGateway = {
  layer: (port?: number) =>
    Layer.unwrap(
      Effect.gen(function* () {
        const resolvedPort = port ?? (yield* Config.int('USER_GATEWAY_PORT').pipe(Config.withDefault(3001)))
        return Layer.effect(
          UserGateway,
          Effect.succeed(
            UserGateway.of({
              listen: onGoal => makeListenEffect(resolvedPort, onGoal),
            }),
          ),
        )
      }),
    ),
}
