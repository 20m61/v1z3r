/**
 * Audio processing type definitions
 */

export interface AudioAnalysisData {
  frequencyData: Uint8Array;
  timeData: Uint8Array;
  volume: number;
  beat: boolean;
  bassEnergy: number;
  midEnergy: number;
  highEnergy: number;
  spectralCentroid: number;
  tempo?: number;
}

export interface AudioProcessorConfig {
  fftSize: number;
  smoothingTimeConstant: number;
  beatThreshold: number;
  beatCooldown: number;
}

export interface MicrophoneConfig {
  enabled: boolean;
  gain: number;
  autoGainControl: boolean;
  noiseSuppression: boolean;
  echoCancellation: boolean;
}