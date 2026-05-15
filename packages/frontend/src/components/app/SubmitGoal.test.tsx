// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as goals from '../../api/goals.ts'
import { SubmitGoal } from './SubmitGoal.tsx'

vi.mock('../../api/goals.ts')

describe('SubmitGoal', () => {
  beforeEach(() => {
    vi.mocked(goals.submitGoal).mockReset()
  })

  it('does not call submitGoal when goal is blank', () => {
    render(<SubmitGoal />)
    fireEvent.click(screen.getByTestId('sg-submit'))
    expect(goals.submitGoal).not.toHaveBeenCalled()
  })

  it('shows Processing while the request is in flight', async () => {
    let resolve!: (v: { text: string }) => void
    vi.mocked(goals.submitGoal).mockReturnValueOnce(new Promise(r => (resolve = r)))
    render(<SubmitGoal />)
    fireEvent.change(screen.getByTestId('sg-goal'), { target: { value: 'count rows' } })
    fireEvent.click(screen.getByTestId('sg-submit'))
    expect(await screen.findByText('Processing…')).toBeInTheDocument()
    resolve({ text: 'done' })
  })

  it('displays the text result on success', async () => {
    vi.mocked(goals.submitGoal).mockResolvedValueOnce({ text: 'Georges finished the task.' })
    render(<SubmitGoal />)
    fireEvent.change(screen.getByTestId('sg-goal'), { target: { value: 'count rows' } })
    fireEvent.click(screen.getByTestId('sg-submit'))
    expect(await screen.findByText('Georges finished the task.')).toBeInTheDocument()
  })

  it('shows the error message when the request fails', async () => {
    vi.mocked(goals.submitGoal).mockRejectedValueOnce(new Error('500: internal error'))
    render(<SubmitGoal />)
    fireEvent.change(screen.getByTestId('sg-goal'), { target: { value: 'count rows' } })
    fireEvent.click(screen.getByTestId('sg-submit'))
    expect(await screen.findByText('Error: 500: internal error')).toBeInTheDocument()
  })

  it('submits goal with the entered handleId', async () => {
    vi.mocked(goals.submitGoal).mockResolvedValueOnce({ text: 'ok' })
    render(<SubmitGoal />)
    fireEvent.change(screen.getByTestId('sg-goal'), { target: { value: 'analyse data' } })
    fireEvent.change(screen.getByTestId('sg-handle'), { target: { value: 'handle-42' } })
    fireEvent.click(screen.getByTestId('sg-submit'))
    expect(goals.submitGoal).toHaveBeenCalledWith('analyse data', 'handle-42')
  })
})
