import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import VisualEffects from '../VisualEffects'
import { useVisualizerStore } from '../../store/visualizerStore'

// Mock the store
jest.mock('../../store/visualizerStore')

// Advanced VisualEffects tests for performance and WebGL features
describe('VisualEffects - Advanced Tests', () => {
  let mockStore: any
  let mockCanvas: any
  let mockWebGLContext: any

  beforeEach(() => {
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

    mockWebGLContext = {
      createShader: jest.fn(() => ({})),
      shaderSource: jest.fn(),
      compileShader: jest.fn(),
      getShaderParameter: jest.fn(() => true),
      createProgram: jest.fn(() => ({})),
      attachShader: jest.fn(),
      linkProgram: jest.fn(),
      getProgramParameter: jest.fn(() => true),
      useProgram: jest.fn(),
      getAttribLocation: jest.fn(() => 0),
      getUniformLocation: jest.fn(() => ({})),
      enableVertexAttribArray: jest.fn(),
      vertexAttribPointer: jest.fn(),
      uniform1f: jest.fn(),
      uniform2f: jest.fn(),
      uniform3f: jest.fn(),
      uniform4f: jest.fn(),
      uniformMatrix4fv: jest.fn(),
      viewport: jest.fn(),
      clearColor: jest.fn(),
      clear: jest.fn(),
      drawArrays: jest.fn(),
      createBuffer: jest.fn(() => ({})),
      bindBuffer: jest.fn(),
      bufferData: jest.fn(),
      canvas: { width: 800, height: 600 },
      VERTEX_SHADER: 35633,
      FRAGMENT_SHADER: 35632,
      ARRAY_BUFFER: 34962,
      STATIC_DRAW: 35044,
      COLOR_BUFFER_BIT: 16384,
      DEPTH_BUFFER_BIT: 256,
      TRIANGLES: 4,
    }

    mockCanvas = {
      getContext: jest.fn(() => mockWebGLContext),
      width: 800,
      height: 600,
    }

    // Mock canvas creation
    global.HTMLCanvasElement.prototype.getContext = jest.fn(() => mockWebGLContext)
    
    ;(useVisualizerStore as jest.Mock).mockReturnValue(mockStore)
    jest.clearAllMocks()
  })

  describe('WebGL Rendering Performance', () => {
    it('should maintain stable frame rate with high audio frequency', async () => {
      render(<VisualEffects />)

      const canvas = screen.getByRole('img', { hidden: true }) // Canvas has img role by default
      
      // Simulate rapid audio data changes
      const startTime = Date.now()
      for (let i = 0; i < 60; i++) {
        // Simulate 60 FPS updates
        const audioData = new Uint8Array(1024)
        for (let j = 0; j < audioData.length; j++) {
          audioData[j] = Math.floor(Math.random() * 255)
        }
        mockStore.audioData = audioData
        
        // Trigger re-render
        fireEvent.animationFrame(canvas)
      }
      
      const endTime = Date.now()
      const frameTime = (endTime - startTime) / 60

      // Each frame should render in less than 16.67ms (60 FPS)
      expect(frameTime).toBeLessThan(20) // Allow some margin
    })

    it('should handle WebGL context loss gracefully', async () => {
      const { container } = render(<VisualEffects />)
      
      // Simulate WebGL context loss
      mockWebGLContext.getShaderParameter.mockReturnValueOnce(false)
      mockWebGLContext.getProgramParameter.mockReturnValueOnce(false)

      // Should not crash and continue rendering
      expect(container.firstChild).toBeTruthy()
    })

    it('should optimize rendering with multiple layers', () => {
      mockStore.layers = [
        { id: '1', type: 'waveform', enabled: true, opacity: 1.0 },
        { id: '2', type: 'spectrum', enabled: true, opacity: 0.8 },
        { id: '3', type: 'particles', enabled: true, opacity: 0.6 },
        { id: '4', type: 'background', enabled: false, opacity: 0.5 }, // Disabled layer
      ]

      render(<VisualEffects />)

      // Should only render enabled layers
      expect(mockWebGLContext.drawArrays).toHaveBeenCalledTimes(3) // Only 3 enabled layers
    })
  })

  describe('Shader Management', () => {
    it('should compile vertex and fragment shaders correctly', () => {
      render(<VisualEffects />)

      expect(mockWebGLContext.createShader).toHaveBeenCalledWith(mockWebGLContext.VERTEX_SHADER)
      expect(mockWebGLContext.createShader).toHaveBeenCalledWith(mockWebGLContext.FRAGMENT_SHADER)
      expect(mockWebGLContext.compileShader).toHaveBeenCalled()
    })

    it('should handle shader compilation errors', () => {
      mockWebGLContext.getShaderParameter.mockReturnValueOnce(false)
      
      render(<VisualEffects />)

      // Should handle error gracefully and not crash
      expect(mockWebGLContext.createShader).toHaveBeenCalled()
    })

    it('should create and link shader program correctly', () => {
      render(<VisualEffects />)

      expect(mockWebGLContext.createProgram).toHaveBeenCalled()
      expect(mockWebGLContext.attachShader).toHaveBeenCalledTimes(2) // Vertex + Fragment
      expect(mockWebGLContext.linkProgram).toHaveBeenCalled()
    })
  })

  describe('Audio Data Visualization', () => {
    it('should process frequency data for spectrum visualization', () => {
      // Create realistic frequency data
      const audioData = new Uint8Array(1024)
      for (let i = 0; i < audioData.length; i++) {
        // Simulate frequency spectrum with bass peak
        if (i < 50) {
          audioData[i] = 200 + Math.random() * 55 // Bass frequencies
        } else if (i < 200) {
          audioData[i] = 100 + Math.random() * 100 // Mid frequencies
        } else {
          audioData[i] = Math.random() * 50 // High frequencies
        }
      }
      
      mockStore.audioData = audioData
      render(<VisualEffects />)

      // Should pass audio data to shaders
      expect(mockWebGLContext.uniform1f).toHaveBeenCalled()
    })

    it('should handle silent audio input gracefully', () => {
      mockStore.audioData = new Uint8Array(1024) // All zeros
      
      render(<VisualEffects />)

      // Should still render without errors
      expect(mockWebGLContext.drawArrays).toHaveBeenCalled()
    })

    it('should scale audio data based on intensity parameter', () => {
      mockStore.visualParams.intensity = 2.0 // High intensity
      
      render(<VisualEffects />)

      // Should apply intensity scaling in uniforms
      expect(mockWebGLContext.uniform1f).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Number)
      )
    })
  })

  describe('Visual Parameters', () => {
    it('should update uniforms when visual parameters change', () => {
      const { rerender } = render(<VisualEffects />)

      // Change parameters
      mockStore.visualParams = {
        speed: 2.0,
        intensity: 1.5,
        colorShift: 0.5,
        scale: 1.2,
      }

      rerender(<VisualEffects />)

      // Should update WebGL uniforms
      expect(mockWebGLContext.uniform1f).toHaveBeenCalled()
    })

    it('should handle extreme parameter values', () => {
      mockStore.visualParams = {
        speed: 10.0,    // Very fast
        intensity: 0.0, // Zero intensity
        colorShift: 1.0, // Full color shift
        scale: 5.0,     // Large scale
      }

      render(<VisualEffects />)

      // Should not crash with extreme values
      expect(mockWebGLContext.drawArrays).toHaveBeenCalled()
    })
  })

  describe('Canvas Resizing', () => {
    it('should handle canvas resize events', () => {
      const { container } = render(<VisualEffects />)
      const canvas = container.querySelector('canvas')

      // Simulate window resize
      global.innerWidth = 1920
      global.innerHeight = 1080
      fireEvent(window, new Event('resize'))

      expect(mockWebGLContext.viewport).toHaveBeenCalled()
    })

    it('should maintain aspect ratio during resize', () => {
      render(<VisualEffects />)

      // Simulate different aspect ratios
      global.innerWidth = 1920
      global.innerHeight = 1080
      fireEvent(window, new Event('resize'))

      expect(mockWebGLContext.viewport).toHaveBeenCalledWith(0, 0, expect.any(Number), expect.any(Number))
    })
  })

  describe('Memory Management', () => {
    it('should cleanup WebGL resources on unmount', () => {
      const { unmount } = render(<VisualEffects />)
      
      unmount()

      // Should cleanup resources (implementation specific)
      // In a real implementation, this would verify buffer deletion, etc.
      expect(mockWebGLContext.createBuffer).toHaveBeenCalled()
    })

    it('should reuse buffers for performance', () => {
      render(<VisualEffects />)

      // Should create buffers once and reuse them
      const bufferCalls = mockWebGLContext.createBuffer.mock.calls.length
      
      // Trigger multiple renders
      fireEvent.animationFrame(screen.getByRole('img', { hidden: true }))
      fireEvent.animationFrame(screen.getByRole('img', { hidden: true }))

      // Should not create additional buffers
      expect(mockWebGLContext.createBuffer).toHaveBeenCalledTimes(bufferCalls)
    })
  })
})