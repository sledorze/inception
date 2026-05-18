import { authedFetch, handleErr } from './auth.ts'

export interface Turn {
  correlationId: string
  goal: string
  reply?: string
  clarifyQuestion?: string
  clarifyAnswer?: string
  turnIndex: number
}

export interface SessionSummary {
  sessionId: string
  eventCount: number
  goalCount: number
  lastActivity: string
}

export interface SendResult {
  correlationId: string
  sessionId: string
  text?: string
  clarifyQuestion?: string
}

export interface RespondResult {
  correlationId: string
  sessionId: string
}

export const sendMessage = (sessionId: string, goal: string, handleId: string): Promise<SendResult> =>
  authedFetch('/api/goals', {
    body: JSON.stringify({ goal, handleId, sessionId }),
    method: 'POST',
  })
    .then(handleErr)
    .then(res => res.json() as Promise<SendResult>)

export const listSessions = (): Promise<readonly SessionSummary[]> =>
  authedFetch('/api/sessions', { method: 'GET' })
    .then(handleErr)
    .then(res => res.json() as Promise<readonly SessionSummary[]>)

export const getTurns = (sessionId: string): Promise<readonly Turn[]> =>
  authedFetch(`/api/sessions/${encodeURIComponent(sessionId)}/turns`, { method: 'GET' })
    .then(handleErr)
    .then(res => res.json() as Promise<readonly Turn[]>)

export const respondToGoal = (sessionId: string, correlationId: string, answer: string): Promise<RespondResult> =>
  authedFetch(`/api/sessions/${encodeURIComponent(sessionId)}/respond`, {
    body: JSON.stringify({ answer, correlationId }),
    method: 'POST',
  })
    .then(handleErr)
    .then(res => res.json() as Promise<RespondResult>)
