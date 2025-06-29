import { render, screen, fireEvent } from '@testing-library/react'
import Slider from '../Slider'

describe('Slider', () => {
  it('renders with label and value', () => {
    render(<Slider label="Test Slider" value={50} onChange={() => {}} />)
    
    expect(screen.getByText('Test Slider')).toBeInTheDocument()
    expect(screen.getByDisplayValue('50')).toBeInTheDocument()
  })

  it('calls onChange when value changes', () => {
    const handleChange = jest.fn()
    render(<Slider label="Test" value={25} onChange={handleChange} />)
    
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '75' } })
    
    expect(handleChange).toHaveBeenCalledWith(75)
  })

  it('respects min and max values', () => {
    render(<Slider label="Test" value={50} min={0} max={100} onChange={() => {}} />)
    
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('min', '0')
    expect(slider).toHaveAttribute('max', '100')
  })

  it('uses default step value', () => {
    render(<Slider label="Test" value={50} onChange={() => {}} />)
    
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('step', '1')
  })

  it('accepts custom step value', () => {
    render(<Slider label="Test" value={50} step={0.5} onChange={() => {}} />)
    
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('step', '0.5')
  })

  it('shows formatted value with custom formatter', () => {
    const formatter = (val: number) => `${val}x`
    render(<Slider label="Speed" value={1.5} valueFormatter={formatter} onChange={() => {}} />)
    
    expect(screen.getByText('1.5x')).toBeInTheDocument()
  })

  it('formats values with default formatter', () => {
    render(<Slider label="Test" value={1.23456} onChange={() => {}} />)
    
    expect(screen.getByText('1.23456')).toBeInTheDocument()
  })

  it('applies custom styling', () => {
    render(<Slider label="Test" value={50} color="#ff0000" onChange={() => {}} />)
    
    const slider = screen.getByRole('slider')
    expect(slider).toHaveStyle('background: linear-gradient(to right, #ff0000 0%, #ff0000 50%, #333 50%, #333 100%)')
  })

  it('accepts additional className', () => {
    render(<Slider label="Test" value={50} className="custom-slider" onChange={() => {}} />)
    
    const container = screen.getByText('Test').closest('.custom-slider')
    expect(container).toBeInTheDocument()
  })
})