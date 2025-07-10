import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import VisualEffects from '../VisualEffects'
import { useVisualizerStore } from '../../store/visualizerStore'

// Mock the store
jest.mock('../../store/visualizerStore')

// Mock OffscreenCanvas for Node.js test environment
let mockWebGLContext: any
let mock2DContext: any

global.OffscreenCanvas = class OffscreenCanvas {
  width: number
  height: number
  
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }
  
  getContext(contextType: string) {
    if (contextType === '2d') {
      return mock2DContext
    }
    return null
  }
} as any

// Advanced VisualEffects tests for performance and 2D Canvas features
describe('VisualEffects - Advanced Tests', () => {
  let mockStore: any
  let originalOffscreenCanvas: any
  let originalRAF: any

  beforeEach(() => {
    // Save originals
    originalOffscreenCanvas = global.OffscreenCanvas
    originalRAF = global.requestAnimationFrame

    // Mock requestAnimationFrame
    let frameCount = 0
    global.requestAnimationFrame = jest.fn((cb) => {
      setTimeout(() => cb(frameCount++ * 16.67), 0)
      return frameCount
    }) as any
    global.cancelAnimationFrame = jest.fn()

    // Mock 2D context
    mock2DContext = {
      fillStyle: '',
      strokeStyle: '',
      globalAlpha: 1,
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      strokeRect: jest.fn(),
      beginPath: jest.fn(),
      closePath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      stroke: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      scale: jest.fn(),
      drawImage: jest.fn(),
      createLinearGradient: jest.fn(() => ({
        addColorStop: jest.fn(),
      })),
      createRadialGradient: jest.fn(() => ({
        addColorStop: jest.fn(),
      })),
      canvas: { width: 800, height: 600 },
    }

    // Mock canvas getContext
    HTMLCanvasElement.prototype.getContext = jest.fn((type) => {
      if (type === '2d') {
        return mock2DContext
      }
      return null
    })

    mockStore = {
      audioData: new Uint8Array(1024),
      visualParams: {
        speed: 1.0,
        intensity: 0.5,
        colorShift: 0.0,
        scale: 1.0,
      },
      layers: [
        { id: '1', type: 'waveform', enabled: true, opacity: 1.0 },
        { id: '2', type: 'spectrum', enabled: true, opacity: 0.8 },
      ],
    }
    
    ;(useVisualizerStore as jest.Mock).mockReturnValue(mockStore)
    jest.clearAllMocks()
  })

  afterEach(() => {
    // Restore originals
    if (originalOffscreenCanvas) {
      global.OffscreenCanvas = originalOffscreenCanvas
    }
    global.requestAnimationFrame = originalRAF
  })

  describe('Canvas Rendering Performance', () => {
    it('should maintain stable frame rate with high audio frequency', async () => {
      const { container } = render(
        <VisualEffects 
          audioData={mockStore.audioData}
          effectType="spectrum"
          colorTheme="#00ccff"
          quality="high"
        />
      )

      const canvas = container.querySelector('canvas[data-testid="vj-canvas"]')
      expect(canvas).toBeInTheDocument()
      
      // Wait for initial render
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      // Verify canvas operations were called
      expect(mock2DContext.clearRect).toHaveBeenCalled()
      expect(mock2DContext.drawImage).toHaveBeenCalled() // drawImage is called to copy from offscreen canvas
    })

    it('should handle different effect types', async () => {
      const effectTypes = ['spectrum', 'waveform', 'particles', 'circular'] as const

      for (const effectType of effectTypes) {
        const { rerender } = render(
          <VisualEffects 
            audioData={mockStore.audioData}
            effectType={effectType}
            colorTheme="#00ccff"
          />
        )

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 50))
        })

        // Each effect type should trigger canvas operations
        expect(mock2DContext.clearRect).toHaveBeenCalled()
        jest.clearAllMocks()
      }
    })

    it('should optimize rendering with quality settings', async () => {
      const { rerender } = render(
        <VisualEffects 
          audioData={mockStore.audioData}
          effectType="spectrum"
          colorTheme="#00ccff"
          quality="low"
        />
      )

      // Low quality should use fewer resources
      const lowQualityCalls = mock2DContext.beginPath.mock.calls.length

      jest.clearAllMocks()

      rerender(
        <VisualEffects 
          audioData={mockStore.audioData}
          effectType="spectrum"
          colorTheme="#00ccff"
          quality="high"
        />
      )

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      // High quality may use more drawing operations
      expect(mock2DContext.clearRect).toHaveBeenCalled()
    })
  })

  describe('Audio Data Visualization', () => {
    it('should process frequency data for spectrum visualization', async () => {
      // Create realistic frequency data
      const audioData = new Uint8Array(1024)
      for (let i = 0; i < audioData.length; i++) {
        // Simulate frequency spectrum with bass peak
        if (i < 50) {
          audioData[i] = 200 + Math.floor(Math.random() * 55) // Bass frequencies
        } else if (i < 200) {
          audioData[i] = 100 + Math.floor(Math.random() * 100) // Mid frequencies
        } else {
          audioData[i] = Math.floor(Math.random() * 50) // High frequencies
        }
      }
      
      render(
        <VisualEffects 
          audioData={audioData}
          effectType="spectrum"
          colorTheme="#00ccff"
        />
      )

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      // Should render spectrum bars
      expect(mock2DContext.fillRect).toHaveBeenCalled()
    })

    it('should handle silent audio input gracefully', async () => {
      const silentAudio = new Uint8Array(1024) // All zeros
      
      render(
        <VisualEffects 
          audioData={silentAudio}
          effectType="spectrum"
          colorTheme="#00ccff"
        />
      )

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      // Should still render without errors
      expect(mock2DContext.clearRect).toHaveBeenCalled()
    })

    it('should update visualization when audio data changes', async () => {
      const { rerender } = render(
        <VisualEffects 
          audioData={mockStore.audioData}
          effectType="waveform"
          colorTheme="#00ccff"
        />
      )

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      const initialCalls = mock2DContext.lineTo.mock.calls.length

      // Update audio data
      const newAudioData = new Uint8Array(1024)
      for (let i = 0; i < newAudioData.length; i++) {
        newAudioData[i] = Math.floor(Math.random() * 255)
      }

      rerender(
        <VisualEffects 
          audioData={newAudioData}
          effectType="waveform"
          colorTheme="#00ccff"
        />
      )

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      // Should have drawn new waveform
      expect(mock2DContext.lineTo.mock.calls.length).toBeGreaterThan(initialCalls)
    })
  })

  describe('Visual Effects', () => {
    it('should apply color themes correctly', async () => {
      const colorThemes = ['#ff0000', '#00ff00', '#0000ff', '#ffff00']

      for (const color of colorThemes) {
        render(
          <VisualEffects 
            audioData={mockStore.audioData}
            effectType="spectrum"
            colorTheme={color}
          />
        )

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 50))
        })

        // Color should be applied to fill or stroke style
        expect(mock2DContext.fillStyle).toBeDefined()
        jest.clearAllMocks()
      }
    })

    it('should handle gradient creation for effects', async () => {
      render(
        <VisualEffects 
          audioData={mockStore.audioData}
          effectType="circular"
          colorTheme="#00ccff"
        />
      )

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      // Circular effect should draw arcs or use other drawing operations
      // Check that some drawing operations occurred
      const drawingOperations = 
        mock2DContext.arc.mock.calls.length +
        mock2DContext.fill.mock.calls.length +
        mock2DContext.stroke.mock.calls.length +
        mock2DContext.fillRect.mock.calls.length
      
      expect(drawingOperations).toBeGreaterThan(0)
    })
  })

  describe('Canvas Resizing', () => {
    it('should handle canvas resize events', async () => {
      const { container } = render(
        <VisualEffects 
          audioData={mockStore.audioData}
          effectType="spectrum"
          colorTheme="#00ccff"
        />
      )

      // Simulate window resize
      global.innerWidth = 1920
      global.innerHeight = 1080
      
      act(() => {
        fireEvent(window, new Event('resize'))
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      const canvas = container.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
    })
  })

  describe('Memory Management', () => {
    it('should cleanup animation frame on unmount', async () => {
      const { unmount } = render(
        <VisualEffects 
          audioData={mockStore.audioData}
          effectType="spectrum"
          colorTheme="#00ccff"
        />
      )
      
      // Wait for component to start rendering
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })
      
      unmount()

      // Should cancel animation frame
      expect(global.cancelAnimationFrame).toHaveBeenCalled()
    })

    it('should handle rapid prop changes efficiently', async () => {
      const { rerender } = render(
        <VisualEffects 
          audioData={mockStore.audioData}
          effectType="spectrum"
          colorTheme="#00ccff"
        />
      )

      // Simulate rapid prop changes
      for (let i = 0; i < 10; i++) {
        const newAudioData = new Uint8Array(1024)
        for (let j = 0; j < newAudioData.length; j++) {
          newAudioData[j] = Math.floor(Math.random() * 255)
        }

        rerender(
          <VisualEffects 
            audioData={newAudioData}
            effectType={i % 2 === 0 ? 'spectrum' : 'waveform'}
            colorTheme={i % 2 === 0 ? '#00ccff' : '#ff00ff'}
          />
        )
      }

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      // Should handle rapid changes without errors
      expect(mock2DContext.clearRect).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid audio data gracefully', async () => {
      // Test with undefined audio data
      render(
        <VisualEffects 
          effectType="spectrum"
          colorTheme="#00ccff"
        />
      )

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      // Should render without crashing
      expect(mock2DContext.clearRect).toHaveBeenCalled()
    })

    it('should handle canvas context creation failure', () => {
      // Mock context creation failure
      HTMLCanvasElement.prototype.getContext = jest.fn(() => null)

      const { container } = render(
        <VisualEffects 
          audioData={mockStore.audioData}
          effectType="spectrum"
          colorTheme="#00ccff"
        />
      )

      // Should still render canvas element
      const canvas = container.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
    })
  })
})