// @vitest-environment happy-dom
import { RegistryProvider } from '@effect/atom-react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RespondResult, SendResult, Turn } from '../../hooks/chat.ts'

const getTurns = vi.fn<(s: string) => Promise<readonly Turn[]>>()
const sendMessage = vi.fn<(s: string, g: string, h: string) => Promise<SendResult>>()
const respondToGoal = vi.fn<(s: string, c: string, a: string) => Promise<RespondResult>>()

vi.mock('../../hooks/chat.ts', () => ({
  getTurns: (s: string) => getTurns(s),
  listSessions: vi.fn(() => Promise.resolve([])),
  respondToGoal: (s: string, c: string, a: string) => respondToGoal(s, c, a),
  sendMessage: (s: string, g: string, h: string) => sendMessage(s, g, h),
}))

const { Conversation } = await import('./Conversation.tsx')

const renderAt = (sessionId: string) =>
  render(
    <RegistryProvider>
      <MemoryRouter initialEntries={[`/sessions/${sessionId}`]}>
        <Routes>
          <Route element={<Conversation />} path="/sessions/:sessionId" />
        </Routes>
      </MemoryRouter>
    </RegistryProvider>,
  )

describe('Conversation', () => {
  beforeEach(() => {
    getTurns.mockReset()
    sendMessage.mockReset()
    respondToGoal.mockReset()
    getTurns.mockResolvedValue([])
  })

  it('hydrates the transcript for the routed :sessionId from the server', async () => {
    getTurns.mockResolvedValue([
      { correlationId: 'c1', goal: 'describe synthetic-001', reply: 'It has 3 columns.', turnIndex: 0 },
    ])
    renderAt('sess-xyz')
    expect(await screen.findByText('describe synthetic-001')).toBeInTheDocument()
    expect(screen.getByTestId('conv-reply-0')).toHaveTextContent('It has 3 columns.')
    expect(screen.getByTestId('conv-session-id')).toHaveTextContent('Session: sess-xyz')
    expect(getTurns).toHaveBeenCalledWith('sess-xyz')
  })

  it('optimistically shows the goal and dispatches sendMessage for this session', async () => {
    let resolveSend: (r: SendResult) => void = () => {}
    sendMessage.mockReturnValue(
      new Promise<SendResult>(res => {
        resolveSend = res
      }),
    )
    renderAt('sess-1')
    await screen.findByTestId('conv-goal')
    await userEvent.type(screen.getByTestId('conv-goal'), 'hello georges')
    await userEvent.click(screen.getByTestId('conv-send'))

    expect(await screen.findByTestId('conv-pending-goal')).toHaveTextContent('hello georges')
    expect(sendMessage).toHaveBeenCalledWith('sess-1', 'hello georges', 'synthetic-001')

    resolveSend({ correlationId: 'c9', sessionId: 'sess-1', text: 'hi' })
    await waitFor(() => expect(screen.queryByTestId('conv-pending-goal')).not.toBeInTheDocument())
  })

  it('surfaces a clarify question from the send response and dispatches the answer', async () => {
    // ClarifyRequested is persisted under sessionId='bootstrap', so it never
    // appears in /turns — the question comes from the POST /api/goals response.
    sendMessage.mockResolvedValue({ clarifyQuestion: 'Which dataset?', correlationId: 'c2', sessionId: 'sess-2' })
    respondToGoal.mockResolvedValue({ correlationId: 'c2', sessionId: 'sess-2' })
    renderAt('sess-2')
    await userEvent.type(await screen.findByTestId('conv-goal'), 'analyse it')
    await userEvent.click(screen.getByTestId('conv-send'))
    expect(await screen.findByTestId('conv-clarify-0')).toHaveTextContent('Georges asks: Which dataset?')
    await userEvent.type(screen.getByTestId('conv-clarify-answer'), 'synthetic-001')
    await userEvent.click(screen.getByTestId('conv-clarify-submit'))
    await waitFor(() => expect(respondToGoal).toHaveBeenCalledWith('sess-2', 'c2', 'synthetic-001'))
  })
})
