/**
 * Unit tests for External Witness ceremony domain (L0.2, L0.5, §6).
 *
 * Tests cover key generation, sign/verify, and quorum checking.
 * No I/O — all key operations use in-memory PEM strings.
 */
import { describe, expect, it } from 'vitest'
import {
  checkQuorum,
  generateKeypair,
  hashAmendment,
  signAmendment,
  verifySignature,
} from '../../src/domain/ceremony.ts'
import type { AmendmentSignatures, Keypair, SignerRole } from '../../src/domain/ceremony.ts'

// Returns a fully-typed record so indexing never needs !.
const makeKeypairs = (): Record<SignerRole, Keypair> => ({
  claude: generateKeypair('claude'),
  'user-of-record': generateKeypair('user-of-record'),
  witness1: generateKeypair('witness1'),
  witness2: generateKeypair('witness2'),
  witness3: generateKeypair('witness3'),
})

const makePublicKeys = (kps: Record<SignerRole, Keypair>): Record<SignerRole, string> => ({
  claude: kps.claude.publicKeyPem,
  'user-of-record': kps['user-of-record'].publicKeyPem,
  witness1: kps.witness1.publicKeyPem,
  witness2: kps.witness2.publicKeyPem,
  witness3: kps.witness3.publicKeyPem,
})

const CONTENT = 'Amend L2.10 to allow up to 5 versioned roles.'

const EMPTY_SIGS: AmendmentSignatures = {
  claude: null,
  'user-of-record': null,
  witness1: null,
  witness2: null,
  witness3: null,
}

describe('Ceremony — key generation', () => {
  it('generates distinct keypairs for each role', () => {
    const kps = makeKeypairs()
    const pubKeys = [
      kps.claude.publicKeyPem,
      kps['user-of-record'].publicKeyPem,
      kps.witness1.publicKeyPem,
      kps.witness2.publicKeyPem,
      kps.witness3.publicKeyPem,
    ]
    const unique = new Set(pubKeys)
    expect(unique.size).toBe(5)
  })

  it('generated keypair carries the role', () => {
    const kp = generateKeypair('witness1')
    expect(kp.role).toBe('witness1')
  })
})

describe('Ceremony — sign and verify', () => {
  it('sign produces a non-empty hex string', () => {
    const kp = generateKeypair('claude')
    const hash = hashAmendment(CONTENT)
    const sig = signAmendment(hash, kp.privateKeyPem)
    expect(sig).toMatch(/^[0-9a-f]+$/)
    expect(sig.length).toBeGreaterThan(0)
  })

  it('valid signature verifies against the same public key', () => {
    const kp = generateKeypair('claude')
    const hash = hashAmendment(CONTENT)
    const sig = signAmendment(hash, kp.privateKeyPem)
    expect(verifySignature(hash, sig, kp.publicKeyPem)).toBeTruthy()
  })

  it('wrong public key fails verification', () => {
    const kp1 = generateKeypair('claude')
    const kp2 = generateKeypair('witness1')
    const hash = hashAmendment(CONTENT)
    const sig = signAmendment(hash, kp1.privateKeyPem)
    expect(verifySignature(hash, sig, kp2.publicKeyPem)).toBeFalsy()
  })

  it('tampered content hash fails verification', () => {
    const kp = generateKeypair('claude')
    const hash = hashAmendment(CONTENT)
    const sig = signAmendment(hash, kp.privateKeyPem)
    const tamperedHash = hashAmendment(`${CONTENT} (tampered)`)
    expect(verifySignature(tamperedHash, sig, kp.publicKeyPem)).toBeFalsy()
  })

  it('invalid hex signature fails verification gracefully', () => {
    const kp = generateKeypair('claude')
    const hash = hashAmendment(CONTENT)
    expect(verifySignature(hash, 'not-valid-hex', kp.publicKeyPem)).toBeFalsy()
  })
})

