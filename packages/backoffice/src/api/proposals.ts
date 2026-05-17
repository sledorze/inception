import { getJson } from './auth.ts'

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

export const listProposals = (): Promise<readonly Proposal[]> => getJson('/api/proposals', { method: 'GET' })

export const promoteProposal = (id: string): Promise<{ version: number }> =>
  getJson(`/api/proposals/${encodeURIComponent(id)}/promote`, { method: 'POST' })
