import { createHash } from 'node:crypto'
import { Effect, Layer, Ref } from 'effect'
import { ContentStore } from '../../ports/driven/ContentStore.ts'
import type { ContentHash } from '../../ports/driven/ContentStore.ts'

const sha256 = (bytes: Uint8Array): ContentHash => createHash('sha256').update(bytes).digest('hex')

export const InMemoryContentStore = {
  layer: Layer.effect(
    ContentStore,
    Effect.gen(function* () {
      const blobs = yield* Ref.make(new Map<ContentHash, Uint8Array>())
      const refs = yield* Ref.make(new Map<string, ContentHash>())

      return ContentStore.of({
        exists: hash => Effect.map(Ref.get(blobs), m => m.has(hash)),

        gc: reachable =>
          Effect.gen(function* () {
            const before = yield* Ref.get(blobs)
            const after = new Map<ContentHash, Uint8Array>()
            let removed = 0
            for (const [hash, content] of before) {
              if (reachable.has(hash)) {
                after.set(hash, content)
              } else {
                removed++
              }
            }
            yield* Ref.set(blobs, after)
            return removed
          }),

        get: hash => Effect.map(Ref.get(blobs), m => m.get(hash)),

        put: content => {
          const hash = sha256(content)
          return Ref.update(blobs, m => new Map([...m, [hash, content]])).pipe(Effect.as(hash))
        },

        refGet: name => Effect.map(Ref.get(refs), m => m.get(name)),

        refList: prefix => Effect.map(Ref.get(refs), m => [...m.keys()].filter(k => k.startsWith(prefix)).sort()),

        refSet: (name, hash) => Ref.update(refs, m => new Map([...m, [name, hash]])),
      })
    }),
  ),
}
