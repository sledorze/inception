/**
 * P10 acceptance test — GREEN — UnknownShapeObserved emitted to EventStore.
 *
 * Fixture: round-stop-unknown-shape.json returns content: [1,2,3] — a type
 * mismatch that defeats NullOr(String) and triggers the isNone guard.
 *
 * Fix (P10): bridge reasoningAwareFetch (Promise territory) to EventStore via
 * a shared Queue injected at boot, similar to CliUserGateway's HTTP callback
 * bridge.
 */
import { Effect } from 'effect'
import { LanguageModel } from 'effect/unstable/ai'
import { expect, layer } from '@effect/vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { OpenAiCompatLlmProvider } from '../../src/adapters/driven/OpenAiCompatLlmProvider.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import { startFakeLmstudio } from '../helpers/fakeLmstudioServer.ts'

const FIXTURE = `${import.meta.dirname}/../fixtures/lmstudio/round-stop-unknown-shape.json`

layer(InMemoryEventStore.layer)('P10 — UnknownShapeObserved emitted to EventStore', it => {
  it.effect('writes UnknownShapeObserved to EventStore when message shape is unrecognised', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const fake = yield* Effect.promise(() => startFakeLmstudio([FIXTURE]))

      // content:[1,2,3] fails NullOr(String) → isNone guard → queue offer → drainer appends.
      yield* LanguageModel.generateText({ prompt: 'x' }).pipe(
        Effect.provide(OpenAiCompatLlmProvider.layer({ baseUrl: fake.baseUrl, model: 'stub' })),
        Effect.ignore,
      )

      yield* Effect.promise(() => fake.close())

      // Yield to let the drainer fiber process the queued shape alert.
      yield* Effect.yieldNow

      const events = yield* store.query({})
      expect(events.filter(e => e.kind === 'UnknownShapeObserved')).toHaveLength(1)
    }),
  )
})
