import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listProposals, promoteProposal } from './proposals.ts'

const mockFetch = vi.fn<typeof fetch>()

describe(listProposals, () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    mockFetch.mockReset()
  })

  it('fetches /api/proposals and returns parsed JSON', async () => {
    const proposals = [{ contentHash: 'abc', occurredAt: '2025-01-01T00:00:00.000Z', payload: { name: 'greet' } }]
    mockFetch.mockResolvedValueOnce(Response.json(proposals))

    const result = await listProposals()

    expect(mockFetch).toHaveBeenCalledWith('/api/proposals')
    expect(result).toEqual(proposals)
  })
})

describe(promoteProposal, () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    mockFetch.mockReset()
  })

  it('posts to promote endpoint and returns version on success', async () => {
    mockFetch.mockResolvedValueOnce(Response.json({ version: 1 }))

    const result = await promoteProposal('abc123')

    expect(mockFetch).toHaveBeenCalledWith('/api/proposals/abc123/promote', { method: 'POST' })
    expect(result).toEqual({ version: 1 })
  })

  it('throws with status prefix when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce(new Response('not found', { status: 404 }))

    await expect(promoteProposal('bad-id')).rejects.toThrow('404: not found')
  })
})
