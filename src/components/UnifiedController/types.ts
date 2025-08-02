/**
 * Unified Controller Types
 * Central type definitions for the professional VJ controller interface
 */

// Layer Management Types
export interface LayerState {
  id: string;
  name: string;
  active: boolean;
  opacity: number;
  blendMode: BlendMode;
  effects: string[];
  audioReactivity: number;
  locked: boolean;
}

export type BlendMode = 
  | 'normal' 
  | 'add' 
  | 'multiply' 
  | 'screen' 
  | 'overlay' 
  | 'difference'
  | 'exclusion';

// Mixer State
export interface MixerState {
  crossfaderPosition: number; // -1 to 1
  masterIntensity: number; // 0 to 1
  audioGain: number; // 0 to 2
  outputMode: 'single' | 'dual' | 'preview';
}

// Effect Chain Management
export interface EffectChain {
  id: string;
  name: string;
  effects: Effect[];
  bypass: boolean;
  wet: number; // 0 to 1
}

export interface Effect {
  id: string;
  type: string;
  enabled: boolean;
  parameters: Record<string, number>;
  audioLinked: boolean;
  midiMapped?: MidiMapping;
}

// Audio Configuration
export interface AudioConfig {
  enabled: boolean;
  source: 'microphone' | 'system' | 'file';
  sensitivity: number;
  frequencyBands: number;
  smoothing: number;
  beatDetection: boolean;
}

// Preset Management
export interface PresetConfig {
  id: string;
  name: string;
  layers: LayerState[];
  effects: EffectChain[];
  mixer: MixerState;
  audio: AudioConfig;
  bpm?: number;
  tags: string[];
}

// Transition State
export interface TransitionState {
  active: boolean;
  duration: number; // ms
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  progress: number; // 0 to 1
}

// MIDI Mapping
export interface MidiMapping {
  channel: number;
  cc: number;
  range: [number, number];
  curve: 'linear' | 'exponential' | 'logarithmic';
}

// BPM Sync Types
export interface BeatInfo {
  bpm: number;
  confidence: number;
  phase: number;
  nextDownbeat: number;
  barPosition: number;
}

export interface SyncPattern {
  name: string;
  beats: number[];
  loop: boolean;
  actions: SyncAction[];
}

export interface SyncAction {
  type: 'effect-change' | 'preset-switch' | 'parameter-modulation';
  target: string;
  value: any;
  duration?: number;
}

// Performance Modes
export type PerformanceMode = 'quality' | 'balanced' | 'performance';

// Unified Controller State
export interface UnifiedControllerState {
  // Global Controls
  masterIntensity: number;
  crossfader: number;
  
  // Layer Management
  layers: LayerState[];
  activeLayers: string[];
  layerMixer: MixerState;
  
  // Effects
  globalEffects: EffectChain;
  layerEffects: Record<string, EffectChain>;
  
  // Audio
  audioConfig: AudioConfig;
  audioReactivity: number;
  beatInfo?: BeatInfo;
  
  // Performance
  performanceMode: PerformanceMode;
  fps: number;
  gpuLoad: number;
  
  // Presets
  activePreset?: PresetConfig;
  presetTransition?: TransitionState;
  savedPresets: PresetConfig[];
  
  // UI State
  expandedSections: string[];
  lockLayout: boolean;
  showAdvanced: boolean;
  
  // MIDI
  midiEnabled: boolean;
  midiMappings: Record<string, MidiMapping>;
}

// Controller Actions
export interface ControllerActions {
  // Master Controls
  setMasterIntensity: (value: number) => void;
  setCrossfader: (value: number) => void;
  
  // Layer Actions
  addLayer: (layer: Omit<LayerState, 'id'>) => void;
  removeLayer: (layerId: string) => void;
  updateLayer: (layerId: string, updates: Partial<LayerState>) => void;
  setLayerOrder: (layerIds: string[]) => void;
  
  // Effect Actions
  addEffect: (chainId: string, effect: Effect) => void;
  removeEffect: (chainId: string, effectId: string) => void;
  updateEffect: (chainId: string, effectId: string, updates: Partial<Effect>) => void;
  
  // Preset Actions
  loadPreset: (preset: PresetConfig) => void;
  savePreset: (name: string) => void;
  transitionToPreset: (preset: PresetConfig, duration: number) => void;
  
  // Audio Actions
  updateAudioConfig: (config: Partial<AudioConfig>) => void;
  setBeatInfo: (beatInfo: BeatInfo) => void;
  
  // Performance Actions
  setPerformanceMode: (mode: PerformanceMode) => void;
  
  // UI Actions
  toggleSection: (section: string) => void;
  setLockLayout: (locked: boolean) => void;
  setShowAdvanced: (show: boolean) => void;
}

// Component Props Types
export interface UnifiedControllerProps {
  className?: string;
  onStateChange?: (state: UnifiedControllerState) => void;
  initialState?: Partial<UnifiedControllerState>;
  midiEnabled?: boolean;
  showPerformanceMetrics?: boolean;
}

// Hook Return Type
export interface UseUnifiedController {
  state: UnifiedControllerState;
  actions: ControllerActions;
  isTransitioning: boolean;
  performanceMetrics: {
    fps: number;
    gpuLoad: number;
    audioLatency: number;
  };
}