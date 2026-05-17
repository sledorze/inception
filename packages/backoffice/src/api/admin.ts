import { authedFetch, getJson, handleErr } from './auth.ts'

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

export const getMetrics = (): Promise<LoopHealth> => getJson('/api/admin/metrics', { method: 'GET' })

export const getPain = (): Promise<readonly PainItem[]> => getJson('/api/admin/pain', { method: 'GET' })

export const getWork = (): Promise<readonly TodoItem[]> => getJson('/api/admin/work', { method: 'GET' })

// ─── Phase 8 — Exchange review loop ──────────────────────────────────────────

export interface SessionSummary {
  sessionId: string
  eventCount: number
  goalCount: number
  lastActivity: string
}

export interface SessionEvent {
  id: string
  kind: string
  actor: string
  correlationId: string
  occurredAt: string
  sessionId: string
  payload: unknown
}

export interface Pattern {
  key: string
  count: number
  examples: readonly string[]
  firstSeen: string
  lastSeen: string
}

export interface ReplayResult {
  before: string | null
  after: string | null
  replayCorrelationId: string
}

export const getSessions = (): Promise<readonly SessionSummary[]> =>
  authedFetch('/api/sessions', { method: 'GET' })
    .then(handleErr)
    .then(r => r.json() as Promise<readonly SessionSummary[]>)

export const getSessionEvents = (sessionId: string): Promise<readonly SessionEvent[]> =>
  authedFetch(`/api/sessions/${encodeURIComponent(sessionId)}/events`, { method: 'GET' })
    .then(handleErr)
    .then(r => r.json() as Promise<readonly SessionEvent[]>)

export const flagExchange = (
  correlationId: string,
  note: string,
  severity: 'observation' | 'issue' | 'blocker',
): Promise<void> =>
  authedFetch(`/api/exchanges/${encodeURIComponent(correlationId)}/flag`, {
    body: JSON.stringify({ note, severity }),
    method: 'POST',
  })
    .then(handleErr)
    .then(() => undefined)

export const getPatterns = (): Promise<readonly Pattern[]> =>
  authedFetch('/api/patterns', { method: 'GET' })
    .then(handleErr)
    .then(r => r.json() as Promise<readonly Pattern[]>)

export const getAgentMd = (): Promise<{ content: string }> =>
  authedFetch('/api/agent-md', { method: 'GET' })
    .then(handleErr)
    .then(r => r.json() as Promise<{ content: string }>)

export const patchAgentMd = (
  content: string,
  rationale: string,
  patternIds?: readonly string[],
): Promise<{ prevHash: string; newHash: string }> =>
  authedFetch('/api/agent-md', {
    body: JSON.stringify({ content, patternIds: patternIds ?? [], rationale }),
    method: 'PATCH',
  })
    .then(handleErr)
    .then(r => r.json() as Promise<{ prevHash: string; newHash: string }>)

export const replayExchange = (correlationId: string): Promise<ReplayResult> =>
  authedFetch(`/api/exchanges/${encodeURIComponent(correlationId)}/replay`, { method: 'POST' })
    .then(handleErr)
    .then(r => r.json() as Promise<ReplayResult>)

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface AppSettings {
  llmBaseUrl: string
  llmModel: string
  sessionMaxTurns: number
}

export const getSettings = (): Promise<AppSettings> =>
  authedFetch('/api/settings', { method: 'GET' })
    .then(handleErr)
    .then(r => r.json() as Promise<AppSettings>)

export const patchSettings = (updates: Partial<AppSettings>): Promise<AppSettings> =>
  authedFetch('/api/settings', {
    body: JSON.stringify(updates),
    method: 'PATCH',
  })
    .then(handleErr)
    .then(r => r.json() as Promise<AppSettings>)
