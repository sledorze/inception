import type { Effect } from 'effect'
import { Context, Schema } from 'effect'

export type ContentHash = string

export class ContentStoreError extends Schema.TaggedErrorClass<ContentStoreError>()('@app/host/ContentStoreError', {
  cause: Schema.Defect,
}) {}

export class ContentStore extends Context.Service<
  ContentStore,
  {
    readonly put: (content: Uint8Array) => Effect.Effect<ContentHash, ContentStoreError>
    readonly get: (hash: ContentHash) => Effect.Effect<Uint8Array | undefined, ContentStoreError>
    readonly exists: (hash: ContentHash) => Effect.Effect<boolean, ContentStoreError>
    readonly refSet: (name: string, hash: ContentHash) => Effect.Effect<void, ContentStoreError>
    readonly refGet: (name: string) => Effect.Effect<ContentHash | undefined, ContentStoreError>
    readonly refList: (prefix: string) => Effect.Effect<readonly string[], ContentStoreError>
    readonly gc: (reachable: ReadonlySet<ContentHash>) => Effect.Effect<number, ContentStoreError>
  }
>()('@app/host/ContentStore') {}
