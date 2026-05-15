// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as toolkit from '../../api/toolkit.ts'
import { ListTools } from './ListTools.tsx'

vi.mock('../../api/toolkit.ts')

describe('ListTools', () => {
  beforeEach(() => {
    vi.mocked(toolkit.callTool).mockReset()
  })

  it('renders with default role and a Call button', () => {
    render(<ListTools />)
    expect(screen.getByTestId('lt-role')).toHaveValue('Implementer')
    expect(screen.getByTestId('lt-submit')).toBeInTheDocument()
  })

  it('calls list-tools with entered role on submit', async () => {
    vi.mocked(toolkit.callTool).mockResolvedValueOnce({ isFailure: false, result: [] })
    render(<ListTools />)
    fireEvent.change(screen.getByTestId('lt-role'), { target: { value: 'Reviewer' } })
    fireEvent.click(screen.getByTestId('lt-submit'))
    expect(toolkit.callTool).toHaveBeenCalledWith('list-tools', { role: 'Reviewer' })
  })

  it('displays the tool list result after a successful call', async () => {
    vi.mocked(toolkit.callTool).mockResolvedValueOnce({ isFailure: false, result: ['read-workspace'] })
    render(<ListTools />)
    fireEvent.click(screen.getByTestId('lt-submit'))
    expect(await screen.findByText(/"read-workspace"/)).toBeInTheDocument()
  })

  it('displays failure result with error styling', async () => {
    vi.mocked(toolkit.callTool).mockResolvedValueOnce({ isFailure: true, result: 'policy denied' })
    render(<ListTools />)
    fireEvent.click(screen.getByTestId('lt-submit'))
    const el = await screen.findByText(/"policy denied"/)
    expect(el).toHaveClass('text-destructive')
  })
})
