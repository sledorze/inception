/**
 * External Witness pool ceremony — key management and constitutional amendment
 * co-signing (L0.2, L0.5, §6).
 *
 * Quorum rules (bootstrap=true, §12):
 *   - Claude signature:        required (unanimous)
 *   - User-of-record signature: required (unanimous)
 *   - Witness signatures:      2-of-3 required
 *
 * Keys are Ed25519; stored as PEM in the ceremony key store directory.
 * Amendment content is SHA-256 hashed before signing.
 */
import { createHash, generateKeyPairSync, sign, verify } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// ─── roles ────────────────────────────────────────────────────────────────────

export type SignerRole = 'claude' | 'user-of-record' | 'witness1' | 'witness2' | 'witness3'

export const ALL_SIGNER_ROLES: readonly SignerRole[] = ['claude', 'user-of-record', 'witness1', 'witness2', 'witness3']

// ─── amendment schema ─────────────────────────────────────────────────────────

export interface Amendment {
  readonly amendmentId: string
  readonly content: string
  readonly contentHash: string
  readonly proposedAt: string
  readonly proposedBy: string
}

export interface AmendmentSignatures {
  readonly claude: string | null
  readonly 'user-of-record': string | null
  readonly witness1: string | null
  readonly witness2: string | null
  readonly witness3: string | null
}

// ─── key generation ───────────────────────────────────────────────────────────

export interface Keypair {
  readonly privateKeyPem: string
  readonly publicKeyPem: string
  readonly role: SignerRole
}

export const generateKeypair = (role: SignerRole): Keypair => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
    publicKeyEncoding: { format: 'pem', type: 'spki' },
  })
  return { privateKeyPem: privateKey, publicKeyPem: publicKey, role }
}

// ─── signing and verification ─────────────────────────────────────────────────

export const hashAmendment = (content: string): string => createHash('sha256').update(content).digest('hex')

export const signAmendment = (contentHash: string, privateKeyPem: string): string => {
  const sig = sign(null, Buffer.from(contentHash, 'utf8'), privateKeyPem)
  return sig.toString('hex')
}

export const verifySignature = (contentHash: string, signatureHex: string, publicKeyPem: string): boolean => {
  try {
    return verify(null, Buffer.from(contentHash, 'utf8'), publicKeyPem, Buffer.from(signatureHex, 'hex'))
  } catch {
    return false
  }
}

// ─── quorum check ─────────────────────────────────────────────────────────────

export interface QuorumResult {
  readonly met: boolean
  readonly missingRequired: readonly SignerRole[]
  readonly witnessCount: number
}

export const checkQuorum = (
  signatures: AmendmentSignatures,
  publicKeys: Record<SignerRole, string>,
  contentHash: string,
): QuorumResult => {
  const validatedRoles = new Set<SignerRole>()

  for (const role of ALL_SIGNER_ROLES) {
    const sig = signatures[role]
    const pubKey = publicKeys[role]
    if (sig !== null && pubKey !== undefined && verifySignature(contentHash, sig, pubKey)) {
      validatedRoles.add(role)
    }
  }

  const witnessCount = (['witness1', 'witness2', 'witness3'] as const).filter(r => validatedRoles.has(r)).length

  const missingRequired: SignerRole[] = []
  if (!validatedRoles.has('claude')) {
    missingRequired.push('claude')
  }
  if (!validatedRoles.has('user-of-record')) {
    missingRequired.push('user-of-record')
  }

  const met = missingRequired.length === 0 && witnessCount >= 2

  return { met, missingRequired, witnessCount }
}

// ─── key store I/O ────────────────────────────────────────────────────────────

export const writeKeypair = async (keyStoreDir: string, kp: Keypair): Promise<void> => {
  await writeFile(join(keyStoreDir, `${kp.role}.private.pem`), kp.privateKeyPem, 'utf8')
  await writeFile(join(keyStoreDir, `${kp.role}.public.pem`), kp.publicKeyPem, 'utf8')
}

export const readPublicKey = async (keyStoreDir: string, role: SignerRole): Promise<string> =>
  readFile(join(keyStoreDir, `${role}.public.pem`), 'utf8')

export const readPrivateKey = async (keyStoreDir: string, role: SignerRole): Promise<string> =>
  readFile(join(keyStoreDir, `${role}.private.pem`), 'utf8')
