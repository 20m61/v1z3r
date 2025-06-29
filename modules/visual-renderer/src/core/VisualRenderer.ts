/**
 * VisualRenderer - Core rendering engine for VJ Application
 * 
 * This class provides the main interface for visual rendering,
 * managing WebGL context, effects, and performance monitoring.
 * 
 * Following TDD principles: implementing minimal functionality to pass tests.
 */

import { 
  IVisualRenderer, 
  RendererConfig, 
  EffectType, 
  VisualParameters,
  AudioData,
  RenderFrame,
  PerformanceMetrics,
  RendererEvents
} from '../types'
import { EventEmitter } from '../utils/EventEmitter'

export class VisualRenderer extends EventEmitter<RendererEvents> implements IVisualRenderer {
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null
  private canvas: HTMLCanvasElement | null = null
  private config: RendererConfig | null = null
  private initialized = false
  private paused = false
  private contextLost = false
  
  // Frame tracking
  private frameCount = 0
  private lastFrameTime = 0
  private lastFPSTime = 0
  private fpsFrameCount = 0
  private currentFPS = 0
  
  // Current state
  private currentEffect: EffectType = 'spectrum'
  private parameters: VisualParameters = {
    effectType: 'spectrum',
    colorTheme: 'rainbow',
    sensitivity: 1.0,
    speed: 1.0,
    opacity: 1.0,
    blendMode: 'normal',
  }
  
  // Performance tracking
  private performanceMetrics: PerformanceMetrics = {
    fps: 0,
    frameTime: 0,
    cpuTime: 0,
    gpuTime: 0,
    memoryUsage: 0,
    drawCalls: 0,
    triangles: 0,
    timestamp: 0,
  }

  constructor() {
    super()
  }

  async initialize(config: RendererConfig): Promise<void> {
    if (this.initialized) {
      throw new Error('Renderer already initialized')
    }

    if (!config.canvas) {
      throw new Error('Canvas is required')
    }

    this.config = config
    this.canvas = config.canvas

    // Setup WebGL context
    await this.setupWebGLContext()
    
    // Setup event listeners
    this.setupEventListeners()
    
    // Initialize viewport
    this.gl!.viewport(0, 0, config.width, config.height)
    
    this.initialized = true
  }

