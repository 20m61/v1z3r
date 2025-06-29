/**
 * Shared type definitions for VJ Application modules
 * These types define the contracts between modules for communication
 */

// ====================
// Core Data Types
// ====================

export type EffectType = 
  | 'spectrum' 
  | 'waveform' 
  | 'particles' 
  | 'lyrics' 
  | 'camera'

export type ColorTheme = 
  | 'rainbow' 
  | 'blue' 
  | 'purple' 
  | 'green' 
  | 'red' 
  | 'custom'

export interface AudioData {
  frequencies: Float32Array
  waveform: Float32Array
  timestamp: number
  volume: number
  pitch?: number
}

export interface LayerConfig {
  id: string
  name: string
  effectType: EffectType
  opacity: number
  isVisible: boolean
  blendMode: string
  parameters: Record<string, any>
  order: number
}

export interface VisualPreset {
  id: string
  name: string
  description?: string
  layers: LayerConfig[]
  globalSettings: {
    colorTheme: ColorTheme
    sensitivity: number
    speed: number
  }
  createdAt: string
  updatedAt: string
  tags?: string[]
  isPublic?: boolean
  author?: string
}

// ====================
// Event System Types
// ====================

export interface BaseEvent {
  type: string
  timestamp: number
  source: 'controller' | 'renderer' | 'sync' | 'storage'
  sessionId?: string
}

export interface AudioDataEvent extends BaseEvent {
  type: 'AUDIO_DATA'
  data: AudioData
}

export interface ParameterUpdateEvent extends BaseEvent {
  type: 'PARAMETER_UPDATE'
  layerId?: string
  parameter: string
  value: any
  oldValue?: any
}

export interface LayerUpdateEvent extends BaseEvent {
  type: 'LAYER_UPDATE'
  action: 'create' | 'update' | 'delete' | 'reorder'
  layer: Partial<LayerConfig>
  layerId: string
}

export interface PresetEvent extends BaseEvent {
  type: 'PRESET_LOAD' | 'PRESET_SAVE' | 'PRESET_DELETE'
  preset: VisualPreset
}

export interface VoiceCommandEvent extends BaseEvent {
  type: 'VOICE_COMMAND'
  command: string
  confidence: number
  language: string
  alternatives?: string[]
}

export interface SyncEvent extends BaseEvent {
  type: 'DEVICE_CONNECT' | 'DEVICE_DISCONNECT' | 'SYNC_STATE'
  deviceId: string
  deviceType: 'controller' | 'display'
  state?: any
}

export type VJEvent = 
  | AudioDataEvent 
  | ParameterUpdateEvent 
  | LayerUpdateEvent 
  | PresetEvent 
  | VoiceCommandEvent 
  | SyncEvent

// ====================
// Module Interface Types
// ====================

export interface VisualRendererConfig {
  canvas: HTMLCanvasElement
  width: number
  height: number
  pixelRatio: number
  targetFPS: number
  enableWebGL2: boolean
  enableOffscreenCanvas: boolean
}

export interface ControllerConfig {
  enableVoiceRecognition: boolean
  enableMIDI: boolean
  touchOptimized: boolean
  theme: 'dark' | 'light'
  language: string
}

export interface SyncConfig {
  websocketUrl: string
  reconnectInterval: number
  heartbeatInterval: number
  maxReconnectAttempts: number
  enableEncryption: boolean
}

export interface StorageConfig {
  enableCloudSync: boolean
  enableLocalStorage: boolean
  maxPresets: number
  maxHistoryItems: number
  compressionEnabled: boolean
}

// ====================
// API Response Types
// ====================

export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  timestamp: string
}

export interface PresetListResponse {
  presets: VisualPreset[]
  total: number
  page: number
  hasMore: boolean
}

export interface SessionInfo {
  sessionId: string
  devices: Array<{
    deviceId: string
    deviceType: 'controller' | 'display'
    connected: boolean
    lastSeen: string
  }>
  createdAt: string
  lastActivity: string
}

// ====================
// Performance Types
// ====================

export interface PerformanceMetrics {
  fps: number
  frameTime: number
  memoryUsage: number
  audioLatency: number
  renderLatency: number
  timestamp: number
}

export interface QualitySettings {
  renderQuality: 'low' | 'medium' | 'high' | 'ultra'
  enableEffects: boolean
  enableMotionBlur: boolean
  enableAntiAliasing: boolean
  maxParticles: number
}

// ====================
// WebSocket Message Types
// ====================

export interface WSMessage {
  id: string
  type: string
  payload: any
  timestamp: number
  sender: string
}

export interface WSConnectMessage extends WSMessage {
  type: 'CONNECT'
  payload: {
    deviceType: 'controller' | 'display'
    capabilities: string[]
    version: string
  }
}

export interface WSEventMessage extends WSMessage {
  type: 'EVENT'
  payload: VJEvent
}

export interface WSHeartbeatMessage extends WSMessage {
  type: 'HEARTBEAT'
  payload: {
    status: 'alive'
    metrics?: PerformanceMetrics
  }
}

export type WSMessageType = WSConnectMessage | WSEventMessage | WSHeartbeatMessage

// ====================
// Error Types
// ====================

export interface VJError {
  code: string
  message: string
  module: 'renderer' | 'controller' | 'sync' | 'storage'
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: string
  details?: any
  stack?: string
}

// ====================
// Utility Types
// ====================

export type EventHandler<T extends VJEvent = VJEvent> = (event: T) => void | Promise<void>

export type Unsubscribe = () => void

export interface ModuleInterface {
  initialize(config: any): Promise<void>
  destroy(): Promise<void>
  addEventListener<T extends VJEvent>(type: string, handler: EventHandler<T>): Unsubscribe
  removeEventListener(type: string, handler: EventHandler): void
  emit(event: VJEvent): void
  getState(): any
  setState(state: any): void
}