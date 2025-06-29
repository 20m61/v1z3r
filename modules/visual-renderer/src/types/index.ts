/**
 * Visual Renderer Module Types
 */

export interface RendererConfig {
  canvas: HTMLCanvasElement
  width: number
  height: number
  pixelRatio: number
  targetFPS: number
  enableWebGL2: boolean
  enableOffscreenCanvas: boolean
  enablePerformanceMonitoring: boolean
}

export interface AudioData {
  frequencies: Float32Array
  waveform: Float32Array
  volume: number
  timestamp: number
  pitch?: number
}

export interface VisualParameters {
  effectType: EffectType
  colorTheme: ColorTheme
  sensitivity: number
  speed: number
  opacity: number
  blendMode: string
  [key: string]: any
}

export type EffectType = 
  | 'spectrum' 
  | 'waveform' 
  | 'particles' 
  | 'lyrics' 
  | 'camera'
  | 'plasma'
  | 'fractal'

export type ColorTheme = 
  | 'rainbow' 
  | 'blue' 
  | 'purple' 
  | 'green' 
  | 'red' 
  | 'custom'

export interface RenderFrame {
  timestamp: number
  deltaTime: number
  fps: number
  frameNumber: number
}

export interface PerformanceMetrics {
  fps: number
  frameTime: number
  cpuTime: number
  gpuTime: number
  memoryUsage: number
  drawCalls: number
  triangles: number
  timestamp: number
}

export interface ShaderProgram {
  program: WebGLProgram
  uniforms: Record<string, WebGLUniformLocation>
  attributes: Record<string, number>
}

export interface RenderTarget {
  framebuffer: WebGLFramebuffer | null
  texture: WebGLTexture
  width: number
  height: number
}

export interface EffectPass {
  name: string
  shader: ShaderProgram
  uniforms: Record<string, any>
  enabled: boolean
  blend: boolean
}

export interface ParticleSystem {
  particles: Particle[]
  maxParticles: number
  emissionRate: number
  lifetime: number
  velocity: Vector3
  acceleration: Vector3
  size: number
  color: Color
}

export interface Particle {
  position: Vector3
  velocity: Vector3
  acceleration: Vector3
  life: number
  maxLife: number
  size: number
  color: Color
  alpha: number
}

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface Vector2 {
  x: number
  y: number
}

export interface Color {
  r: number
  g: number
  b: number
  a?: number
}

export interface Matrix4 {
  elements: Float32Array
}

export interface Camera {
  position: Vector3
  target: Vector3
  up: Vector3
  fov: number
  aspect: number
  near: number
  far: number
  viewMatrix: Matrix4
  projectionMatrix: Matrix4
}

export interface Material {
  shader: ShaderProgram
  uniforms: Record<string, any>
  textures: Map<string, WebGLTexture>
  blending: boolean
  transparent: boolean
}

export interface Geometry {
  vertices: Float32Array
  indices?: Uint16Array | Uint32Array
  normals?: Float32Array
  uvs?: Float32Array
  colors?: Float32Array
  vertexBuffer: WebGLBuffer
  indexBuffer?: WebGLBuffer
  vertexArray?: WebGLVertexArrayObject
}

export interface Mesh {
  geometry: Geometry
  material: Material
  position: Vector3
  rotation: Vector3
  scale: Vector3
  modelMatrix: Matrix4
  visible: boolean
}

export interface LyricsData {
  text: string
  confidence: number
  timestamp: number
  duration: number
  alternatives?: string[]
}

export interface LyricsVisualConfig {
  font: string
  fontSize: number
  color: Color
  strokeColor: Color
  strokeWidth: number
  animationType: 'fade' | 'slide' | 'scale' | 'wave'
  animationDuration: number
  position: Vector2
  maxWidth: number
  lineHeight: number
}

export interface EffectPreset {
  id: string
  name: string
  effectType: EffectType
  parameters: VisualParameters
  shaderConfig?: any
  particleConfig?: Partial<ParticleSystem>
  lyricsConfig?: Partial<LyricsVisualConfig>
}

export type RenderCallback = (frame: RenderFrame) => void
export type PerformanceCallback = (metrics: PerformanceMetrics) => void
export type ErrorCallback = (error: Error) => void

export interface RendererEvents {
  'frame': RenderFrame
  'performance': PerformanceMetrics
  'error': Error
  'resize': { width: number; height: number }
  'contextlost': Event
  'contextrestored': Event
}

export interface IVisualRenderer {
  initialize(config: RendererConfig): Promise<void>
  destroy(): Promise<void>
  render(audioData?: AudioData): void
  resize(width: number, height: number): void
  updateParameters(parameters: Partial<VisualParameters>): void
  setEffect(effectType: EffectType): void
  loadPreset(preset: EffectPreset): void
  getPerformanceMetrics(): PerformanceMetrics
  pause(): void
  resume(): void
  captureFrame(): ImageData | null
  on<K extends keyof RendererEvents>(event: K, callback: (data: RendererEvents[K]) => void): void
  off<K extends keyof RendererEvents>(event: K, callback: (data: RendererEvents[K]) => void): void
}