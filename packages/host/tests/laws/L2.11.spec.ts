/**
 * Law L2.11 — Variant Provenance.
 * "Every variant logs role version, inputs, prompt-hash, model-id, seed (if any),
 *  budget consumed, and fitness vector (§4.4). Variants missing fields are invalid
 *  for selection."
 *
 * If-absent failure mode: selection has no basis; "trial and error" cannot
 * accumulate evidence.
 *
 * Tests assert: VariantEntrySchema enforces all required provenance fields at the
 * type boundary; entries missing fields are rejected by Schema.decodeUnknown.
 */
import { Effect, Schema } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { VariantEntrySchema } from '../../src/ports/driven/VariantLog.ts'

const validEntry = {
  budgetConsumed: { costUsd: 0.001, tokens: 100 },
  fitnessVector: { correctness: 0.9 },
  modelId: 'test-model',
  occurredAt: '2026-01-01T00:00:00.000Z',
  primitiveCompositionHash: 'abc123',
  promptHash: 'def456',
  roleVersionHash: '0.1.0',
  sessionId: 'sess-1',
  status: 'completed',
  storyRef: 'S1',
  variantId: 'var-1',
  workflowHash: 'ghi789',
}

// Schema.decodeUnknownEffect is synchronous — runSync avoids a Promise in test helpers.
const decode = (raw: unknown) => Effect.runSync(Schema.decodeUnknownEffect(VariantEntrySchema)(raw))

describe('L2.11 — Variant Provenance', () => {
  it('accepts a fully-specified valid variant entry', () => {
    const entry = decode(validEntry)
    expect(entry.variantId).toBe('var-1')
    expect(entry.roleVersionHash).toBe('0.1.0')
    expect(entry.promptHash).toBe('def456')
    expect(entry.modelId).toBe('test-model')
  })

  it('rejects a variant missing roleVersionHash (L2.11)', () => {
    const { roleVersionHash: _, ...missing } = validEntry
    expect(() => decode(missing)).toThrow()
  })

  it('rejects a variant missing promptHash (L2.11)', () => {
    const { promptHash: _, ...missing } = validEntry
    expect(() => decode(missing)).toThrow()
  })

  it('rejects a variant missing modelId (L2.11)', () => {
    const { modelId: _, ...missing } = validEntry
    expect(() => decode(missing)).toThrow()
  })

  it('rejects a variant missing budgetConsumed (L2.11)', () => {
    const { budgetConsumed: _, ...missing } = validEntry
    expect(() => decode(missing)).toThrow()
  })

  it('rejects a variant missing fitnessVector (L2.11)', () => {
    const { fitnessVector: _, ...missing } = validEntry
    expect(() => decode(missing)).toThrow()
  })

  it('accepts a variant with optional seed omitted', () => {
    const entry = decode(validEntry)
    expect(entry.seed).toBeUndefined()
  })

  it('accepts a variant with optional seed present', () => {
    const entry = decode({ ...validEntry, seed: '42' })
    expect(entry.seed).toBe('42')
  })
})
