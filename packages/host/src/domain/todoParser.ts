import type { TodoItem } from './loopHealth.ts'

/** Minimal regex-based parser for TODO.md items. */
export const parseTodoMd = (md: string): readonly TodoItem[] => {
  const items: TodoItem[] = []
  // Regex alternation is the single gatekeeper for valid status values — no separate validator needed.
  const lineRe = /^- \[(todo|in-progress|done|blocked|parked)\] \*\*(\d+\.\w+)\*\* (.+)/mu
  let phaseLabel = 'unknown'
  for (const line of md.split('\n')) {
    const phaseMatch = /^## Phase (.+)/u.exec(line)
    if (phaseMatch !== null) {
      phaseLabel = phaseMatch[1]?.trim() ?? 'unknown'
      continue
    }
    const m = lineRe.exec(line)
    if (m === null) {
      continue
    }
    const id = m[2] ?? ''
    const title = m[3]?.trim() ?? ''
    items.push({ id, phase: phaseLabel, status: m[1] as TodoItem['status'], title }) // cast: regex guarantees m[1] is a valid TodoItem status literal
  }
  return items
}
