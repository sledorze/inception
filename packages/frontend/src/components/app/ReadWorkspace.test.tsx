// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as toolkit from '../../api/toolkit.ts'
import { ReadWorkspace } from './ReadWorkspace.tsx'

vi.mock('../../api/toolkit.ts')

describe('ReadWorkspace', () => {
  beforeEach(() => {
    vi.mocked(toolkit.callTool).mockReset()
  })

  it('renders path input and Call button', () => {
    render(<ReadWorkspace />)
    expect(screen.getByTestId('rw-path')).toHaveValue('')
    expect(screen.getByTestId('rw-submit')).toBeInTheDocument()
  })

  it('calls read-workspace with the entered path and shows the result', async () => {
    vi.mocked(toolkit.callTool).mockResolvedValueOnce({ isFailure: false, result: { content: 'hello' } })
    render(<ReadWorkspace />)
    fireEvent.change(screen.getByTestId('rw-path'), { target: { value: 'data/file.csv' } })
    fireEvent.click(screen.getByTestId('rw-submit'))
    expect(toolkit.callTool).toHaveBeenCalledWith('read-workspace', { path: 'data/file.csv' })
    expect(await screen.findByText(/"hello"/)).toBeInTheDocument()
  })
})
