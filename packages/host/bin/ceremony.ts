#!/usr/bin/env node
/**
 * External Witness ceremony CLI (L0.2, L0.5, §6).
 *
 * Commands:
 *   ceremony setup   <key-store-dir>
 *     Generates all 5 keypairs (claude, user-of-record, witness1/2/3) and
 *     writes PEM files to <key-store-dir>/.
 *
 *   ceremony sign    <amendment-file> --role <role> --key <private-key-pem-path>
 *     Signs the amendment content hash with the given key and appends the
 *     signature to <amendment-file>.sigs.json.
 *
 *   ceremony verify  <amendment-file> <key-store-dir>
 *     Verifies all signatures in <amendment-file>.sigs.json against the
 *     public keys in <key-store-dir> and reports quorum status.
 *
 *   ceremony emit    <amendment-file> <key-store-dir>
 *     Verifies quorum and emits a ConstitutionalAmendment event to the
 *     EventStore (MONITOR_SQLITE_PATH or SQLITE_PATH env var required).
 */
import { readFile, writeFile } from 'node:fs/promises'
import { Effect } from 'effect'
import { SqliteEventStore } from '../src/adapters/driven/SqliteEventStore.ts'
import { EventStore } from '../src/ports/driven/EventStore.ts'
import {
  ALL_SIGNER_ROLES,
  checkQuorum,
  generateKeypair,
  readPublicKey,
  signAmendment,
  writeKeypair,
} from '../src/domain/ceremony.ts'
import type { Amendment, AmendmentSignatures, SignerRole } from '../src/domain/ceremony.ts'

const argv = process.argv.slice(2)
const command = argv[0]
const args = argv.slice(1)

async function cmdSetup(keyStoreDir: string): Promise<void> {
  for (const role of ALL_SIGNER_ROLES) {
    const kp = generateKeypair(role)
    await writeKeypair(keyStoreDir, kp)
    console.log(`  generated ${role}.{public,private}.pem`)
  }
  console.log(`Setup complete — 5 keypairs written to ${keyStoreDir}`)
}

async function cmdSign(amendmentFile: string, role: SignerRole, privateKeyPem: string): Promise<void> {
  const content = await readFile(amendmentFile, 'utf8')
  const amendment: Amendment = JSON.parse(content) as Amendment
  const sig = signAmendment(amendment.contentHash, privateKeyPem)

  const sigsFile = `${amendmentFile}.sigs.json`
  let sigs: AmendmentSignatures = {
    claude: null,
    'user-of-record': null,
    witness1: null,
    witness2: null,
    witness3: null,
  }
  try {
    const existing = await readFile(sigsFile, 'utf8')
    sigs = JSON.parse(existing) as AmendmentSignatures
  } catch {
    // No existing sigs file — start fresh.
  }

  const updated: AmendmentSignatures = { ...sigs, [role]: sig }
  await writeFile(sigsFile, JSON.stringify(updated, null, 2), 'utf8')
  console.log(`Signature for ${role} written to ${sigsFile}`)
}

async function loadPublicKeys(keyStoreDir: string): Promise<Record<SignerRole, string>> {
  const entries = await Promise.all(
    ALL_SIGNER_ROLES.map(async role => [role, await readPublicKey(keyStoreDir, role)] as const),
  )
  return Object.fromEntries(entries) as Record<SignerRole, string>
}

async function cmdVerify(amendmentFile: string, keyStoreDir: string): Promise<void> {
  const content = await readFile(amendmentFile, 'utf8')
  const amendment: Amendment = JSON.parse(content) as Amendment
  const sigs: AmendmentSignatures = JSON.parse(
    await readFile(`${amendmentFile}.sigs.json`, 'utf8'),
  ) as AmendmentSignatures
  const publicKeys = await loadPublicKeys(keyStoreDir)
  const result = checkQuorum(sigs, publicKeys, amendment.contentHash)

  console.log(`Quorum met:      ${result.met}`)
  console.log(`Witness count:   ${result.witnessCount}/3 (need 2)`)
  if (result.missingRequired.length > 0) {
    console.log(`Missing required: ${result.missingRequired.join(', ')}`)
  }
}

