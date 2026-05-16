/**
 * P34 acceptance test — design system isolation.
 *
 * Asserts that packages/backoffice and packages/app contain no .tsx component files
 * under src/components/ui/ — all shadcn components must live exclusively in
 * packages/design-system/. If any .tsx file is found there, this test fails,
 * indicating a regression (component re-added to the wrong package).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(import.meta.dirname, '..')

function tsxFilesIn(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return []
  }
  return fs.readdirSync(dir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'))
}

describe('design system isolation (P34)', () => {
  it('packages/backoffice/src/components/ui contains no .tsx files', () => {
    const dir = path.join(ROOT, 'packages/backoffice/src/components/ui')
    const files = tsxFilesIn(dir)
    expect(files, `Found component files in backoffice ui dir: ${files.join(', ')}`).toHaveLength(0)
  })

  it('packages/app/src/components/ui contains no .tsx files', () => {
    const dir = path.join(ROOT, 'packages/app/src/components/ui')
    const files = tsxFilesIn(dir)
    expect(files, `Found component files in app ui dir: ${files.join(', ')}`).toHaveLength(0)
  })

  it('packages/design-system/src contains all 4 components', () => {
    const dir = path.join(ROOT, 'packages/design-system/src')
    const files = tsxFilesIn(dir)
    expect(files).toContain('button.tsx')
    expect(files).toContain('card.tsx')
    expect(files).toContain('input.tsx')
    expect(files).toContain('textarea.tsx')
  })
})
