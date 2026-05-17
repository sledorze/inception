import { getJson } from './auth.ts'

export interface HandlerResult {
  isFailure: boolean
  result: unknown
}

export const callTool = (name: string, params: Record<string, string>): Promise<HandlerResult> =>
  getJson(`/api/tools/${encodeURIComponent(name)}`, {
    body: JSON.stringify(params),
    method: 'POST',
  })
