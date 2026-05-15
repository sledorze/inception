/**
 * Design-system enforcement test.
 *
 * Scans all non-ui frontend source files for raw interactive HTML elements
 * that should instead come from shadcn/ui. Fails fast with the list of
 * violations so the feedback loop is visible.
 *
 * Excluded: components/ui/ — shadcn components themselves may use raw elements
 * internally; we only police application code.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Raw JSX tags that must be replaced with shadcn/ui equivalents.
// Pattern: opening tag start — catches <button>, <button , <button/>, etc.
const BANNED = [/<button[\s\n/>]/u, /<input[\s\n/>]/u, /<textarea[\s\n/>]/u, /<select[\s\n/>]/u]

const SRC_DIR = new URL('.', import.meta.url).pathname

function collectFiles(dir: string, skip: readonly string[]): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      return skip.includes(entry.name) ? [] : collectFiles(full, skip)
    }
    return entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) ? [full] : []
  })
}

describe('design-system', () => {
  it('has no raw interactive HTML elements in application code — use shadcn/ui components', () => {
    const files = collectFiles(SRC_DIR, ['ui']).filter(f => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))

    const violations: string[] = []
    for (const file of files) {
      const content = readFileSync(file, 'utf8')
      const rel = file.replace(SRC_DIR, '')
      for (const banned of BANNED) {
        if (banned.test(content)) {
          violations.push(`${rel}: raw ${String(banned)} found`)
        }
      }
    }

    expect(violations).toEqual([])
  })
})
