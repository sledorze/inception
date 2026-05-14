export interface HandlerResult {
  isFailure: boolean
  result: unknown
}

export const callTool = (name: string, params: Record<string, string>): Promise<HandlerResult> =>
  fetch(`/api/tools/${encodeURIComponent(name)}`, {
    body: JSON.stringify(params),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  }).then(res => res.json() as Promise<HandlerResult>)
