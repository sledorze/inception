import { authedFetch } from './auth.ts'

export interface Turn {
  correlationId: string
  goal: string
  reply?: string
  clarifyQuestion?: string
  clarifyAnswer?: string
  turnIndex: number
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
  }).then(res => {
    if (!res.ok) {
      return res.text().then(t => {
        throw new Error(`${res.status}: ${t}`)
      })
    }
    return res.json() as Promise<SendResult>
  })

export const respondToGoal = (sessionId: string, correlationId: string, answer: string): Promise<RespondResult> =>
  authedFetch(`/api/sessions/${encodeURIComponent(sessionId)}/respond`, {
    body: JSON.stringify({ answer, correlationId }),
    method: 'POST',
  }).then(res => {
    if (!res.ok) {
      return res.text().then(t => {
        throw new Error(`${res.status}: ${t}`)
      })
    }
    return res.json() as Promise<RespondResult>
  })

export const getTurns = (sessionId: string): Promise<Turn[]> =>
  authedFetch(`/api/sessions/${encodeURIComponent(sessionId)}/turns`, { method: 'GET' }).then(res => {
    if (!res.ok) {
      return res.text().then(t => {
        throw new Error(`${res.status}: ${t}`)
      })
    }
    return res.json() as Promise<Turn[]>
  })
