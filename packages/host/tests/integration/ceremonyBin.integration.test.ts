/**
 * Integration test for bin/ceremony.ts wiring (L0.2, L0.5, §6).
 *
 * Tests the setup → sign → verify pipeline through real file I/O, exercising
 * the same layer composition that bin/ceremony.ts uses:
 *   generateKeypair (domain) → writeKeypair / readPublicKey (CeremonyKeyStore adapter)
 *   → signAmendment (domain) → checkQuorum (domain)
 *
 * The emit command (SqliteEventStore) is covered by SqliteEventStore protocol tests.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { Effect } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from '@effect/vitest'
import { readPublicKey, writeKeypair } from '../../src/adapters/driven/CeremonyKeyStore.ts'
import {
  ALL_SIGNER_ROLES,
  checkQuorum,
  generateKeypair,
  hashAmendment,
  signAmendment,
} from '../../src/domain/ceremony.ts'
import type { AmendmentSignatures, SignerRole } from '../../src/domain/ceremony.ts'

let keyStoreDir: string
let amendmentFile: string

beforeEach(async () => {
  keyStoreDir = await mkdtemp('/tmp/ceremony-bin-test-')
  amendmentFile = `${keyStoreDir}/amendment.json`
})

afterEach(async () => {
  await rm(keyStoreDir, { recursive: true })
})

const setupKeypairs = () =>
  Effect.gen(function* () {
    const kps: Partial<Record<SignerRole, ReturnType<typeof generateKeypair>>> = {}
    for (const role of ALL_SIGNER_ROLES) {
      const kp = generateKeypair(role)
      yield* writeKeypair(keyStoreDir, kp)
      kps[role] = kp
    }
    return kps as Record<SignerRole, ReturnType<typeof generateKeypair>>
  })

const loadPublicKeys = () =>
  Effect.gen(function* () {
    const entries: [SignerRole, string][] = []
    for (const role of ALL_SIGNER_ROLES) {
      entries.push([role, yield* readPublicKey(keyStoreDir, role)])
    }
    return Object.fromEntries(entries) as Record<SignerRole, string>
  })

describe('ceremonyBin — setup (bin/ceremony.ts setup)', () => {
  it.effect('generates all 5 keypairs and PEM files are readable', () =>
    Effect.gen(function* () {
      yield* setupKeypairs()
      for (const role of ALL_SIGNER_ROLES) {
        const pub = yield* readPublicKey(keyStoreDir, role)
        expect(pub).toContain('BEGIN PUBLIC KEY')
      }
    }),
  )
})

describe('ceremonyBin — sign + verify pipeline (bin/ceremony.ts sign + verify)', () => {
  const CONTENT = 'Amend L2.10 to allow up to 5 versioned roles.'

  it.effect('2 witnesses + required signers achieves quorum (L0.2)', () =>
    Effect.gen(function* () {
      const kps = yield* setupKeypairs()
      const contentHash = hashAmendment(CONTENT)
      yield* Effect.tryPromise(() =>
        writeFile(
          amendmentFile,
          JSON.stringify({ amendmentId: 'test-amendment-1', content: CONTENT, contentHash }),
          'utf8',
        ),
      )

      const sigs: AmendmentSignatures = {
        claude: signAmendment(contentHash, kps.claude.privateKeyPem),
        'user-of-record': signAmendment(contentHash, kps['user-of-record'].privateKeyPem),
        witness1: signAmendment(contentHash, kps.witness1.privateKeyPem),
        witness2: signAmendment(contentHash, kps.witness2.privateKeyPem),
        witness3: null,
      }
      yield* Effect.tryPromise(() => writeFile(`${amendmentFile}.sigs.json`, JSON.stringify(sigs, null, 2), 'utf8'))

      const pubKeys = yield* loadPublicKeys()
      const result = checkQuorum(sigs, pubKeys, contentHash)

      expect(result.met).toBe(true)
      expect(result.witnessCount).toBe(2)
      expect(result.missingRequired).toHaveLength(0)
    }),
  )

  it.effect('only 1 witness falls short of quorum', () =>
    Effect.gen(function* () {
      const kps = yield* setupKeypairs()
      const contentHash = hashAmendment(CONTENT)

      const sigs: AmendmentSignatures = {
        claude: signAmendment(contentHash, kps.claude.privateKeyPem),
        'user-of-record': signAmendment(contentHash, kps['user-of-record'].privateKeyPem),
        witness1: signAmendment(contentHash, kps.witness1.privateKeyPem),
        witness2: null,
        witness3: null,
      }

      const pubKeys = yield* loadPublicKeys()
      const result = checkQuorum(sigs, pubKeys, contentHash)

      expect(result.met).toBe(false)
      expect(result.witnessCount).toBe(1)
    }),
  )

  it.effect('tampered signature breaks quorum even if witness count appears sufficient', () =>
    Effect.gen(function* () {
      const kps = yield* setupKeypairs()
      const contentHash = hashAmendment(CONTENT)

      const sigs: AmendmentSignatures = {
        claude: signAmendment(contentHash, kps.claude.privateKeyPem),
        'user-of-record': signAmendment(contentHash, kps['user-of-record'].privateKeyPem),
        witness1: 'deadbeef',
        witness2: signAmendment(contentHash, kps.witness2.privateKeyPem),
        witness3: null,
      }

      const pubKeys = yield* loadPublicKeys()
      const result = checkQuorum(sigs, pubKeys, contentHash)

      expect(result.met).toBe(false)
      expect(result.witnessCount).toBe(1)
    }),
  )
})
