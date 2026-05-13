import type { Effect } from 'effect'
import { Context, Schema } from 'effect'

export class WorkspaceMountError extends Schema.TaggedErrorClass<WorkspaceMountError>()(
  '@app/host/WorkspaceMountError',
  { cause: Schema.Defect, path: Schema.String },
) {}

export class WorkspaceMount extends Context.Service<
  WorkspaceMount,
  {
    readonly rootPath: Effect.Effect<string>
    readonly read: (relativePath: string) => Effect.Effect<string, WorkspaceMountError>
    readonly write: (relativePath: string, content: string) => Effect.Effect<void, WorkspaceMountError>
    readonly list: (relativeDir: string) => Effect.Effect<readonly string[], WorkspaceMountError>
  }
>()('@app/host/WorkspaceMount') {}
