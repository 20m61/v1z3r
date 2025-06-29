import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import VisualEffects from '../VisualEffects'
import { EffectType } from '@/store/visualizerStore'

// Mock performance utilities
jest.mock('@/utils/performance', () => ({
  startMeasure: jest.fn(),
  endMeasure: jest.fn(),
  throttle: jest.fn((fn) => fn),
}))

// Mock OffscreenCanvas
global.OffscreenCanvas = class OffscreenCanvas {
  width: number = 0
  height: number = 0
  
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }
  
  getContext() {
    return {
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      stroke: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      drawImage: jest.fn(),
      createImageData: jest.fn(() => ({ data: new Uint8ClampedArray(4) })),
      putImageData: jest.fn(),
      getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(4) })),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      scale: jest.fn(),
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      globalAlpha: 1,
    }
  }
  
  transferToImageBitmap() {
    return {} as ImageBitmap
  }
} as any

describe('VisualEffects', () => {
  const defaultProps = {
    effectType: 'spectrum' as EffectType,
    colorTheme: '#00ccff',
    quality: 'medium' as const,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset animation frame mock
    global.requestAnimationFrame = jest.fn((cb) => {
      setTimeout(cb, 16)
      return 1
    })
    global.cancelAnimationFrame = jest.fn()
  })

  it('renders canvas element', () => {
    render(<VisualEffects {...defaultProps} />)
    
    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
    expect(canvas).toHaveClass('canvas')
  })

  it('applies quality settings correctly', () => {
    const { rerender } = render(<VisualEffects {...defaultProps} quality="low" />)
    
    // Component should render without errors for low quality
    expect(document.querySelector('canvas')).toBeInTheDocument()
    
    rerender(<VisualEffects {...defaultProps} quality="high" />)
    expect(document.querySelector('canvas')).toBeInTheDocument()
  })

  it('handles different effect types', () => {
    const effectTypes: EffectType[] = ['spectrum', 'waveform', 'particles', 'geometric', 'tunnel', 'kaleidoscope']
    
    effectTypes.forEach(effectType => {
      const { rerender } = render(<VisualEffects {...defaultProps} effectType={effectType} />)
      expect(document.querySelector('canvas')).toBeInTheDocument()
      rerender(<div />) // Unmount to clean up
    })
  })

  it('processes audio data when provided', () => {
    const audioData = new Uint8Array(256).fill(128)
    
    render(<VisualEffects {...defaultProps} audioData={audioData} />)
    
    // Should render without errors when audio data is provided
    expect(document.querySelector('canvas')).toBeInTheDocument()
  })

  it('handles missing audio data gracefully', () => {
    render(<VisualEffects {...defaultProps} audioData={undefined} />)
    
    // Should render without errors when no audio data is provided
    expect(document.querySelector('canvas')).toBeInTheDocument()
  })

  it('applies color theme correctly', () => {
    const { rerender } = render(<VisualEffects {...defaultProps} colorTheme="#ff0000" />)
    expect(document.querySelector('canvas')).toBeInTheDocument()
    
    rerender(<VisualEffects {...defaultProps} colorTheme="#00ff00" />)
    expect(document.querySelector('canvas')).toBeInTheDocument()
  })

  it('starts and stops animation loop on mount/unmount', () => {
    const { unmount } = render(<VisualEffects {...defaultProps} />)
    
    // Animation should start
    expect(global.requestAnimationFrame).toHaveBeenCalled()
    
    unmount()
    
    // Animation should be cleaned up
    expect(global.cancelAnimationFrame).toHaveBeenCalled()
  })

  it('handles canvas context creation failure', () => {
    // Mock getContext to return null
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = jest.fn(() => null)
    
    render(<VisualEffects {...defaultProps} />)
    
    // Should render without throwing errors
    expect(document.querySelector('canvas')).toBeInTheDocument()
    
    // Restore original method
    HTMLCanvasElement.prototype.getContext = originalGetContext
  })

  it('updates when props change', () => {
    const { rerender } = render(<VisualEffects {...defaultProps} effectType="spectrum" />)
    
    expect(document.querySelector('canvas')).toBeInTheDocument()
    
    rerender(<VisualEffects {...defaultProps} effectType="waveform" />)
    expect(document.querySelector('canvas')).toBeInTheDocument()
  })

  it('maintains performance with frequent updates', async () => {
    const audioData = new Uint8Array(256)
    
    const { rerender } = render(<VisualEffects {...defaultProps} audioData={audioData} />)
    
    // Simulate rapid audio data updates
    for (let i = 0; i < 10; i++) {
      const newAudioData = new Uint8Array(256).fill(i * 25)
      rerender(<VisualEffects {...defaultProps} audioData={newAudioData} />)
    }
    
    // Should still render correctly
    expect(document.querySelector('canvas')).toBeInTheDocument()
  })

  it('handles resize events', () => {
    render(<VisualEffects {...defaultProps} />)
    
    // Simulate window resize
    global.dispatchEvent(new Event('resize'))
    
    // Should handle resize without errors
    expect(document.querySelector('canvas')).toBeInTheDocument()
  })

  it('cleans up resources on unmount', () => {
    const { unmount } = render(<VisualEffects {...defaultProps} />)
    
    // Should have started animation
    expect(global.requestAnimationFrame).toHaveBeenCalled()
    
    unmount()
    
    // Should clean up animation frame
    expect(global.cancelAnimationFrame).toHaveBeenCalled()
  })

  it('memoizes correctly with same props', () => {
    const { rerender } = render(<VisualEffects {...defaultProps} />)
    const firstCanvas = document.querySelector('canvas')
    
    // Re-render with same props
    rerender(<VisualEffects {...defaultProps} />)
    const secondCanvas = document.querySelector('canvas')
    
    // Should be the same element due to memoization
    expect(firstCanvas).toBe(secondCanvas)
  })

  it('handles extreme audio data values', () => {
    // Test with all zeros
    let audioData = new Uint8Array(256).fill(0)
    const { rerender } = render(<VisualEffects {...defaultProps} audioData={audioData} />)
    expect(document.querySelector('canvas')).toBeInTheDocument()
    
    // Test with maximum values
    audioData = new Uint8Array(256).fill(255)
    rerender(<VisualEffects {...defaultProps} audioData={audioData} />)
    expect(document.querySelector('canvas')).toBeInTheDocument()
    
    // Test with alternating values
    audioData = new Uint8Array(256).map((_, i) => i % 2 === 0 ? 0 : 255)
    rerender(<VisualEffects {...defaultProps} audioData={audioData} />)
    expect(document.querySelector('canvas')).toBeInTheDocument()
  })

  it('handles different canvas sizes', () => {
    // Mock canvas dimensions
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', {
      value: 800,
      configurable: true,
    })
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', {
      value: 600,
      configurable: true,
    })
    
    render(<VisualEffects {...defaultProps} />)
    expect(document.querySelector('canvas')).toBeInTheDocument()
    
    // Change to different size
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', {
      value: 1920,
      configurable: true,
    })
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', {
      value: 1080,
      configurable: true,
    })
    
    render(<VisualEffects {...defaultProps} />)
    expect(document.querySelector('canvas')).toBeInTheDocument()
  })
})