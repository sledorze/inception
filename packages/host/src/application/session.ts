import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Effect, Schema } from 'effect'

const __dir = import.meta.dirname
export const AGENT_MD_PATH = join(__dir, '../bootstrap/agent.md')

export class SessionError extends Schema.TaggedErrorClass<SessionError>()('@app/host/SessionError', {
  cause: Schema.Defect,
}) {}

// Reads the agent system-prompt from the given path.
// Production callers pass AGENT_MD_PATH; tests pass a tmpfile to probe the error branch.
export const readAgentMd = Effect.fn('session.readAgentMd')(function* ({ path }: { path: string }) {
  return yield* Effect.tryPromise({
    catch: cause => new SessionError({ cause }),
    try: () => readFile(path, 'utf8'),
  })
})
