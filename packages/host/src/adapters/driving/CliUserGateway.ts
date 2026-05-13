import { createServer } from 'node:http'
import { Effect, Layer, Schema } from 'effect'
import { UserGateway, UserGatewayError } from '../../ports/driving/UserGateway.ts'

const GoalSubmissionSchema = Schema.Struct({
  goal: Schema.String,
  handleId: Schema.String,
})

const DEFAULT_PORT = parseInt(process.env['USER_GATEWAY_PORT'] ?? '3001', 10)

export const CliUserGateway = {
  layer: (port = DEFAULT_PORT) =>
    Layer.effect(
      UserGateway,
      Effect.succeed(
        UserGateway.of({
          listen: onGoal =>
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
                  Effect.runPromise(
                    Schema.decodeUnknownEffect(GoalSubmissionSchema)(raw).pipe(
                      Effect.flatMap(submission => onGoal(submission)),
                    ),
                  )
                    .then(() => {
                      res.writeHead(202).end()
                    })
                    .catch((error: unknown) => {
                      res.writeHead(422).end(String(error))
                    })
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
        }),
      ),
    ),
}
