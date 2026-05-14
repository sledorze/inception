import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Effect, Schema } from 'effect'

const __dir = dirname(fileURLToPath(import.meta.url))
const AGENT_MD_PATH = join(__dir, '../bootstrap/agent.md')

export class SessionError extends Schema.TaggedErrorClass<SessionError>()('@app/host/SessionError', {
  cause: Schema.Defect,
}) {}

// Reads the agent system-prompt from the bootstrap directory.
export const readAgentMd = Effect.fn('session.readAgentMd')(function* () {
  return yield* Effect.tryPromise({
    catch: cause => new SessionError({ cause }),
    try: () => readFile(AGENT_MD_PATH, 'utf8'),
  })
})
