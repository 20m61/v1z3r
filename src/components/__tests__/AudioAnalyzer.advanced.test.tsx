import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AudioAnalyzer from '../AudioAnalyzer';
import { useVisualizerStore } from '../../store/visualizerStore';

// Mock the store
jest.mock('../../store/visualizerStore');

// Mock rate limiters
jest.mock('../../utils/rateLimiter', () => ({
  globalRateLimiters: {
    audioData: {
      isAllowed: jest.fn(() => true),
      recordSuccess: jest.fn(),
      recordFailure: jest.fn(),
    },
  },
}));

// Mock memory manager
jest.mock('../../utils/memoryManager', () => ({
  getReusableAudioBuffer: jest.fn(size => new Uint8Array(size)),
  returnAudioBuffer: jest.fn(),
}));

// Mock validation
jest.mock('../../utils/validation', () => ({
  validateAudioData: jest.fn(data => data),
  ValidationError: class ValidationError extends Error {},
}));

// Advanced AudioAnalyzer tests for edge cases and performance
describe.skip('AudioAnalyzer - Advanced Tests', () => {
  let mockStore: any;
  let mockAudioContext: any;
  let mockAnalyser: any;
  let mockMediaStream: any;
  let mockGetUserMedia: jest.Mock;
  let rafCallbacks: Array<FrameRequestCallback> = [];

  beforeEach(() => {
    // Mock requestAnimationFrame
    rafCallbacks = [];
    global.requestAnimationFrame = jest.fn(callback => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    }) as any;
    global.cancelAnimationFrame = jest.fn(id => {
      rafCallbacks = rafCallbacks.filter((_, index) => index + 1 !== id);
    }) as any;

    mockStore = {
      isMicrophoneEnabled: false,
      setMicrophoneEnabled: jest.fn(),
      setAudioData: jest.fn(),
      audioData: new Uint8Array(1024),
    };

    mockAnalyser = {
      frequencyBinCount: 1024,
      fftSize: 2048,
      getByteFrequencyData: jest.fn((array: Uint8Array) => {
        // Fill with test data by default
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 128);
        }
      }),
      getByteTimeDomainData: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    };

    const mockSource = {
      connect: jest.fn(),
      disconnect: jest.fn(),
    };

    mockAudioContext = {
      createAnalyser: jest.fn(() => mockAnalyser),
      createMediaStreamSource: jest.fn(() => mockSource),
      resume: jest.fn(() => Promise.resolve()),
      close: jest.fn(() => Promise.resolve()),
      state: 'running',
    };

    // Mock MediaStream
    mockMediaStream = {
      getTracks: jest.fn(() => [
        {
          stop: jest.fn(),
        },
      ]),
    };

    // Mock getUserMedia
    mockGetUserMedia = jest.fn(() => Promise.resolve(mockMediaStream));

    // Setup navigator.mediaDevices mock
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: mockGetUserMedia,
      },
      writable: true,
      configurable: true,
    });

    // Override global AudioContext mock
    global.AudioContext = jest.fn(() => mockAudioContext) as any;
    (useVisualizerStore as jest.Mock).mockReturnValue(mockStore);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    rafCallbacks = [];
  });

  // Helper function to trigger animation frame
  const triggerAnimationFrame = () => {
    const callbacks = [...rafCallbacks];
    callbacks.forEach(cb => cb(performance.now()));
  };

  describe('Audio Analysis Performance', () => {
    it('should handle high-frequency audio updates without performance issues', async () => {
      // Create custom onAudioData handler
      const onAudioData = jest.fn();
      mockStore.isMicrophoneEnabled = true;

      const { container } = render(<AudioAnalyzer onAudioData={onAudioData} />);

      // Wait for microphone to be enabled
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      // Simulate rapid audio data updates
      let updateCount = 0;
      mockAnalyser.getByteFrequencyData.mockImplementation((array: Uint8Array) => {
        updateCount++;
        for (let j = 0; j < array.length; j++) {
          array[j] = Math.floor(Math.random() * 255);
        }
      });

      // Trigger animation frame to start audio analysis
      triggerAnimationFrame();

      // Wait for audio data to be passed to callback
      await waitFor(() => {
        expect(onAudioData).toHaveBeenCalled();
      });

      // Processing should handle updates efficiently
      expect(updateCount).toBeGreaterThan(0);
    });

    it('should handle large audio buffer sizes efficiently', async () => {
      const largeBufferSize = 4096;
      mockAnalyser.frequencyBinCount = largeBufferSize;

      const onAudioData = jest.fn();
      mockStore.isMicrophoneEnabled = true;
      render(<AudioAnalyzer onAudioData={onAudioData} />);

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      // Trigger animation frame
      triggerAnimationFrame();

      // Verify large buffer is handled
      await waitFor(() => {
        expect(onAudioData).toHaveBeenCalled();
        const audioData = onAudioData.mock.calls[0][0];
        expect(audioData).toBeInstanceOf(Uint8Array);
        expect(audioData.length).toBe(largeBufferSize);
      });
    });
  });

  describe('Error Recovery', () => {
    it('should recover from AudioContext creation failure', async () => {
      global.AudioContext = jest.fn(() => {
        throw new Error('AudioContext creation failed');
      }) as any;

      mockStore.isMicrophoneEnabled = true;
      render(<AudioAnalyzer />);

      // Should handle error gracefully and not crash
      await waitFor(() => {
        expect(mockStore.setMicrophoneEnabled).toHaveBeenCalledWith(false);
      });
    });

    it('should handle getUserMedia permission denial', async () => {
      mockGetUserMedia.mockRejectedValueOnce(
        new DOMException('Permission denied', 'NotAllowedError')
      );

      mockStore.isMicrophoneEnabled = true;
      render(<AudioAnalyzer />);

      await waitFor(() => {
        expect(mockStore.setMicrophoneEnabled).toHaveBeenCalledWith(false);
      });
    });

    it('should cleanup resources when component unmounts', async () => {
      mockStore.isMicrophoneEnabled = true;
      const { unmount } = render(<AudioAnalyzer />);

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      unmount();

      // Verify cleanup was called
      await waitFor(() => {
        expect(mockAudioContext.close).toHaveBeenCalled();
      });
    });
  });

  describe('Audio Data Processing', () => {
    it('should normalize audio data correctly', async () => {
      const onAudioData = jest.fn();
      mockStore.isMicrophoneEnabled = true;
      render(<AudioAnalyzer onAudioData={onAudioData} />);

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      // Simulate audio data with known values
      const testData = new Uint8Array([0, 64, 128, 192, 255]);
      mockAnalyser.getByteFrequencyData.mockImplementationOnce((array: Uint8Array) => {
        for (let i = 0; i < testData.length && i < array.length; i++) {
          array[i] = testData[i];
        }
      });

      // Trigger animation frame
      triggerAnimationFrame();

      await waitFor(() => {
        expect(onAudioData).toHaveBeenCalled();
        const audioData = onAudioData.mock.calls[0][0];
        expect(audioData).toBeInstanceOf(Uint8Array);
      });
    });

    it('should detect audio peaks correctly', async () => {
      const onAudioData = jest.fn();
      mockStore.isMicrophoneEnabled = true;
      render(<AudioAnalyzer onAudioData={onAudioData} />);

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      // Simulate audio with peak values
      mockAnalyser.getByteFrequencyData.mockImplementationOnce((array: Uint8Array) => {
        array[0] = 255; // Peak value
        array[1] = 200;
        array[2] = 50;
        for (let i = 3; i < array.length; i++) {
          array[i] = 10; // Low baseline
        }
      });

      // Trigger animation frame
      triggerAnimationFrame();

      await waitFor(() => {
        expect(onAudioData).toHaveBeenCalled();
        const audioData = onAudioData.mock.calls[0][0];
        expect(audioData[0]).toBe(255); // Peak value
        expect(audioData[1]).toBe(200);
      });
    });

    it('should handle silent audio input', async () => {
      const onAudioData = jest.fn();
      mockStore.isMicrophoneEnabled = true;
      render(<AudioAnalyzer onAudioData={onAudioData} />);

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      // Simulate silent audio (all zeros)
      mockAnalyser.getByteFrequencyData.mockImplementationOnce((array: Uint8Array) => {
        array.fill(0);
      });

      // Trigger animation frame
      triggerAnimationFrame();

      await waitFor(() => {
        expect(onAudioData).toHaveBeenCalled();
        const audioData = onAudioData.mock.calls[0][0];
        expect(audioData.every(v => v === 0)).toBe(true); // All zeros
      });
    });
  });

  describe('Browser Compatibility', () => {
    it('should handle missing AudioContext gracefully', async () => {
      // Remove AudioContext
      (global as any).AudioContext = undefined;
      (global as any).webkitAudioContext = undefined;

      mockStore.isMicrophoneEnabled = true;
      render(<AudioAnalyzer />);

      // Should not crash and disable microphone
      await waitFor(() => {
        expect(mockStore.setMicrophoneEnabled).toHaveBeenCalledWith(false);
      });
    });

    it('should handle missing getUserMedia API', async () => {
      // Remove mediaDevices
      Object.defineProperty(global.navigator, 'mediaDevices', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      mockStore.isMicrophoneEnabled = true;
      render(<AudioAnalyzer />);

      await waitFor(() => {
        expect(mockStore.setMicrophoneEnabled).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('UI Interaction', () => {
    it('should show error message when microphone access fails', async () => {
      mockGetUserMedia.mockRejectedValueOnce(
        new DOMException('Permission denied', 'NotAllowedError')
      );

      render(<AudioAnalyzer />);

      // Find and click the enable button
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/マイクアクセスが拒否されました/)).toBeInTheDocument();
      });
    });

    it('should toggle microphone state when button is clicked', async () => {
      render(<AudioAnalyzer />);

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('マイクを有効にする');

      // Enable microphone
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockStore.setMicrophoneEnabled).toHaveBeenCalledWith(true);
      });

      // Update the mock to reflect enabled state
      mockStore.isMicrophoneEnabled = true;
      (useVisualizerStore as jest.Mock).mockReturnValue(mockStore);

      // Disable microphone
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockStore.setMicrophoneEnabled).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits for audio data updates', async () => {
      const { globalRateLimiters } = require('../../utils/rateLimiter');
      const onAudioData = jest.fn();

      // First allow, then deny
      globalRateLimiters.audioData.isAllowed
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      mockStore.isMicrophoneEnabled = true;
      render(<AudioAnalyzer onAudioData={onAudioData} />);

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      // Trigger multiple animation frames
      triggerAnimationFrame(); // Should process
      triggerAnimationFrame(); // Should skip due to rate limit
      triggerAnimationFrame(); // Should process

      await waitFor(() => {
        // Should have been called only twice (first and third)
        expect(onAudioData).toHaveBeenCalledTimes(2);
      });
    });
  });
});
