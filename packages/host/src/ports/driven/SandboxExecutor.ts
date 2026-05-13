import type { Effect } from 'effect'
import { Context, Schema } from 'effect'

export interface SandboxConstraints {
  readonly cpuMs: number
  readonly wallMs: number
  readonly memoryMb: number
}

export interface SandboxResult {
  readonly exitCode: number
  readonly stdoutHash: string
  readonly stderrHash: string
}

export class SandboxError extends Schema.TaggedErrorClass<SandboxError>()('@app/host/SandboxError', {
  cause: Schema.Defect,
}) {}

export class SandboxExecutor extends Context.Service<
  SandboxExecutor,
  {
    readonly run: (script: string, constraints: SandboxConstraints) => Effect.Effect<SandboxResult, SandboxError>
  }
>()('@app/host/SandboxExecutor') {}
