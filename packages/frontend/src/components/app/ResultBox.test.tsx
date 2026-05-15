// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ResultBox } from './ResultBox.tsx'

describe('ResultBox', () => {
  it('renders nothing when result is null', () => {
    const { container } = render(<ResultBox result={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('applies success styling when isFailure is false', () => {
    render(<ResultBox result={{ isFailure: false, result: { rows: 3 } }} />)
    const el = screen.getByText(/"rows": 3/)
    expect(el).toHaveClass('bg-success/10')
    expect(el).toHaveClass('text-success')
  })

  it('applies failure styling when isFailure is true', () => {
    render(<ResultBox result={{ isFailure: true, result: 'denied' }} />)
    const el = screen.getByText(/"denied"/)
    expect(el).toHaveClass('bg-destructive/10')
    expect(el).toHaveClass('text-destructive')
  })
})
