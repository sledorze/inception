import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { callTool } from './toolkit.ts'

const mockFetch = vi.fn<typeof fetch>()

describe(callTool, () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    mockFetch.mockReset()
  })

  it('posts to /api/tools/:name and returns parsed JSON', async () => {
    const payload = { isFailure: false, result: 'ok' }
    mockFetch.mockResolvedValueOnce(Response.json(payload))

    const result = await callTool('list-tools', { role: 'Implementer' })

    expect(mockFetch).toHaveBeenCalledWith('/api/tools/list-tools', {
      body: JSON.stringify({ role: 'Implementer' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
    expect(result).toEqual(payload)
  })
})
