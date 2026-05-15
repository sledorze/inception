import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Data, Effect } from 'effect'
import type { Keypair, SignerRole } from '../../domain/ceremony.ts'

export class CeremonyIOError extends Data.TaggedError('@app/host/CeremonyIOError')<{
  cause: unknown
}> {}

export const writeKeypair = Effect.fn('CeremonyKeyStore.writeKeypair')(function* (keyStoreDir: string, kp: Keypair) {
  yield* Effect.tryPromise({
    catch: cause => new CeremonyIOError({ cause }),
    try: () => writeFile(join(keyStoreDir, `${kp.role}.private.pem`), kp.privateKeyPem, 'utf8'),
  })
  yield* Effect.tryPromise({
    catch: cause => new CeremonyIOError({ cause }),
    try: () => writeFile(join(keyStoreDir, `${kp.role}.public.pem`), kp.publicKeyPem, 'utf8'),
  })
})

export const readPublicKey = Effect.fn('CeremonyKeyStore.readPublicKey')(function* (
  keyStoreDir: string,
  role: SignerRole,
): Generator<Effect.Effect<string, CeremonyIOError>, string> {
  return yield* Effect.tryPromise({
    catch: cause => new CeremonyIOError({ cause }),
    try: () => readFile(join(keyStoreDir, `${role}.public.pem`), 'utf8'),
  })
})

export const readPrivateKey = Effect.fn('CeremonyKeyStore.readPrivateKey')(function* (
  keyStoreDir: string,
  role: SignerRole,
): Generator<Effect.Effect<string, CeremonyIOError>, string> {
  return yield* Effect.tryPromise({
    catch: cause => new CeremonyIOError({ cause }),
    try: () => readFile(join(keyStoreDir, `${role}.private.pem`), 'utf8'),
  })
})
