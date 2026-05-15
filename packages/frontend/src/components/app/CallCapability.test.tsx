// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as toolkit from '../../api/toolkit.ts'
import { CallCapability } from './CallCapability.tsx'

vi.mock('../../api/toolkit.ts')

describe('CallCapability', () => {
  beforeEach(() => {
    vi.mocked(toolkit.callTool).mockReset()
  })

  it('renders name and role inputs with a Call button', () => {
    render(<CallCapability />)
    expect(screen.getByTestId('cc-name')).toHaveValue('')
    expect(screen.getByTestId('cc-role')).toHaveValue('Implementer')
    expect(screen.getByTestId('cc-submit')).toBeInTheDocument()
  })

  it('calls call-capability with the entered name and role', async () => {
    vi.mocked(toolkit.callTool).mockResolvedValueOnce({ isFailure: false, result: { exitCode: 0, output: 'hi' } })
    render(<CallCapability />)
    fireEvent.change(screen.getByTestId('cc-name'), { target: { value: 'greet' } })
    fireEvent.click(screen.getByTestId('cc-submit'))
    expect(toolkit.callTool).toHaveBeenCalledWith('call-capability', { name: 'greet', role: 'Implementer' })
    expect(await screen.findByText(/"hi"/)).toBeInTheDocument()
  })
})
