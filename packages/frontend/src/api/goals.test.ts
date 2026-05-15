import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { submitGoal } from './goals.ts'

const mockFetch = vi.fn<typeof fetch>()

describe(submitGoal, () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    mockFetch.mockReset()
  })

  it('posts to /api/goals and returns parsed JSON on success', async () => {
    const payload = { text: 'done' }
    mockFetch.mockResolvedValueOnce(Response.json(payload))

    const result = await submitGoal('count rows', 'h1')

    expect(mockFetch).toHaveBeenCalledWith('/api/goals', {
      body: JSON.stringify({ goal: 'count rows', handleId: 'h1' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
    expect(result).toEqual(payload)
  })

  it('throws with status prefix when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce(new Response('bad request', { status: 400 }))

    await expect(submitGoal('x', 'y')).rejects.toThrow('400: bad request')
  })
})
