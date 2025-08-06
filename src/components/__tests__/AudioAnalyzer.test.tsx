import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AudioAnalyzer from '../AudioAnalyzer';
import { useVisualizerStore } from '../../store/visualizerStore';
import { setupWebAudioMocks, cleanupWebAudioMocks, createAudioContextMock } from '../../__mocks__/webAudioMock';

// Mock the store
jest.mock('../../store/visualizerStore');

// Mock memory manager
jest.mock('../../utils/memoryManager', () => ({
  getReusableAudioBuffer: jest.fn(size => new Uint8Array(size)),
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
  validateAudioData: jest.fn(data => data),
  ValidationError: class ValidationError extends Error {},
}));

// Mock error handler
jest.mock('../../utils/errorHandler', () => ({
  errorHandler: {
    audioError: jest.fn(),
  },
}));

// Set up comprehensive Web Audio mocks
let mockAudioContext: any;
let mockAnalyserNode: any;
let mockMediaStreamAudioSourceNode: any;

beforeAll(() => {
  setupWebAudioMocks();
  
  // Get references to mocked objects for testing
  mockAudioContext = createAudioContextMock();
  mockAnalyserNode = mockAudioContext.createAnalyser();
  mockMediaStreamAudioSourceNode = mockAudioContext.createMediaStreamSource();
  
  // Override global AudioContext to return our mock
  (global.AudioContext as jest.Mock).mockImplementation(() => mockAudioContext);
});

afterAll(() => {
  cleanupWebAudioMocks();
});

const mockStore = {
  isMicrophoneEnabled: false,
  setMicrophoneEnabled: jest.fn(),
};

beforeEach(() => {
  (useVisualizerStore as jest.Mock).mockReturnValue(mockStore);
  jest.clearAllMocks();

  // Reset AudioContext state
  if (mockAudioContext) {
    mockAudioContext.state = 'running';
    mockAudioContext.close.mockClear();
  }
  if (mockAnalyserNode) {
    mockAnalyserNode.getByteFrequencyData.mockClear();
  }
  if (mockMediaStreamAudioSourceNode) {
    mockMediaStreamAudioSourceNode.connect.mockClear();
    mockMediaStreamAudioSourceNode.disconnect.mockClear();
  }
});

describe('AudioAnalyzer', () => {
  beforeAll(() => {
    // getUserMedia is already mocked by setupWebAudioMocks
  });
  it('renders without errors when microphone is disabled', () => {
    const { container } = render(<AudioAnalyzer />);
    // AudioAnalyzer returns null when no error, so container should be empty
    expect(container.firstChild).toBeNull();
  });

  it('starts audio analysis when microphone is enabled', async () => {
    mockStore.isMicrophoneEnabled = true;
    render(<AudioAnalyzer />);

    await waitFor(() => {
      expect(mockStore.setMicrophoneEnabled).toHaveBeenCalledWith(true);
    });
  });

  it('handles microphone permission errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock getUserMedia to reject
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValueOnce(
      new Error('Permission denied')
    );

    mockStore.isMicrophoneEnabled = true;
    render(<AudioAnalyzer />);

    await waitFor(() => {
      expect(screen.getByText(/エラー:/)).toBeInTheDocument();
      expect(
        screen.getByText(/マイクアクセスが拒否されました。視覚エフェクトはデモモードで動作します。/)
      ).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it('shows retry button when error occurs', async () => {
    // Mock getUserMedia to reject
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValueOnce(
      new Error('Permission denied')
    );

    mockStore.isMicrophoneEnabled = true;
    render(<AudioAnalyzer />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /再試行/i })).toBeInTheDocument();
    });
  });
});
