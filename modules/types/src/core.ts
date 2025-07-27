/**
 * Core type definitions for v1z3r VJ application
 */

export type EffectType = 'waveform' | 'particles' | 'spectrum' | 'lyrics' | 'camera';
export type FontType = 'teko' | 'prompt' | 'audiowide' | 'russo' | 'orbitron' | 'futuristic' | 'classic' | 'handwritten' | 'bold' | 'elegant';
export type AnimationType = 'glow' | 'pulse' | 'bounce' | 'fade' | 'none' | 'slide' | 'scale' | 'rotate';

export interface LyricsLineType {
  id: string;
  text: string;
  timestamp: number;
  duration?: number;
  confidence?: number;
}

export interface LayerType {
  id: string;
  type: EffectType;
  active: boolean;
  opacity: number;
  colorTheme: string;
  sensitivity: number;
  zIndex: number;
}

export interface MIDIControllerMapping {
  id: string;
  name: string;
  type: 'note' | 'cc' | 'pitch_bend';
  midiChannel: number;
  midiNumber: number;
  targetParameter: string;
  minValue: number;
  maxValue: number;
  curve: 'linear' | 'exponential' | 'logarithmic';
  enabled: boolean;
}

export interface PresetType {
  id: string;
  name: string;
  effectType: EffectType;
  colorTheme: string;
  sensitivity: number;
  layers: LayerType[];
  midiChannel?: number;
  midiMappings?: MIDIControllerMapping[];
}

export interface MIDIMessage {
  type: number;
  channel: number;
  data1: number;
  data2: number;
  timestamp: number;
}