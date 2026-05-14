import type { Effect } from 'effect'
import { Context, Schema } from 'effect'

export interface HandleShape {
  readonly schema: unknown
  readonly redactedSample: unknown
}

export interface AggregateResult {
  readonly exitCode: number
  readonly stdoutHash: string
  readonly summary: string
  readonly bitsConsumed: number
}

export class DataHandleError extends Schema.TaggedErrorClass<DataHandleError>()('@app/host/DataHandleError', {
  cause: Schema.Defect,
}) {}

export class HandleRevoked extends Schema.TaggedErrorClass<HandleRevoked>()('@app/host/HandleRevoked', {
  handleId: Schema.String,
}) {}

// Emitted when the per-handle info-budget (L1.7) is exhausted.
export class HandleExhausted extends Schema.TaggedErrorClass<HandleExhausted>()('@app/host/HandleExhausted', {
  bitsConsumed: Schema.Number,
  handleId: Schema.String,
}) {}

export const QuerySensitivitySchema = Schema.Struct({
  norm: Schema.Union([Schema.Literal('l1'), Schema.Literal('l2')]),
  value: Schema.Number,
})
export type QuerySensitivity = typeof QuerySensitivitySchema.Type

export class SensitivityViolation extends Schema.TaggedErrorClass<SensitivityViolation>()(
  '@app/host/SensitivityViolation',
  {
    declared: Schema.Number,
    max: Schema.Number,
    norm: Schema.Union([Schema.Literal('l1'), Schema.Literal('l2')]),
  },
) {}

export interface DataHandle {
  readonly id: string
  readonly fetchShape: () => Effect.Effect<HandleShape, DataHandleError>
  readonly runScript: (
    script: string,
    sensitivity?: QuerySensitivity,
  ) => Effect.Effect<AggregateResult, DataHandleError | HandleRevoked | HandleExhausted | SensitivityViolation>
  readonly revoke: () => Effect.Effect<void>
  readonly isAlive: () => Effect.Effect<boolean>
}

export class DataHandleRegistry extends Context.Service<
  DataHandleRegistry,
  {
    readonly get: (id: string) => Effect.Effect<DataHandle, HandleRevoked>
    readonly register: (handle: DataHandle) => Effect.Effect<void>
  }
>()('@app/host/DataHandleRegistry') {}
