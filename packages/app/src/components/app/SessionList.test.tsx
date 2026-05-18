// @vitest-environment happy-dom
import { RegistryProvider } from '@effect/atom-react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionSummary } from '../../hooks/chat.ts'

const sessions: readonly SessionSummary[] = [
  { eventCount: 4, goalCount: 2, lastActivity: '2024-01-02T00:00:03.000Z', sessionId: 'sess-aaaaaaaa-1111' },
  { eventCount: 1, goalCount: 1, lastActivity: '2024-01-01T00:00:01.000Z', sessionId: 'sess-bbbbbbbb-2222' },
]

const listSessions = vi.fn<() => Promise<readonly SessionSummary[]>>(() => Promise.resolve(sessions))

vi.mock('../../hooks/chat.ts', () => ({
  getTurns: vi.fn(() => Promise.resolve([])),
  listSessions: () => listSessions(),
  respondToGoal: vi.fn(),
  sendMessage: vi.fn(),
}))

const { SessionList } = await import('./SessionList.tsx')

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>
}

const renderAt = (path: string) =>
  render(
    <RegistryProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<SessionList />} path="/" />
          <Route element={<LocationProbe />} path="/sessions/:sessionId" />
        </Routes>
      </MemoryRouter>
    </RegistryProvider>,
  )

describe('SessionList', () => {
  beforeEach(() => {
    listSessions.mockClear()
    listSessions.mockResolvedValue(sessions)
  })

  it('renders a row per server-enumerated session', async () => {
    renderAt('/')
    expect(await screen.findByTestId('session-sess-aaaaaaaa-1111')).toBeInTheDocument()
    expect(screen.getByTestId('session-sess-bbbbbbbb-2222')).toBeInTheDocument()
    expect(screen.getByText('2 goals · 4 events')).toBeInTheDocument()
  })

  it('"New conversation" navigates to a fresh /sessions/<uuid> route', async () => {
    renderAt('/')
    await screen.findByTestId('new-conversation')
    await userEvent.click(screen.getByTestId('new-conversation'))
    expect(screen.getByTestId('location').textContent).toMatch(/^\/sessions\/[0-9a-f-]{36}$/)
  })

  it('clicking a session row deep-links to that session', async () => {
    renderAt('/')
    await userEvent.click(await screen.findByTestId('session-sess-bbbbbbbb-2222'))
    expect(screen.getByTestId('location')).toHaveTextContent('/sessions/sess-bbbbbbbb-2222')
  })

  it('shows the empty-state when there are no sessions', async () => {
    listSessions.mockResolvedValue([])
    renderAt('/')
    expect(await screen.findByText('No conversations yet. Start a new one.')).toBeInTheDocument()
  })
})
