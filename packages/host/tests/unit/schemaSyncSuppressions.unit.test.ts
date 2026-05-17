/**
 * Acceptance test for P26 — schemaSyncInEffect false-positive fix.
 *
 * Asserts that no `schemaSyncInEffect:off` suppression directives exist in
 * the host source tree. The fix was to extract sync decode helpers outside
 * any `Effect.gen` scope (rowToStoredEvent in SqliteEventStore.ts), so the
 * tsgo rule no longer fires and no suppressions are needed.
 *
 * This test would FAIL if a suppression directive were re-introduced.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC_DIR = path.resolve(import.meta.dirname, '../../src')

function findSuppressions(dir: string): string[] {
  const matches: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      matches.push(...findSuppressions(full))
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      const content = fs.readFileSync(full, 'utf-8')
      if (content.includes('schemaSyncInEffect:off')) {
        matches.push(full)
      }
    }
  }
  return matches
}

describe('P26 — schemaSyncInEffect suppressions eliminated', () => {
  it('no schemaSyncInEffect:off directives exist in packages/host/src/', () => {
    const suppressed = findSuppressions(SRC_DIR)
    expect(suppressed, `schemaSyncInEffect:off found in: ${suppressed.join(', ')}`).toHaveLength(0)
  })
})
