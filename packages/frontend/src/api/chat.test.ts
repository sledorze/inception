import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTurns, sendMessage } from './chat.ts'

const mockFetch = vi.fn<typeof fetch>()

describe('chat API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    mockFetch.mockReset()
  })

  describe(sendMessage, () => {
    it('posts to /api/goals with sessionId and returns parsed JSON', async () => {
      const payload = { correlationId: 'c1', sessionId: 's1', text: 'done' }
      mockFetch.mockResolvedValueOnce(Response.json(payload))

      const result = await sendMessage('s1', 'count rows', 'h1')

      expect(mockFetch).toHaveBeenCalledWith('/api/goals', {
        body: JSON.stringify({ goal: 'count rows', handleId: 'h1', sessionId: 's1' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      expect(result).toEqual(payload)
    })

    it('throws with status prefix on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(new Response('server error', { status: 500 }))

      await expect(sendMessage('s', 'g', 'h')).rejects.toThrow('500: server error')
    })
  })

  describe(getTurns, () => {
    it('fetches turns for the given sessionId', async () => {
      const turns = [{ correlationId: 'c1', goal: 'q', reply: 'a', turnIndex: 0 }]
      mockFetch.mockResolvedValueOnce(Response.json(turns))

      const result = await getTurns('s1')

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/s1/turns')
      expect(result).toEqual(turns)
    })

    it('URL-encodes the sessionId', async () => {
      mockFetch.mockResolvedValueOnce(Response.json([]))
      await getTurns('session with spaces')
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/session%20with%20spaces/turns')
    })

    it('throws with status prefix on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(new Response('not found', { status: 404 }))

      await expect(getTurns('s')).rejects.toThrow('404: not found')
    })
  })
})
