import { authedFetch } from './auth.ts'

export interface LoopHealth {
  eventCount: number
  openPainItems: number
  openTodoItems: number
  doneTodoItems: number
  archivedPainItems: number
}

export interface PainItem {
  id: string
  title: string
  severity: string
  status: string
}

export interface TodoItem {
  id: string
  phase: string
  title: string
  status: string
}

export interface ObservedEvent {
  id: string
  kind: string
  actor: string
  occurredAt: string
  correlationId: string
  sessionId?: string
  storyRef?: string
  payload: unknown
}

export const getMetrics = (): Promise<LoopHealth> =>
  authedFetch('/api/admin/metrics', { method: 'GET' }).then(res => res.json() as Promise<LoopHealth>)

export const getPain = (): Promise<readonly PainItem[]> =>
  authedFetch('/api/admin/pain', { method: 'GET' }).then(res => res.json() as Promise<readonly PainItem[]>)

export const getWork = (): Promise<readonly TodoItem[]> =>
  authedFetch('/api/admin/work', { method: 'GET' }).then(res => res.json() as Promise<readonly TodoItem[]>)

export const getTrace = (): Promise<readonly ObservedEvent[]> =>
  authedFetch('/api/admin/trace', { method: 'GET' }).then(res => res.json() as Promise<readonly ObservedEvent[]>)