describe('Ceremony — quorum checking (L0.2, §6)', () => {
  it('quorum not met with no signatures', () => {
    const kps = makeKeypairs()
    const hash = hashAmendment(CONTENT)
    const pubKeys = makePublicKeys(kps)
    const result = checkQuorum(EMPTY_SIGS, pubKeys, hash)
    expect(result.met).toBeFalsy()
    expect(result.witnessCount).toBe(0)
    expect(result.missingRequired).toContain('claude')
    expect(result.missingRequired).toContain('user-of-record')
  })

  it('quorum not met with only claude + user-of-record (0 witnesses)', () => {
    const kps = makeKeypairs()
    const hash = hashAmendment(CONTENT)
    const pubKeys = makePublicKeys(kps)
    const sigs: AmendmentSignatures = {
      ...EMPTY_SIGS,
      claude: signAmendment(hash, kps.claude.privateKeyPem),
      'user-of-record': signAmendment(hash, kps['user-of-record'].privateKeyPem),
    }
    const result = checkQuorum(sigs, pubKeys, hash)
    expect(result.met).toBeFalsy()
    expect(result.witnessCount).toBe(0)
  })

  it('quorum not met with claude + user-of-record + only 1 witness', () => {
    const kps = makeKeypairs()
    const hash = hashAmendment(CONTENT)
    const pubKeys = makePublicKeys(kps)
    const sigs: AmendmentSignatures = {
      ...EMPTY_SIGS,
      claude: signAmendment(hash, kps.claude.privateKeyPem),
      'user-of-record': signAmendment(hash, kps['user-of-record'].privateKeyPem),
      witness1: signAmendment(hash, kps.witness1.privateKeyPem),
    }
    const result = checkQuorum(sigs, pubKeys, hash)
    expect(result.met).toBeFalsy()
    expect(result.witnessCount).toBe(1)
  })

  it('quorum met with claude + user-of-record + 2 witnesses (L0.2)', () => {
    const kps = makeKeypairs()
    const hash = hashAmendment(CONTENT)
    const pubKeys = makePublicKeys(kps)
    const sigs: AmendmentSignatures = {
      ...EMPTY_SIGS,
      claude: signAmendment(hash, kps.claude.privateKeyPem),
      'user-of-record': signAmendment(hash, kps['user-of-record'].privateKeyPem),
      witness1: signAmendment(hash, kps.witness1.privateKeyPem),
      witness2: signAmendment(hash, kps.witness2.privateKeyPem),
    }
    const result = checkQuorum(sigs, pubKeys, hash)
    expect(result.met).toBeTruthy()
    expect(result.witnessCount).toBe(2)
    expect(result.missingRequired.length).toBe(0)
  })

  it('quorum met with all 5 signatures (full participation)', () => {
    const kps = makeKeypairs()
    const hash = hashAmendment(CONTENT)
    const pubKeys = makePublicKeys(kps)
    const sigs: AmendmentSignatures = {
      claude: signAmendment(hash, kps.claude.privateKeyPem),
      'user-of-record': signAmendment(hash, kps['user-of-record'].privateKeyPem),
      witness1: signAmendment(hash, kps.witness1.privateKeyPem),
      witness2: signAmendment(hash, kps.witness2.privateKeyPem),
      witness3: signAmendment(hash, kps.witness3.privateKeyPem),
    }
    const result = checkQuorum(sigs, pubKeys, hash)
    expect(result.met).toBeTruthy()
    expect(result.witnessCount).toBe(3)
  })

  it('tampered signature invalidates that signer (quorum fails if now below threshold)', () => {
    const kps = makeKeypairs()
    const hash = hashAmendment(CONTENT)
    const pubKeys = makePublicKeys(kps)
    const sigs: AmendmentSignatures = {
      ...EMPTY_SIGS,
      claude: signAmendment(hash, kps.claude.privateKeyPem),
      'user-of-record': signAmendment(hash, kps['user-of-record'].privateKeyPem),
      witness1: 'deadbeef', // tampered
      witness2: signAmendment(hash, kps.witness2.privateKeyPem),
    }
    // witness1 tampered → only 1 valid witness → quorum not met
    const result = checkQuorum(sigs, pubKeys, hash)
    expect(result.met).toBeFalsy()
    expect(result.witnessCount).toBe(1)
  })
})
