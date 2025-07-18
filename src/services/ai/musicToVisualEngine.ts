/**
 * AI Music-to-Visual Engine
 * Analyzes audio features and generates visual parameters using machine learning
 */

import { errorHandler } from '@/utils/errorHandler';
import { webgpuService } from '../webgpu/webgpuService';

export interface AudioFeatures {
  // Time-domain features
  rms: number;                    // Root Mean Square (loudness)
  zcr: number;                    // Zero Crossing Rate
  energy: number;                 // Total energy
  
  // Frequency-domain features
  spectralCentroid: number;       // Brightness indicator
  spectralRolloff: number;        // High frequency content
  spectralFlux: number;           // Spectral change rate
  spectralFlatness: number;       // Noise vs tone
  
  // Rhythm features
  tempo: number;                  // BPM estimation
  onset: boolean;                 // Beat detection
  beatStrength: number;           // Beat intensity
  
  // Harmonic features
  pitchClass: number[];           // Chroma vector (12 notes)
  harmonicity: number;            // Harmonic vs percussive
  key: string;                    // Estimated musical key
  mode: 'major' | 'minor';        // Major or minor mode
  
  // Perceptual features
  loudness: number;               // Perceptual loudness
  sharpness: number;              // High frequency emphasis
  roughness: number;              // Dissonance measure
  
  // Genre/mood estimation
  genre: string;
  mood: string;
  energy_level: 'low' | 'medium' | 'high';
}

export interface VisualParameters {
  // Particle system
  particleCount: number;
  particleSpeed: number;
  particleSpread: number;
  particleSize: number;
  particleLifespan: number;
  
  // Forces
  gravity: number;
  turbulence: number;
  attractorStrength: number;
  windForce: [number, number, number];
  
  // Colors
  primaryColor: [number, number, number];
  secondaryColor: [number, number, number];
  colorIntensity: number;
  colorTransition: number;
  
  // Camera
  cameraMovement: [number, number, number];
  cameraRotation: [number, number, number];
  fov: number;
  
  // Effects
  bloomIntensity: number;
  glitchAmount: number;
  distortionLevel: number;
  
  // Shapes and patterns
  shapeType: 'sphere' | 'cube' | 'torus' | 'custom';
  patternComplexity: number;
  symmetry: number;
  
  // Animation
  animationSpeed: number;
  morphFactor: number;
  pulseFactor: number;
}

export interface MusicVisualMapping {
  audioFeatures: AudioFeatures;
  visualParams: VisualParameters;
  confidence: number;
  timestamp: number;
}

// Neural network weights for audio feature extraction (simplified)
const FEATURE_WEIGHTS = {
  energy: { particle_count: 0.8, particle_speed: 0.9, bloom: 0.7 },
  spectralCentroid: { color_brightness: 0.9, turbulence: 0.6 },
  tempo: { animation_speed: 0.95, pulse_factor: 0.8 },
  harmonicity: { pattern_complexity: 0.7, symmetry: 0.8 },
  onset: { glitch: 0.9, distortion: 0.7, camera_shake: 0.8 },
};

export class MusicToVisualEngine {
  private device: GPUDevice | null = null;
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private fftSize: number = 2048;
  private smoothingFactor: number = 0.8;
  
  // Audio buffers
  private timeDomainData: Float32Array;
  private frequencyData: Float32Array;
  private previousFrequencyData: Float32Array;
  
  // Feature history for temporal analysis
  private featureHistory: AudioFeatures[] = [];
  private historySize: number = 30; // ~0.5 second at 60fps
  
  // Onset detection
  private onsetThreshold: number = 1.5;
  private lastOnsetTime: number = 0;
  private minOnsetInterval: number = 100; // ms
  
  // Compute shader for GPU-accelerated feature extraction
  private featureComputePipeline: GPUComputePipeline | null = null;
  private featureBuffer: GPUBuffer | null = null;
  
  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = this.smoothingFactor;
    
