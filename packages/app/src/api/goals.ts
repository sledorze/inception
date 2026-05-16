import { authedFetch, handleErr } from './auth.ts'

export interface GoalResult {
  text?: string
  [key: string]: unknown
}

export const submitGoal = (goal: string, handleId: string): Promise<GoalResult> =>
  authedFetch('/api/goals', {
    body: JSON.stringify({ goal, handleId }),
    method: 'POST',
  })
    .then(handleErr)
    .then(res => res.json() as Promise<GoalResult>)
