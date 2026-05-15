// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as proposals from '../../api/proposals.ts'
import { Proposals } from './Proposals.tsx'

vi.mock('../../api/proposals.ts')

const PROPOSAL = {
  contentHash: 'abc123',
  occurredAt: '2025-01-01T00:00:00.000Z',
  payload: { description: 'greets the user', name: 'greet' },
}

describe('Proposals', () => {
  beforeEach(() => {
    vi.mocked(proposals.listProposals).mockReset()
    vi.mocked(proposals.promoteProposal).mockReset()
  })

  it('shows the empty-state text before any refresh', () => {
    render(<Proposals />)
    expect(screen.getByText(/No pending proposals/)).toBeInTheDocument()
  })

  it('loads and displays proposals on Refresh click', async () => {
    vi.mocked(proposals.listProposals).mockResolvedValueOnce([PROPOSAL])
    render(<Proposals />)
    fireEvent.click(screen.getByTestId('proposals-refresh'))
    expect(await screen.findByText('greet')).toBeInTheDocument()
    expect(screen.getByText('greets the user')).toBeInTheDocument()
  })

  it('promotes a proposal and refreshes the list', async () => {
    vi.mocked(proposals.listProposals).mockResolvedValueOnce([PROPOSAL]).mockResolvedValueOnce([])
    vi.mocked(proposals.promoteProposal).mockResolvedValueOnce({ version: 2 })
    render(<Proposals />)
    fireEvent.click(screen.getByTestId('proposals-refresh'))
    const promoteBtn = await screen.findByTestId(`promote-${PROPOSAL.contentHash}`)
    fireEvent.click(promoteBtn)
    expect(proposals.promoteProposal).toHaveBeenCalledWith(PROPOSAL.contentHash)
    expect(await screen.findByText(/Promoted → registry v2/)).toBeInTheDocument()
  })

  it('shows an error message when refresh fails', async () => {
    vi.mocked(proposals.listProposals).mockRejectedValueOnce(new Error('network error'))
    render(<Proposals />)
    fireEvent.click(screen.getByTestId('proposals-refresh'))
    expect(await screen.findByText('Error: network error')).toBeInTheDocument()
  })
})