  private async setupWebGLContext(): Promise<void> {
    const canvas = this.canvas!
    const config = this.config!

    // WebGL context options
    const contextOptions: WebGLContextAttributes = {
      alpha: true,
      depth: true,
      stencil: false,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
    }

    // Try WebGL2 first if enabled
    if (config.enableWebGL2) {
      this.gl = canvas.getContext('webgl2', contextOptions) as WebGL2RenderingContext
    }

    // Fallback to WebGL1
    if (!this.gl) {
      this.gl = canvas.getContext('webgl', contextOptions) || 
                canvas.getContext('experimental-webgl', contextOptions) as WebGLRenderingContext
    }

    if (!this.gl) {
      throw new Error('WebGL not supported')
    }

    // Set initial WebGL state
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0)
    this.gl.enable(this.gl.DEPTH_TEST)
    this.gl.enable(this.gl.BLEND)
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA)
  }

  private setupEventListeners(): void {
    if (!this.canvas) return

    // WebGL context loss/restore
    this.canvas.addEventListener('webglcontextlost', this.handleContextLoss.bind(this))
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestore.bind(this))
  }

  private handleContextLoss(event: Event): void {
    event.preventDefault()
    this.contextLost = true
    this.emit('contextlost', event)
  }

  private handleContextRestore(event: Event): void {
    this.contextLost = false
    // Re-initialize WebGL resources here
    this.emit('contextrestored', event)
  }

  render(audioData?: AudioData): void {
    if (!this.initialized) {
      throw new Error('Renderer not initialized')
    }

    if (this.paused || this.contextLost) {
      return
    }

    const now = performance.now()
    const deltaTime = now - this.lastFrameTime
    this.lastFrameTime = now

    // Update frame count
    this.frameCount++

    // Calculate FPS
    this.updateFPS(now)

    // Create render frame info
    const frame: RenderFrame = {
      timestamp: now,
      deltaTime,
      fps: this.currentFPS,
      frameNumber: this.frameCount,
    }

    // Clear the canvas
    this.gl!.clear(this.gl!.COLOR_BUFFER_BIT | this.gl!.DEPTH_BUFFER_BIT)

    // Render current effect
    this.renderEffect(audioData, frame)

    // Update performance metrics
    this.updatePerformanceMetrics(now)

    // Emit frame event
    this.emit('frame', frame)
  }

  private updateFPS(now: number): void {
    this.fpsFrameCount++
    
    if (now - this.lastFPSTime >= 1000) { // Update every second
      this.currentFPS = (this.fpsFrameCount * 1000) / (now - this.lastFPSTime)
      this.fpsFrameCount = 0
      this.lastFPSTime = now
    }
  }

  private renderEffect(audioData: AudioData | undefined, frame: RenderFrame): void {
    // Basic rendering implementation - will be expanded with actual effects
    // This is minimal implementation to pass tests
    
    // Just clear to a color based on audio data if available
    if (audioData && audioData.volume > 0) {
      const intensity = Math.min(audioData.volume * this.parameters.sensitivity, 1.0)
      this.gl!.clearColor(intensity * 0.2, intensity * 0.3, intensity * 0.5, 1.0)
    } else {
      this.gl!.clearColor(0.0, 0.0, 0.0, 1.0)
    }
  }

  private updatePerformanceMetrics(timestamp: number): void {
    const frameTime = Math.max(timestamp - this.lastFrameTime, 0.01) // Ensure non-zero
    
    this.performanceMetrics = {
      fps: Math.max(this.currentFPS, 1), // Ensure non-zero
      frameTime,
      cpuTime: frameTime, // Simplified for now
      gpuTime: 0, // Will implement GPU timing later
      memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
      drawCalls: 1, // Simplified for now
      triangles: 0, // Will track actual triangle count later
      timestamp,
    }

    if (this.config?.enablePerformanceMonitoring) {
      this.emit('performance', this.performanceMetrics)
    }
  }

  resize(width: number, height: number, pixelRatio = 1): void {
    if (width <= 0) {
      throw new Error('Invalid width')
    }
    if (height <= 0) {
      throw new Error('Invalid height')
    }

    if (!this.canvas || !this.gl) {
      return
    }

    // Update canvas size
    this.canvas.width = width * pixelRatio
    this.canvas.height = height * pixelRatio
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`

    // Update WebGL viewport
    this.gl.viewport(0, 0, width * pixelRatio, height * pixelRatio)

    // Update config
    if (this.config) {
      this.config.width = width
      this.config.height = height
      this.config.pixelRatio = pixelRatio
    }

    this.emit('resize', { width, height })
  }

  updateParameters(parameters: Partial<VisualParameters>): void {
    // Validate parameter ranges
    if (parameters.sensitivity !== undefined) {
      if (parameters.sensitivity < 0) {
        throw new Error('Invalid sensitivity value')
      }
    }

    if (parameters.opacity !== undefined) {
      if (parameters.opacity < 0 || parameters.opacity > 1) {
        throw new Error('Invalid opacity value')
      }
    }

    if (parameters.speed !== undefined) {
      if (parameters.speed < 0) {
        throw new Error('Invalid speed value')
      }
    }

    // Update parameters
    Object.assign(this.parameters, parameters)
  }

  setEffect(effectType: EffectType): void {
    const validEffects: EffectType[] = ['spectrum', 'waveform', 'particles', 'lyrics', 'camera']
    
    if (!validEffects.includes(effectType)) {
      throw new Error('Invalid effect type')
    }

    this.currentEffect = effectType
    this.parameters.effectType = effectType
  }

  loadPreset(preset: any): void {
    // Basic preset loading - will implement full preset system later
    this.setEffect(preset.effectType)
    this.updateParameters(preset.parameters)
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics }
  }

  pause(): void {
    this.paused = true
  }

  resume(): void {
    this.paused = false
    this.lastFrameTime = performance.now() // Reset timing
  }

  captureFrame(): ImageData | null {
    if (!this.canvas || !this.gl) {
      return null
    }

    const width = this.canvas.width
    const height = this.canvas.height
    const pixels = new Uint8Array(width * height * 4)
    
    this.gl.readPixels(0, 0, width, height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels)
    
    // Create canvas for ImageData conversion
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = width
    tempCanvas.height = height
    const ctx = tempCanvas.getContext('2d')!
    
    const imageData = ctx.createImageData(width, height)
    imageData.data.set(pixels)
    
    return imageData
  }

  async destroy(): Promise<void> {
    if (!this.initialized) {
      return
    }

    // Remove event listeners
    if (this.canvas) {
      this.canvas.removeEventListener('webglcontextlost', this.handleContextLoss)
      this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestore)
    }

    // Clean up WebGL resources
    if (this.gl) {
      // Will implement proper resource cleanup later
      this.gl = null
    }

    // Clear references
    this.canvas = null
    this.config = null
    this.initialized = false

    // Remove all event listeners
    this.removeAllListeners()
  }

  // Getter methods for testing
  get isInitialized(): boolean {
    return this.initialized
  }

  getFrameCount(): number {
    return this.frameCount
  }

  getCurrentEffect(): EffectType {
    return this.currentEffect
  }

  getParameters(): VisualParameters {
    return { ...this.parameters }
  }

  isPaused(): boolean {
    return this.paused
  }

  isContextLost(): boolean {
    return this.contextLost
  }

  getContext(): WebGLRenderingContext | WebGL2RenderingContext | null {
    return this.gl
  }
}