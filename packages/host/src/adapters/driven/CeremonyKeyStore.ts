import { Data, Effect, FileSystem, Path } from 'effect'
import type { Keypair, SignerRole } from '../../domain/ceremony.ts'

class CeremonyIOError extends Data.TaggedError('@app/host/CeremonyIOError')<{
  cause: unknown
}> {}

export const writeKeypair = Effect.fn('CeremonyKeyStore.writeKeypair')(function* (keyStoreDir: string, kp: Keypair) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  yield* fs
    .writeFileString(path.join(keyStoreDir, `${kp.role}.private.pem`), kp.privateKeyPem)
    .pipe(Effect.mapError(cause => new CeremonyIOError({ cause })))
  yield* fs
    .writeFileString(path.join(keyStoreDir, `${kp.role}.public.pem`), kp.publicKeyPem)
    .pipe(Effect.mapError(cause => new CeremonyIOError({ cause })))
})

export const readPublicKey = Effect.fn('CeremonyKeyStore.readPublicKey')(function* (
  keyStoreDir: string,
  role: SignerRole,
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  return yield* fs
    .readFileString(path.join(keyStoreDir, `${role}.public.pem`))
    .pipe(Effect.mapError(cause => new CeremonyIOError({ cause })))
})

export const readPrivateKey = Effect.fn('CeremonyKeyStore.readPrivateKey')(function* (
  keyStoreDir: string,
  role: SignerRole,
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  return yield* fs
    .readFileString(path.join(keyStoreDir, `${role}.private.pem`))
    .pipe(Effect.mapError(cause => new CeremonyIOError({ cause })))
})
