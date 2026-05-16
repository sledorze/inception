import type { PainItem } from './loopHealth.ts'

/** Minimal regex-based parser for PAIN.md open items (## P<n> — <title> blocks). */
export const parsePainMd = (md: string): readonly PainItem[] => {
  const items: PainItem[] = []
  const blocks = md.split(/^## /mu).slice(1)
  for (const block of blocks) {
    const headerMatch = /^(P\d+) — (.+)/u.exec(block)
    if (headerMatch === null) {
      continue
    }
    const id = headerMatch[1] ?? ''
    const title = headerMatch[2]?.trim() ?? ''
    const severityMatch = /\*\*Severity:\*\*\s*(.+)/u.exec(block)
    const severity = severityMatch?.[1]?.trim() ?? 'unknown'
    items.push({ id, severity, status: 'open', title })
  }
  return items
}
