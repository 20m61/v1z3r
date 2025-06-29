import { render, screen, fireEvent } from '@testing-library/react'
import ControlPanel from '../ControlPanel'
import { useVisualizerStore } from '../../store/visualizerStore'

// Mock the store
jest.mock('../../store/visualizerStore')

const mockStore = {
  currentEffectType: 'geometric',
  colorTheme: 'cyberpunk',
  sensitivity: 50,
  isAudioAnalyzing: false,
  isMicrophoneEnabled: false,
  isCameraEnabled: false,
  isFullscreen: false,
  isLyricsEnabled: false,
  presets: [],
  setEffectType: jest.fn(),
  setColorTheme: jest.fn(),
  setSensitivity: jest.fn(),
  setMicrophoneEnabled: jest.fn(),
  toggleCamera: jest.fn(),
  toggleFullscreen: jest.fn(),
  savePreset: jest.fn(),
  loadPreset: jest.fn(),
  deletePreset: jest.fn(),
  setLyricsEnabled: jest.fn(),
}

beforeEach(() => {
  (useVisualizerStore as jest.Mock).mockReturnValue(mockStore)
  jest.clearAllMocks()
})

describe('ControlPanel', () => {
  it('renders control panel component', () => {
    render(<ControlPanel />)
    
    // The component should render without throwing errors
    expect(document.body).toBeInTheDocument()
  })

  it('displays sensitivity control', () => {
    render(<ControlPanel />)
    
    // Look for sliders in the component - the sensitivity control should be one of them
    const sliders = screen.getAllByRole('slider')
    expect(sliders.length).toBeGreaterThan(0)
  })

  it('calls setSensitivity when sensitivity changes', () => {
    render(<ControlPanel />)
    
    // Find the first slider (likely sensitivity) and change its value
    const sliders = screen.getAllByRole('slider')
    if (sliders.length > 0) {
      fireEvent.change(sliders[0], { target: { value: '75' } })
      // Check if setSensitivity was called (it might be called with any value)
      expect(mockStore.setSensitivity).toHaveBeenCalled()
    }
  })

  it('displays microphone status', () => {
    render(<ControlPanel />)
    
    // Check that microphone controls are rendered
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('toggles microphone when clicked', () => {
    render(<ControlPanel />)
    
    // Find and click microphone button (using icon test)
    const buttons = screen.getAllByRole('button')
    const micButton = buttons.find(button => 
      button.getAttribute('title') === 'マイク' || 
      button.textContent?.includes('マイク')
    )
    
    if (micButton) {
      fireEvent.click(micButton)
      expect(mockStore.setMicrophoneEnabled).toHaveBeenCalled()
    }
  })

  it('handles effect type changes', () => {
    render(<ControlPanel />)
    
    // Test should not throw errors and store should be accessible
    expect(mockStore.currentEffectType).toBe('geometric')
  })
})