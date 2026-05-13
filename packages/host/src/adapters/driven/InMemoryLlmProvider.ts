import { Effect, Layer } from 'effect'
import { LlmProvider, LlmProviderError } from '../../ports/driven/LlmProvider.ts'
import type { LlmRequest, LlmResponse } from '../../ports/driven/LlmProvider.ts'

export type InMemoryReply = (req: LlmRequest) => LlmResponse

export const InMemoryLlmProvider = {
  layer: (reply: InMemoryReply) =>
    Layer.effect(
      LlmProvider,
      Effect.succeed(
        LlmProvider.of({
          complete: req =>
            Effect.try({
              catch: cause => new LlmProviderError({ cause }),
              try: () => reply(req),
            }),
        }),
      ),
    ),
}
