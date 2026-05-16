import { authedFetch } from './auth.ts'

export interface HandlerResult {
  isFailure: boolean
  result: unknown
}

export const callTool = (name: string, params: Record<string, string>): Promise<HandlerResult> =>
  authedFetch(`/api/tools/${encodeURIComponent(name)}`, {
    body: JSON.stringify(params),
    method: 'POST',
  }).then(res => res.json() as Promise<HandlerResult>)
