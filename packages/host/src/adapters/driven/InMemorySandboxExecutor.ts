import { Effect, Layer } from 'effect'
import { SandboxExecutor } from '../../ports/driven/SandboxExecutor.ts'
import type { SandboxResult } from '../../ports/driven/SandboxExecutor.ts'

export const InMemorySandboxExecutor = {
  layer: (result: SandboxResult) =>
    Layer.effect(
      SandboxExecutor,
      Effect.succeed(
        SandboxExecutor.of({
          run: (_script, _constraints) => Effect.succeed(result),
        }),
      ),
    ),
}
