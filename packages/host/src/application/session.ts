import { Effect, FileSystem, Schema } from 'effect'

export const AGENT_MD_PATH = `${import.meta.dirname}/../bootstrap/agent.md`

export class SessionError extends Schema.TaggedErrorClass<SessionError>()('@app/host/SessionError', {
  cause: Schema.Defect,
}) {}

// Reads the agent system-prompt from the given path.
// Production callers pass AGENT_MD_PATH; tests pass a tmpfile to probe the error branch.
export const readAgentMd = Effect.fn('session.readAgentMd')(function* ({ path }: { path: string }) {
  const fs = yield* FileSystem.FileSystem
  return yield* fs.readFileString(path).pipe(Effect.mapError(cause => new SessionError({ cause })))
})
