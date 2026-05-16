import { authedFetch, handleErr } from './auth.ts'

export interface Proposal {
  contentHash: string
  occurredAt: string
  payload: {
    name?: string
    description?: string
    code?: string
    tests?: string
    scope?: string
  }
}

export const listProposals = (): Promise<readonly Proposal[]> =>
  authedFetch('/api/proposals', { method: 'GET' }).then(res => res.json() as Promise<readonly Proposal[]>)

export const promoteProposal = (id: string): Promise<{ version: number }> =>
  authedFetch(`/api/proposals/${encodeURIComponent(id)}/promote`, { method: 'POST' })
    .then(handleErr)
    .then(res => res.json() as Promise<{ version: number }>)
