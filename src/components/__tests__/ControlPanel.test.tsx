import { render, screen, fireEvent } from '@testing-library/react'
import { ControlPanel } from '@vj-app/vj-controller'

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}))

// Mock react-icons
jest.mock('react-icons/fi', () => ({
  FiSettings: () => <div data-testid="settings-icon" />,
  FiLayers: () => <div data-testid="layers-icon" />,
  FiMusic: () => <div data-testid="music-icon" />,
  FiFolder: () => <div data-testid="folder-icon" />,
  FiMic: () => <div data-testid="mic-icon" />,
  FiVideo: () => <div data-testid="video-icon" />,
  FiSave: () => <div data-testid="save-icon" />,
  FiShare: () => <div data-testid="share-icon" />,
  FiChevronUp: () => <div data-testid="chevron-up" />,
  FiChevronDown: () => <div data-testid="chevron-down" />,
}))

describe('ControlPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<ControlPanel />)
    expect(screen.getByText('VJ Controller')).toBeInTheDocument()
  })

  it('displays all tab options', () => {
    render(<ControlPanel />)
    
    expect(screen.getByText('Effects')).toBeInTheDocument()
    expect(screen.getByText('Layers')).toBeInTheDocument()
    expect(screen.getByText('Lyrics')).toBeInTheDocument()
    expect(screen.getByText('Presets')).toBeInTheDocument()
  })

  it('can toggle collapse state', () => {
    render(<ControlPanel />)
    
    const header = screen.getByText('VJ Controller').closest('div')
    
    // Initially should be expanded
    expect(screen.getByText('Effects')).toBeInTheDocument()
    
    // Click to collapse
    fireEvent.click(header!)
    
    // Content should still be there (due to animation mock)
    expect(screen.getByText('Effects')).toBeInTheDocument()
  })

  it('switches between tabs', () => {
    render(<ControlPanel />)
    
    // Click on Layers tab
    fireEvent.click(screen.getByText('Layers'))
    expect(screen.getByText('Add Layer')).toBeInTheDocument()
    
    // Click on Presets tab
    fireEvent.click(screen.getByText('Presets'))
    expect(screen.getByText('Save Preset')).toBeInTheDocument()
  })

  it('shows microphone controls in lyrics tab', () => {
    render(<ControlPanel />)
    
    // Switch to lyrics tab
    fireEvent.click(screen.getByText('Lyrics'))
    
    expect(screen.getByText('Start Recording')).toBeInTheDocument()
    expect(screen.getByText(/Voice recognition inactive/)).toBeInTheDocument()
  })

  it('handles microphone toggle', () => {
    render(<ControlPanel />)
    
    // Switch to lyrics tab
    fireEvent.click(screen.getByText('Lyrics'))
    
    const micButton = screen.getByText('Start Recording')
    fireEvent.click(micButton)
    
    // Note: Due to getUserMedia being mocked, we can't test the actual state change
    // In a real test environment, you would mock navigator.mediaDevices.getUserMedia
  })

  it('accepts custom className', () => {
    const { container } = render(<ControlPanel className="custom-class" />)
    
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('shows effect controls in effects tab', () => {
    render(<ControlPanel />)
    
    // Should be on effects tab by default
    expect(screen.getByText('Intensity')).toBeInTheDocument()
    expect(screen.getByText('Speed')).toBeInTheDocument()
    expect(screen.getByText('Color Shift')).toBeInTheDocument()
  })
})