import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AudioAnalyzer from '../AudioAnalyzer'
import { useVisualizerStore } from '../../store/visualizerStore'

// Mock the store
jest.mock('../../store/visualizerStore')

// Mock memory manager
jest.mock('../../utils/memoryManager', () => ({
  getReusableAudioBuffer: jest.fn((size) => new Uint8Array(size)),
  returnAudioBuffer: jest.fn(),
}));

// Mock rate limiter
jest.mock('../../utils/rateLimiter', () => ({
  globalRateLimiters: {
    audioData: {
      isAllowed: jest.fn().mockReturnValue(true),
      recordSuccess: jest.fn(),
      recordFailure: jest.fn(),
    },
  },
}));

// Mock validation
jest.mock('../../utils/validation', () => ({
  validateAudioData: jest.fn((data) => data),
  ValidationError: class ValidationError extends Error {},
}));

// Mock error handler
jest.mock('../../utils/errorHandler', () => ({
  errorHandler: {
    audioError: jest.fn(),
  },
}));

// Mock AudioContext and related APIs
const mockAnalyserNode = {
  fftSize: 2048,
  frequencyBinCount: 1024,
  getByteFrequencyData: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
};

const mockMediaStreamAudioSourceNode = {
  connect: jest.fn(),
  disconnect: jest.fn(),
};

const mockAudioContext = {
  createAnalyser: jest.fn().mockReturnValue(mockAnalyserNode),
  createMediaStreamSource: jest.fn().mockReturnValue(mockMediaStreamAudioSourceNode),
  close: jest.fn().mockResolvedValue(undefined),
  state: 'running',
};

// Mock AudioContext constructor
global.AudioContext = jest.fn().mockImplementation(() => mockAudioContext);

const mockStore = {
  isMicrophoneEnabled: false,
  setMicrophoneEnabled: jest.fn(),
}

beforeEach(() => {
  (useVisualizerStore as jest.Mock).mockReturnValue(mockStore)
  jest.clearAllMocks()
  
  // Reset AudioContext state
  mockAudioContext.state = 'running';
  mockAudioContext.close.mockClear();
  mockAnalyserNode.getByteFrequencyData.mockClear();
  mockMediaStreamAudioSourceNode.connect.mockClear();
  mockMediaStreamAudioSourceNode.disconnect.mockClear();
})

describe('AudioAnalyzer', () => {
  beforeAll(() => {
    // Mock getUserMedia
    global.navigator.mediaDevices = {
      getUserMedia: jest.fn().mockResolvedValue({
        getTracks: () => [],
        addTrack: jest.fn(),
        removeTrack: jest.fn(),
      }),
    } as any;
  });
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