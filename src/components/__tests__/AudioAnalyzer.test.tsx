import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AudioAnalyzer from '../AudioAnalyzer'
import { useVisualizerStore } from '../../store/visualizerStore'

// Mock the store
jest.mock('../../store/visualizerStore')

const mockStore = {
  isMicrophoneEnabled: false,
  setMicrophoneEnabled: jest.fn(),
}

beforeEach(() => {
  (useVisualizerStore as jest.Mock).mockReturnValue(mockStore)
  jest.clearAllMocks()
})

describe('AudioAnalyzer', () => {
  it('renders without errors when microphone is disabled', () => {
    const { container } = render(<AudioAnalyzer />)
    // AudioAnalyzer returns null when no error, so container should be empty
    expect(container.firstChild).toBeNull()
  })

  it('starts audio analysis when microphone is enabled', async () => {
    mockStore.isMicrophoneEnabled = true
    render(<AudioAnalyzer />)

    await waitFor(() => {
      expect(mockStore.setMicrophoneEnabled).toHaveBeenCalledWith(true)
    })
  })

  it('handles microphone permission errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    
    // Mock getUserMedia to reject
    const mockGetUserMedia = jest.fn().mockRejectedValue(new Error('Permission denied'))
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
    })

    mockStore.isMicrophoneEnabled = true
    render(<AudioAnalyzer />)

    await waitFor(() => {
      expect(screen.getByText(/エラー:/)).toBeInTheDocument()
      expect(screen.getByText(/マイクへのアクセスが拒否されたか、エラーが発生しました/)).toBeInTheDocument()
    })

    consoleSpy.mockRestore()
  })

  it('shows retry button when error occurs', async () => {
    const mockGetUserMedia = jest.fn().mockRejectedValue(new Error('Permission denied'))
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
    })

    mockStore.isMicrophoneEnabled = true
    render(<AudioAnalyzer />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /再試行/i })).toBeInTheDocument()
    })
  })
})