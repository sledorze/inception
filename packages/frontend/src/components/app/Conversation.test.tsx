// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as chat from '../../api/chat.ts'
import { Conversation } from './Conversation.tsx'

vi.mock('../../api/chat.ts')

describe('Conversation', () => {
  beforeEach(() => {
    vi.mocked(chat.sendMessage).mockReset()
  })

  it('shows the session ID on mount', () => {
    render(<Conversation />)
    expect(screen.getByTestId('conv-session-id').textContent).toMatch(/Session:/)
  })

  it('does not send when goal is blank', () => {
    render(<Conversation />)
    fireEvent.click(screen.getByTestId('conv-send'))
    expect(chat.sendMessage).not.toHaveBeenCalled()
  })

  it('shows Thinking while the request is in flight', async () => {
    let resolve!: (v: { correlationId: string; sessionId: string; text: string }) => void
    vi.mocked(chat.sendMessage).mockReturnValueOnce(new Promise(r => (resolve = r)))

    render(<Conversation />)
    fireEvent.change(screen.getByTestId('conv-goal'), { target: { value: 'hello' } })
    fireEvent.click(screen.getByTestId('conv-send'))

    expect(await screen.findByText('Thinking…')).toBeInTheDocument()
    resolve({ correlationId: 'c1', sessionId: 's1', text: 'hi' })
  })

  it('appends the reply to the transcript on success', async () => {
    vi.mocked(chat.sendMessage).mockResolvedValueOnce({
      correlationId: 'c1',
      sessionId: 's1',
      text: 'Fixture has two columns.',
    })

    render(<Conversation />)
    fireEvent.change(screen.getByTestId('conv-goal'), { target: { value: 'describe it' } })
    fireEvent.click(screen.getByTestId('conv-send'))

    const reply = await screen.findByTestId('conv-reply-0')
    expect(reply.textContent).toBe('Fixture has two columns.')
  })

  it('clears the goal input after a successful send', async () => {
    vi.mocked(chat.sendMessage).mockResolvedValueOnce({
      correlationId: 'c1',
      sessionId: 's1',
      text: 'ok',
    })

    render(<Conversation />)
    const goalInput = screen.getByTestId('conv-goal')
    fireEvent.change(goalInput, { target: { value: 'my goal' } })
    fireEvent.click(screen.getByTestId('conv-send'))

    await screen.findByTestId('conv-reply-0')
    expect((goalInput as HTMLTextAreaElement).value).toBe('')
  })

  it('shows an error message on failure', async () => {
    vi.mocked(chat.sendMessage).mockRejectedValueOnce(new Error('500: oops'))

    render(<Conversation />)
    fireEvent.change(screen.getByTestId('conv-goal'), { target: { value: 'bad goal' } })
    fireEvent.click(screen.getByTestId('conv-send'))

    expect(await screen.findByText('Error: 500: oops')).toBeInTheDocument()
  })
})