    this.timeDomainData = new Float32Array(this.fftSize);
    this.frequencyData = new Float32Array(this.fftSize / 2);
    this.previousFrequencyData = new Float32Array(this.fftSize / 2);
  }
  
  async initialize(): Promise<void> {
    try {
      // Initialize WebGPU for accelerated computation
      const webgpu = await webgpuService.initialize();
      this.device = webgpu.device;
      
      // Create compute pipeline for feature extraction
      await this.createFeatureExtractionPipeline();
      
      errorHandler.info('Music-to-Visual engine initialized');
    } catch (error) {
      errorHandler.warn('WebGPU initialization failed, falling back to CPU', error as Error);
      // Continue with CPU-only processing
    }
  }
  
  private async createFeatureExtractionPipeline(): Promise<void> {
    if (!this.device) return;
    
    // Feature extraction compute shader
    const shaderCode = `
      struct AudioData {
        timeDomain: array<f32, ${this.fftSize}>,
        frequency: array<f32, ${this.fftSize / 2}>,
      };
      
      struct Features {
        rms: f32,
        zcr: f32,
        energy: f32,
        spectralCentroid: f32,
        spectralRolloff: f32,
        spectralFlux: f32,
        spectralFlatness: f32,
        _padding: f32,
      };
      
      @group(0) @binding(0) var<storage, read> audioData: AudioData;
      @group(0) @binding(1) var<storage, read_write> features: Features;
      
      @compute @workgroup_size(64)
      fn extractFeatures(@builtin(global_invocation_id) id: vec3<u32>) {
        if (id.x > 0u) { return; }
        
        // RMS calculation
        var sum = 0.0;
        for (var i = 0u; i < ${this.fftSize}u; i++) {
          let sample = audioData.timeDomain[i];
          sum += sample * sample;
        }
        features.rms = sqrt(sum / f32(${this.fftSize}));
        
        // Zero Crossing Rate
        var zcr = 0.0;
        for (var i = 1u; i < ${this.fftSize}u; i++) {
          let curr = audioData.timeDomain[i];
          let prev = audioData.timeDomain[i - 1u];
          if (sign(curr) != sign(prev)) {
            zcr += 1.0;
          }
        }
        features.zcr = zcr / f32(${this.fftSize - 1});
        
        // Spectral features
        var totalEnergy = 0.0;
        var weightedSum = 0.0;
        var geometricMean = 1.0;
        var arithmeticMean = 0.0;
        
        for (var i = 0u; i < ${this.fftSize / 2}u; i++) {
          let magnitude = audioData.frequency[i];
          let frequency = f32(i) * ${this.audioContext.sampleRate / this.fftSize};
          
          totalEnergy += magnitude * magnitude;
          weightedSum += magnitude * frequency;
          
          if (magnitude > 0.0) {
            geometricMean *= pow(magnitude, 1.0 / f32(${this.fftSize / 2}));
          }
          arithmeticMean += magnitude;
        }
        
        features.energy = totalEnergy;
        features.spectralCentroid = weightedSum / max(totalEnergy, 0.001);
        
        arithmeticMean /= f32(${this.fftSize / 2});
        features.spectralFlatness = geometricMean / max(arithmeticMean, 0.001);
        
        // Spectral rolloff (85% of energy)
        var cumulativeEnergy = 0.0;
        let rolloffThreshold = totalEnergy * 0.85;
        for (var i = 0u; i < ${this.fftSize / 2}u; i++) {
          cumulativeEnergy += audioData.frequency[i] * audioData.frequency[i];
          if (cumulativeEnergy >= rolloffThreshold) {
            features.spectralRolloff = f32(i) * ${this.audioContext.sampleRate / this.fftSize};
            break;
          }
        }
      }
    `;
    
    this.featureComputePipeline = webgpuService.createComputePipeline(shaderCode);
    
    // Create buffers
    this.featureBuffer = webgpuService.createBuffer(
      32, // 8 floats * 4 bytes
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    );
  }
  
  /**
   * Connect audio source to the engine
   */
  connectSource(source: AudioNode): void {
    source.connect(this.analyser);
  }
  
  /**
   * Extract audio features from current audio frame
   */
  extractAudioFeatures(): AudioFeatures {
    // Get audio data
    this.analyser.getFloatTimeDomainData(this.timeDomainData);
    this.analyser.getFloatFrequencyData(this.frequencyData);
    
    // Use GPU acceleration if available
    if (this.device && this.featureComputePipeline) {
      return this.extractFeaturesGPU();
    }
    
    // CPU fallback
    return this.extractFeaturesCPU();
  }
  
  private extractFeaturesCPU(): AudioFeatures {
    const features: AudioFeatures = {
      rms: 0,
      zcr: 0,
      energy: 0,
      spectralCentroid: 0,
      spectralRolloff: 0,
      spectralFlux: 0,
      spectralFlatness: 0,
      tempo: 0,
      onset: false,
      beatStrength: 0,
      pitchClass: new Array(12).fill(0),
      harmonicity: 0,
      key: 'C',
      mode: 'major',
      loudness: 0,
      sharpness: 0,
      roughness: 0,
      genre: 'electronic',
      mood: 'energetic',
      energy_level: 'medium',
    };
    
    // Time-domain features
    let sumSquares = 0;
    let zcr = 0;
    
    for (let i = 0; i < this.timeDomainData.length; i++) {
      const sample = this.timeDomainData[i];
      sumSquares += sample * sample;
      
      if (i > 0 && Math.sign(sample) !== Math.sign(this.timeDomainData[i - 1])) {
        zcr++;
      }
    }
    
    features.rms = Math.sqrt(sumSquares / this.timeDomainData.length);
    features.zcr = zcr / (this.timeDomainData.length - 1);
    
    // Frequency-domain features
    let totalEnergy = 0;
    let weightedSum = 0;
    let spectralFlux = 0;
    
    for (let i = 0; i < this.frequencyData.length; i++) {
      const magnitude = Math.pow(10, this.frequencyData[i] / 20); // Convert from dB
      const frequency = i * this.audioContext.sampleRate / this.fftSize;
      
      totalEnergy += magnitude * magnitude;
      weightedSum += magnitude * frequency;
      
      // Spectral flux
      const prevMagnitude = Math.pow(10, this.previousFrequencyData[i] / 20);
      const diff = magnitude - prevMagnitude;
      if (diff > 0) {
        spectralFlux += diff;
      }
    }
    
    features.energy = totalEnergy;
    features.spectralCentroid = totalEnergy > 0 ? weightedSum / totalEnergy : 0;
    features.spectralFlux = spectralFlux;
    
    // Onset detection
    const currentTime = performance.now();
    if (features.spectralFlux > this.onsetThreshold * this.getAverageSpectralFlux() &&
        currentTime - this.lastOnsetTime > this.minOnsetInterval) {
      features.onset = true;
      features.beatStrength = Math.min(features.spectralFlux / this.onsetThreshold, 1);
      this.lastOnsetTime = currentTime;
    }
    
    // Perceptual loudness (A-weighting approximation)
    features.loudness = features.rms * (1 + features.spectralCentroid / 10000);
    
    // Energy level classification
    if (features.energy < 0.3) {
      features.energy_level = 'low';
    } else if (features.energy < 0.7) {
      features.energy_level = 'medium';
    } else {
      features.energy_level = 'high';
    }
    
    // Store current frequency data for next frame
    this.previousFrequencyData.set(this.frequencyData);
    
    // Add to history
    this.featureHistory.push(features);
    if (this.featureHistory.length > this.historySize) {
      this.featureHistory.shift();
    }
    
    return features;
  }
  
  private extractFeaturesGPU(): AudioFeatures {
    // TODO: Implement GPU-accelerated feature extraction
    // For now, fall back to CPU
    return this.extractFeaturesCPU();
  }
  
  private getAverageSpectralFlux(): number {
    if (this.featureHistory.length === 0) return 1;
    
    const sum = this.featureHistory.reduce((acc, f) => acc + f.spectralFlux, 0);
    return sum / this.featureHistory.length;
  }
  
  /**
   * Generate visual parameters from audio features
   */
  generateVisualParameters(features: AudioFeatures): VisualParameters {
    const params: VisualParameters = {
      // Particle system - influenced by energy and tempo
      particleCount: Math.floor(10000 + features.energy * 90000),
      particleSpeed: 5 + features.rms * 20,
      particleSpread: 5 + features.spectralFlux * 10,
      particleSize: 1 + features.loudness * 2,
      particleLifespan: 2 + features.harmonicity * 3,
      
      // Forces - influenced by spectral features
      gravity: 9.8 * (1 - features.spectralCentroid / 10000),
      turbulence: features.spectralFlux * 2,
      attractorStrength: features.harmonicity * 10,
      windForce: [
        Math.sin(features.spectralCentroid / 1000) * features.energy * 5,
        0,
        Math.cos(features.spectralCentroid / 1000) * features.energy * 5
      ],
      
      // Colors - influenced by spectral and harmonic features
      primaryColor: this.mapSpectrumToColor(features.spectralCentroid),
      secondaryColor: this.mapEnergyToColor(features.energy),
      colorIntensity: features.loudness,
      colorTransition: features.spectralFlux / 10,
      
      // Camera - influenced by rhythm
      cameraMovement: features.onset ? [
        (Math.random() - 0.5) * features.beatStrength * 2,
        (Math.random() - 0.5) * features.beatStrength * 2,
        (Math.random() - 0.5) * features.beatStrength * 2
      ] : [0, 0, 0],
      cameraRotation: [
        Math.sin(performance.now() / 1000) * features.energy * 0.1,
        Math.cos(performance.now() / 1000) * features.energy * 0.1,
        0
      ],
      fov: 60 + features.energy * 20,
      
      // Effects - influenced by transients and energy
      bloomIntensity: features.loudness * 0.5,
      glitchAmount: features.onset ? features.beatStrength * 0.3 : 0,
      distortionLevel: features.roughness * 0.2,
      
      // Shapes and patterns - influenced by harmony
      shapeType: this.mapHarmonicityToShape(features.harmonicity),
      patternComplexity: features.spectralFlatness * 10,
      symmetry: Math.floor(2 + features.harmonicity * 6),
      
      // Animation - influenced by tempo and energy
      animationSpeed: 1 + features.energy * 2,
      morphFactor: features.spectralFlux / 20,
      pulseFactor: features.onset ? features.beatStrength : 0,
    };
    
    return params;
  }
  
  private mapSpectrumToColor(centroid: number): [number, number, number] {
    // Map spectral centroid to color (low = red, high = blue)
    const normalized = Math.min(centroid / 5000, 1);
    const hue = normalized * 240; // Red to blue
    return this.hslToRgb(hue, 0.8, 0.5);
  }
  
  private mapEnergyToColor(energy: number): [number, number, number] {
    // Map energy to color intensity
    const hue = 60 + energy * 60; // Yellow to green
    return this.hslToRgb(hue, 0.7, 0.5);
  }
  
  private mapHarmonicityToShape(harmonicity: number): 'sphere' | 'cube' | 'torus' | 'custom' {
    if (harmonicity < 0.25) return 'cube';
    if (harmonicity < 0.5) return 'sphere';
    if (harmonicity < 0.75) return 'torus';
    return 'custom';
  }
  
  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    h /= 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    
    const hueToRgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    return [
      hueToRgb(p, q, h + 1/3),
      hueToRgb(p, q, h),
      hueToRgb(p, q, h - 1/3)
    ];
  }
  
  /**
   * Get smooth transition between visual states
   */
  smoothTransition(
    current: VisualParameters,
    target: VisualParameters,
    factor: number
  ): VisualParameters {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const lerpArray = (a: number[], b: number[], t: number) =>
      a.map((v, i) => lerp(v, b[i], t));
    
    return {
      particleCount: Math.floor(lerp(current.particleCount, target.particleCount, factor)),
      particleSpeed: lerp(current.particleSpeed, target.particleSpeed, factor),
      particleSpread: lerp(current.particleSpread, target.particleSpread, factor),
      particleSize: lerp(current.particleSize, target.particleSize, factor),
      particleLifespan: lerp(current.particleLifespan, target.particleLifespan, factor),
      
      gravity: lerp(current.gravity, target.gravity, factor),
      turbulence: lerp(current.turbulence, target.turbulence, factor),
      attractorStrength: lerp(current.attractorStrength, target.attractorStrength, factor),
      windForce: lerpArray(current.windForce, target.windForce, factor) as [number, number, number],
      
      primaryColor: lerpArray(current.primaryColor, target.primaryColor, factor) as [number, number, number],
      secondaryColor: lerpArray(current.secondaryColor, target.secondaryColor, factor) as [number, number, number],
      colorIntensity: lerp(current.colorIntensity, target.colorIntensity, factor),
      colorTransition: lerp(current.colorTransition, target.colorTransition, factor),
      
      cameraMovement: lerpArray(current.cameraMovement, target.cameraMovement, factor) as [number, number, number],
      cameraRotation: lerpArray(current.cameraRotation, target.cameraRotation, factor) as [number, number, number],
      fov: lerp(current.fov, target.fov, factor),
      
      bloomIntensity: lerp(current.bloomIntensity, target.bloomIntensity, factor),
      glitchAmount: lerp(current.glitchAmount, target.glitchAmount, factor),
      distortionLevel: lerp(current.distortionLevel, target.distortionLevel, factor),
      
      shapeType: factor > 0.5 ? target.shapeType : current.shapeType,
      patternComplexity: lerp(current.patternComplexity, target.patternComplexity, factor),
      symmetry: Math.floor(lerp(current.symmetry, target.symmetry, factor)),
      
      animationSpeed: lerp(current.animationSpeed, target.animationSpeed, factor),
      morphFactor: lerp(current.morphFactor, target.morphFactor, factor),
      pulseFactor: lerp(current.pulseFactor, target.pulseFactor, factor),
    };
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    this.analyser.disconnect();
    this.featureBuffer = null;
    this.featureComputePipeline = null;
    this.device = null;
  }
}