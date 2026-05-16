import type { TodoItem } from './loopHealth.ts'

const parseTodoStatus = (s: string): TodoItem['status'] | undefined => {
  if (s === 'todo') {
    return 'todo'
  }
  if (s === 'in-progress') {
    return 'in-progress'
  }
  if (s === 'done') {
    return 'done'
  }
  if (s === 'blocked') {
    return 'blocked'
  }
  if (s === 'parked') {
    return 'parked'
  }
  return undefined
}

/** Minimal regex-based parser for TODO.md items. */
export const parseTodoMd = (md: string): readonly TodoItem[] => {
  const items: TodoItem[] = []
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
    const status = parseTodoStatus(m[1] ?? '')
    if (status === undefined) {
      continue
    }
    const id = m[2] ?? ''
    const title = m[3]?.trim() ?? ''
    items.push({ id, phase: phaseLabel, status, title })
  }
  return items
}
