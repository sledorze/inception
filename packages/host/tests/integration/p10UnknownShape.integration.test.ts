/**
 * P10 acceptance test — RED — UnknownShapeObserved not emitted to EventStore.
 *
 * Documents the failure mode observed during S1 (task 3.4): when
 * OpenAiCompatLlmProvider.reasoningAwareFetch encounters a message whose shape
 * fails Schema.decodeUnknownOption(LmMessage) (e.g. content is an array, not
 * string/null), it emits console.warn but never writes to EventStore. Claude
 * cannot inspect this anomaly later via outer-MCP replay.
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
  it.effect.fails('RED: writes UnknownShapeObserved to EventStore when message shape is unrecognised', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const fake = yield* Effect.promise(() => startFakeLmstudio([FIXTURE]))

      // content:[1,2,3] fails NullOr(String) → isNone guard fires → console.warn (pre-fix).
      // generateText may fail downstream because the malformed body is passed through.
      yield* LanguageModel.generateText({ prompt: 'x' }).pipe(
        Effect.provide(OpenAiCompatLlmProvider.layer({ baseUrl: fake.baseUrl, model: 'stub' })),
        Effect.ignore,
      )

      yield* Effect.promise(() => fake.close())

      const events = yield* store.query({})
      // RED: 0 events — provider never writes to EventStore (only console.warn).
      // After fix: exactly 1 UnknownShapeObserved event per malformed message.
      expect(events.filter(e => e.kind === 'UnknownShapeObserved')).toHaveLength(1)
    }),
  )
})
