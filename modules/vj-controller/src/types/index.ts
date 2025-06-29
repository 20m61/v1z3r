/**
 * VJ Controller Module Types
 */

export interface ControllerConfig {
  enableVoiceRecognition: boolean
  enableMIDI: boolean
  touchOptimized: boolean
  theme: 'dark' | 'light'
  language: string
}

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

export interface UIState {
  activeTab: string
  isCollapsed: boolean
  showPresetModal: boolean
  isMicrophoneEnabled: boolean
  isFullscreen: boolean
  isCameraEnabled: boolean
}

export interface VoiceCommand {
  command: string
  confidence: number
  timestamp: number
  alternatives?: string[]
  processed: boolean
}

export interface AudioPermissionState {
  granted: boolean
  denied: boolean
  prompt: boolean
  checking: boolean
  error?: string
}

export interface DeviceCapabilities {
  speech: boolean
  microphone: boolean
  midi: boolean
  camera: boolean
  touch: boolean
  fullscreen: boolean
}

export interface ControlPanelProps {
  className?: string
  onParameterChange?: (parameter: string, value: any) => void
  onPresetLoad?: (preset: VisualPreset) => void
  onPresetSave?: (preset: Partial<VisualPreset>) => void
  onLayerUpdate?: (layerId: string, updates: Partial<LayerConfig>) => void
}

export interface TabConfig {
  id: string
  label: string
  icon: React.ReactNode
  content: React.ReactNode
  disabled?: boolean
}

export interface PermissionStatus {
  microphone: AudioPermissionState
  camera: AudioPermissionState
  notifications: AudioPermissionState
}

export interface LayerManagerProps {
  layers: LayerConfig[]
  activeLayerId?: string
  onLayerSelect?: (layerId: string) => void
  onLayerUpdate?: (layerId: string, updates: Partial<LayerConfig>) => void
  onLayerAdd?: () => void
  onLayerRemove?: (layerId: string) => void
  onLayerReorder?: (sourceId: string, targetId: string) => void
}

export interface LyricsControlProps {
  isRecognitionActive: boolean
  language: string
  fontSize: number
  fontFamily: string
  color: string
  animationType: string
  onToggleRecognition: () => void
  onLanguageChange: (language: string) => void
  onFontSizeChange: (size: number) => void
  onFontFamilyChange: (family: string) => void
  onColorChange: (color: string) => void
  onAnimationTypeChange: (type: string) => void
}

export interface PresetManagerProps {
  presets: VisualPreset[]
  selectedPresetId?: string
  onPresetLoad: (preset: VisualPreset) => void
  onPresetSave: (preset: Partial<VisualPreset>) => void
  onPresetDelete: (presetId: string) => void
  onPresetDuplicate: (preset: VisualPreset) => void
  onPresetShare: (preset: VisualPreset) => void
}

export interface EffectControlsProps {
  effectType: EffectType
  parameters: Record<string, any>
  onParameterChange: (parameter: string, value: any) => void
  onEffectTypeChange: (effectType: EffectType) => void
}

// Event types for inter-module communication
export interface ControllerEvent {
  type: string
  timestamp: number
  source: 'controller'
  data: any
}

export interface ParameterUpdateEvent extends ControllerEvent {
  type: 'PARAMETER_UPDATE'
  data: {
    layerId?: string
    parameter: string
    value: any
    oldValue?: any
  }
}

export interface LayerUpdateEvent extends ControllerEvent {
  type: 'LAYER_UPDATE'
  data: {
    action: 'create' | 'update' | 'delete' | 'reorder'
    layer: Partial<LayerConfig>
    layerId: string
  }
}

export interface VoiceCommandEvent extends ControllerEvent {
  type: 'VOICE_COMMAND'
  data: VoiceCommand
}

export interface PresetEvent extends ControllerEvent {
  type: 'PRESET_LOAD' | 'PRESET_SAVE' | 'PRESET_DELETE'
  data: {
    preset: VisualPreset
    action?: string
  }
}

export type ControllerEventType = 
  | ParameterUpdateEvent 
  | LayerUpdateEvent 
  | VoiceCommandEvent 
  | PresetEvent

// Store interfaces
export interface ControllerStore {
  // UI State
  ui: UIState
  setActiveTab: (tab: string) => void
  toggleCollapse: () => void
  setShowPresetModal: (show: boolean) => void
  
  // Device state
  capabilities: DeviceCapabilities
  permissions: PermissionStatus
  setMicrophoneEnabled: (enabled: boolean) => void
  setFullscreen: (enabled: boolean) => void
  setCameraEnabled: (enabled: boolean) => void
  
  // Layer management
  layers: LayerConfig[]
  activeLayerId?: string
  addLayer: (layer: Partial<LayerConfig>) => void
  updateLayer: (layerId: string, updates: Partial<LayerConfig>) => void
  removeLayer: (layerId: string) => void
  reorderLayers: (sourceId: string, targetId: string) => void
  setActiveLayer: (layerId: string) => void
  
  // Preset management
  presets: VisualPreset[]
  selectedPresetId?: string
  loadPreset: (preset: VisualPreset) => void
  savePreset: (preset: Partial<VisualPreset>) => Promise<void>
  deletePreset: (presetId: string) => void
  duplicatePreset: (preset: VisualPreset) => void
  
  // Voice recognition
  voiceCommands: VoiceCommand[]
  isVoiceRecognitionActive: boolean
  voiceLanguage: string
  toggleVoiceRecognition: () => void
  setVoiceLanguage: (language: string) => void
  addVoiceCommand: (command: VoiceCommand) => void
  
  // Global parameters
  globalParameters: {
    sensitivity: number
    speed: number
    colorTheme: ColorTheme
    effectType: EffectType
    masterOpacity: number
  }
  updateGlobalParameter: (parameter: string, value: any) => void
  
  // Event emission
  emitEvent: (event: ControllerEventType) => void
}

export interface IControllerModule {
  initialize(config: ControllerConfig): Promise<void>
  destroy(): Promise<void>
  getStore(): ControllerStore
  render(): React.ReactElement
  addEventListener(type: string, handler: (event: ControllerEventType) => void): void
  removeEventListener(type: string, handler: (event: ControllerEventType) => void): void
  emit(event: ControllerEventType): void
}