async function cmdEmit(amendmentFile: string, keyStoreDir: string): Promise<void> {
  const content = await readFile(amendmentFile, 'utf8')
  const amendment: Amendment = JSON.parse(content) as Amendment
  const sigs: AmendmentSignatures = JSON.parse(
    await readFile(`${amendmentFile}.sigs.json`, 'utf8'),
  ) as AmendmentSignatures
  const publicKeys = await loadPublicKeys(keyStoreDir)
  const result = checkQuorum(sigs, publicKeys, amendment.contentHash)

  if (!result.met) {
    console.error('Quorum not met — cannot emit ConstitutionalAmendment')
    console.error(`  witnesses: ${result.witnessCount}/3`)
    console.error(`  missing required: ${result.missingRequired.join(', ')}`)
    process.exit(1)
  }

  const sqlitePath = process.env['MONITOR_SQLITE_PATH'] ?? process.env['SQLITE_PATH']
  if (!sqlitePath) {
    console.error('SQLITE_PATH or MONITOR_SQLITE_PATH env var required')
    process.exit(1)
  }

  const emit = Effect.gen(function* () {
    const store = yield* EventStore
    yield* store.append({
      actor: 'claude',
      correlationId: amendment.amendmentId,
      kind: 'ConstitutionalAmendment',
      occurredAt: new Date().toISOString(),
      payload: {
        amendmentId: amendment.amendmentId,
        content: amendment.content,
        contentHash: amendment.contentHash,
        signatures: sigs,
        witnessCount: result.witnessCount,
      },
      schemaV: 1,
      sessionId: 'ceremony',
      storyRef: 'constitutional',
    })
    console.log(`ConstitutionalAmendment emitted for amendment ${amendment.amendmentId}`)
  })

  await Effect.runPromise(Effect.provide(emit, SqliteEventStore.layer(sqlitePath)))
}

switch (command) {
  case 'setup': {
    const keyStoreDir = args[0]
    if (!keyStoreDir) {
      console.error('Usage: ceremony setup <key-store-dir>')
      process.exit(1)
    }
    await cmdSetup(keyStoreDir)
    break
  }
  case 'sign': {
    const amendmentFile = args[0]
    const roleIdx = args.indexOf('--role')
    const keyIdx = args.indexOf('--key')
    if (!amendmentFile || roleIdx === -1 || keyIdx === -1) {
      console.error('Usage: ceremony sign <amendment-file> --role <role> --key <private-key-pem-path>')
      process.exit(1)
    }
    const role = args[roleIdx + 1] as SignerRole
    const keyFile = args[keyIdx + 1]
    if (!keyFile) {
      console.error('--key path required')
      process.exit(1)
    }
    const privateKeyPem = await readFile(keyFile, 'utf8')
    await cmdSign(amendmentFile, role, privateKeyPem)
    break
  }
  case 'verify': {
    const amendmentFile = args[0]
    const keyStoreDir = args[1]
    if (!amendmentFile || !keyStoreDir) {
      console.error('Usage: ceremony verify <amendment-file> <key-store-dir>')
      process.exit(1)
    }
    await cmdVerify(amendmentFile, keyStoreDir)
    break
  }
  case 'emit': {
    const amendmentFile = args[0]
    const keyStoreDir = args[1]
    if (!amendmentFile || !keyStoreDir) {
      console.error('Usage: ceremony emit <amendment-file> <key-store-dir>')
      process.exit(1)
    }
    await cmdEmit(amendmentFile, keyStoreDir)
    break
  }
  default: {
    console.error('Commands: setup | sign | verify | emit')
    process.exit(1)
  }
}
