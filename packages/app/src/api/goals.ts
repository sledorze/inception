import { authedFetch } from './auth.ts'

export interface GoalResult {
  text?: string
  [key: string]: unknown
}

export const submitGoal = (goal: string, handleId: string): Promise<GoalResult> =>
  authedFetch('/api/goals', {
    body: JSON.stringify({ goal, handleId }),
    method: 'POST',
  }).then(res => {
    if (!res.ok) {
      return res.text().then(t => {
        throw new Error(`${res.status}: ${t}`)
      })
    }
    return res.json() as Promise<GoalResult>
  })
