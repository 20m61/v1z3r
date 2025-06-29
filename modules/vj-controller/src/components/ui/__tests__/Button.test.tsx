import { render, screen, fireEvent } from '@testing-library/react'
import Button from '../Button'

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Test Button</Button>)
    expect(screen.getByText('Test Button')).toBeInTheDocument()
  })

  it('handles click events', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click Me</Button>)
    
    fireEvent.click(screen.getByText('Click Me'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('applies variant classes correctly', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>)
    expect(screen.getByText('Primary')).toHaveClass('bg-v1z3r-primary')

    rerender(<Button variant="secondary">Secondary</Button>)
    expect(screen.getByText('Secondary')).toHaveClass('bg-v1z3r-secondary')

    rerender(<Button variant="outline">Outline</Button>)
    expect(screen.getByText('Outline')).toHaveClass('border', 'border-v1z3r-primary')

    rerender(<Button variant="ghost">Ghost</Button>)
    expect(screen.getByText('Ghost')).toHaveClass('text-v1z3r-light')
  })

  it('applies size classes correctly', () => {
    const { rerender } = render(<Button size="sm">Small</Button>)
    expect(screen.getByText('Small')).toHaveClass('px-3', 'py-1', 'text-sm')

    rerender(<Button size="md">Medium</Button>)
    expect(screen.getByText('Medium')).toHaveClass('px-4', 'py-2')

    rerender(<Button size="lg">Large</Button>)
    expect(screen.getByText('Large')).toHaveClass('px-6', 'py-3', 'text-lg')
  })

  it('disables button when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByText('Disabled')
    expect(button).toBeDisabled()
  })

  it('shows active state', () => {
    render(<Button isActive>Active</Button>)
    const button = screen.getByText('Active')
    expect(button).toHaveClass('ring-2', 'ring-v1z3r-primary')
  })

  it('renders with icon', () => {
    const icon = <span data-testid="test-icon">🔔</span>
    render(<Button icon={icon}>With Icon</Button>)
    
    expect(screen.getByTestId('test-icon')).toBeInTheDocument()
    expect(screen.getByText('With Icon')).toBeInTheDocument()
  })

  it('applies full width class', () => {
    render(<Button fullWidth>Full Width</Button>)
    expect(screen.getByText('Full Width')).toHaveClass('w-full')
  })

  it('accepts additional className', () => {
    render(<Button className="custom-class">Custom</Button>)
    expect(screen.getByText('Custom')).toHaveClass('custom-class')
  })

  it('spreads additional props to button element', () => {
    render(<Button data-testid="custom-button" type="submit">Submit</Button>)
    const button = screen.getByTestId('custom-button')
    expect(button).toHaveAttribute('type', 'submit')
  })
})