// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../../App.tsx'

vi.mock('../../api/toolkit.ts')
vi.mock('../../api/goals.ts')
vi.mock('../../api/proposals.ts')

describe('App', () => {
  it('renders all feature panels', () => {
    render(<App />)
    expect(screen.getByText('Georges Toolkit')).toBeInTheDocument()
    expect(screen.getByText('Submit Goal to Georges')).toBeInTheDocument()
    expect(screen.getByText('Pending Proposals')).toBeInTheDocument()
    expect(screen.getByText('call-capability')).toBeInTheDocument()
    expect(screen.getByText('list-tools')).toBeInTheDocument()
    expect(screen.getByText('read-workspace')).toBeInTheDocument()
    expect(screen.getByText('write-workspace')).toBeInTheDocument()
  })
})
