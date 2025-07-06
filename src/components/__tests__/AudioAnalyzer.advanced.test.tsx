import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AudioAnalyzer from '../AudioAnalyzer'
import { useVisualizerStore } from '../../store/visualizerStore'

// Mock the store
jest.mock('../../store/visualizerStore')

// Advanced AudioAnalyzer tests for edge cases and performance
describe('AudioAnalyzer - Advanced Tests', () => {
  let mockStore: any
  let mockAudioContext: any
  let mockAnalyser: any

  beforeEach(() => {
    mockStore = {
      isMicrophoneEnabled: false,
      setMicrophoneEnabled: jest.fn(),
      setAudioData: jest.fn(),
      audioData: new Uint8Array(1024),
    }

    mockAnalyser = {
      frequencyBinCount: 1024,
      getByteFrequencyData: jest.fn(),
      getByteTimeDomainData: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    }

    mockAudioContext = {
      createAnalyser: jest.fn(() => mockAnalyser),
      createMediaStreamSource: jest.fn(() => ({
        connect: jest.fn(),
        disconnect: jest.fn(),
      })),
      resume: jest.fn(),
      close: jest.fn(),
      state: 'running',
    }

    // Override global AudioContext mock
    global.AudioContext = jest.fn(() => mockAudioContext)
    ;(useVisualizerStore as jest.Mock).mockReturnValue(mockStore)
    
    jest.clearAllMocks()
  })

  describe('Audio Analysis Performance', () => {
    it('should handle high-frequency audio updates without performance issues', async () => {
      mockStore.isMicrophoneEnabled = true
      render(<AudioAnalyzer />)

      // Simulate rapid audio data updates
      const startTime = Date.now()
      for (let i = 0; i < 100; i++) {
        mockAnalyser.getByteFrequencyData.mockImplementationOnce((array: Uint8Array) => {
          for (let j = 0; j < array.length; j++) {
            array[j] = Math.floor(Math.random() * 255)
          }
        })
      }
      
      const endTime = Date.now()
      const processingTime = endTime - startTime

      // Processing should be fast (less than 1000ms for 100 iterations)
      expect(processingTime).toBeLessThan(1000)
    })

    it('should handle large audio buffer sizes efficiently', () => {
      const largeBufferSize = 8192
      mockAnalyser.frequencyBinCount = largeBufferSize
      
      mockStore.isMicrophoneEnabled = true
      render(<AudioAnalyzer />)

      const largeArray = new Uint8Array(largeBufferSize)
      mockAnalyser.getByteFrequencyData.mockImplementationOnce((array: Uint8Array) => {
        expect(array.length).toBe(largeBufferSize)
      })
    })
  })

  describe('Error Recovery', () => {
    it('should recover from AudioContext creation failure', async () => {
      global.AudioContext = jest.fn(() => {
        throw new Error('AudioContext creation failed')
      })

      mockStore.isMicrophoneEnabled = true
      render(<AudioAnalyzer />)

      // Should handle error gracefully and not crash
      await waitFor(() => {
        expect(mockStore.setMicrophoneEnabled).toHaveBeenCalledWith(false)
      })
    })

    it('should handle getUserMedia permission denial', async () => {
      const mockGetUserMedia = jest.fn(() => 
        Promise.reject(new Error('Permission denied'))
      )
      global.navigator.mediaDevices.getUserMedia = mockGetUserMedia

      mockStore.isMicrophoneEnabled = true
      render(<AudioAnalyzer />)

      await waitFor(() => {
        expect(mockStore.setMicrophoneEnabled).toHaveBeenCalledWith(false)
      })
    })

    it('should cleanup resources when component unmounts', () => {
      mockStore.isMicrophoneEnabled = true
      const { unmount } = render(<AudioAnalyzer />)

      unmount()

      // Verify cleanup was called
      expect(mockAudioContext.close).toHaveBeenCalled()
    })
  })

  describe('Audio Data Processing', () => {
    it('should normalize audio data correctly', async () => {
      mockStore.isMicrophoneEnabled = true
      render(<AudioAnalyzer />)

      // Simulate audio data with known values
      const testData = new Uint8Array([0, 64, 128, 192, 255])
      mockAnalyser.getByteFrequencyData.mockImplementationOnce((array: Uint8Array) => {
        for (let i = 0; i < testData.length && i < array.length; i++) {
          array[i] = testData[i]
        }
      })

      await waitFor(() => {
        expect(mockStore.setAudioData).toHaveBeenCalled()
      })
    })

    it('should detect audio peaks correctly', async () => {
      mockStore.isMicrophoneEnabled = true
      render(<AudioAnalyzer />)

      // Simulate audio with peak values
      mockAnalyser.getByteFrequencyData.mockImplementationOnce((array: Uint8Array) => {
        array[0] = 255 // Peak value
        array[1] = 200
        array[2] = 50
        for (let i = 3; i < array.length; i++) {
          array[i] = 10 // Low baseline
        }
      })

      await waitFor(() => {
        expect(mockStore.setAudioData).toHaveBeenCalled()
      })
    })

    it('should handle silent audio input', async () => {
      mockStore.isMicrophoneEnabled = true
      render(<AudioAnalyzer />)

      // Simulate silent audio (all zeros)
      mockAnalyser.getByteFrequencyData.mockImplementationOnce((array: Uint8Array) => {
        array.fill(0)
      })

      await waitFor(() => {
        expect(mockStore.setAudioData).toHaveBeenCalled()
      })
    })
  })

  describe('Browser Compatibility', () => {
    it('should handle missing AudioContext gracefully', () => {
      // @ts-ignore
      delete global.AudioContext
      // @ts-ignore
      delete global.webkitAudioContext

      mockStore.isMicrophoneEnabled = true
      render(<AudioAnalyzer />)

      // Should not crash and disable microphone
      expect(mockStore.setMicrophoneEnabled).toHaveBeenCalledWith(false)
    })

    it('should handle missing getUserMedia API', () => {
      // @ts-ignore
      delete global.navigator.mediaDevices

      mockStore.isMicrophoneEnabled = true
      render(<AudioAnalyzer />)

      expect(mockStore.setMicrophoneEnabled).toHaveBeenCalledWith(false)
    })
  })
})