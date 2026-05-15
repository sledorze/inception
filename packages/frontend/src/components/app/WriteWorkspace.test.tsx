// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as toolkit from '../../api/toolkit.ts'
import { WriteWorkspace } from './WriteWorkspace.tsx'

vi.mock('../../api/toolkit.ts')

describe('WriteWorkspace', () => {
  beforeEach(() => {
    vi.mocked(toolkit.callTool).mockReset()
  })

  it('renders role, path, content inputs and a Call button', () => {
    render(<WriteWorkspace />)
    expect(screen.getByTestId('ww-role')).toHaveValue('Implementer')
    expect(screen.getByTestId('ww-path')).toHaveValue('')
    expect(screen.getByTestId('ww-content')).toHaveValue('')
    expect(screen.getByTestId('ww-submit')).toBeInTheDocument()
  })

  it('calls write-workspace with all three fields on submit', async () => {
    vi.mocked(toolkit.callTool).mockResolvedValueOnce({ isFailure: false, result: { path: 'out.txt' } })
    render(<WriteWorkspace />)
    fireEvent.change(screen.getByTestId('ww-path'), { target: { value: 'out.txt' } })
    fireEvent.change(screen.getByTestId('ww-content'), { target: { value: 'hello world' } })
    fireEvent.click(screen.getByTestId('ww-submit'))
    expect(toolkit.callTool).toHaveBeenCalledWith('write-workspace', {
      content: 'hello world',
      path: 'out.txt',
      role: 'Implementer',
    })
    expect(await screen.findByText(/"out.txt"/)).toBeInTheDocument()
  })
})
