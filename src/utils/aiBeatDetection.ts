/**
 * AI-Assisted Beat Detection and Synchronization System for v1z3r
 * Advanced real-time beat tracking with machine learning enhancement
 */

import * as tf from '@tensorflow/tfjs';
import { MusicFeatures } from './aiMusicAnalyzer';

export interface BeatDetectionConfig {
  // Detection parameters
  sampleRate: number;
  bufferSize: number;
  hopSize: number;
  
  // Beat tracking parameters
  minTempo: number;
  maxTempo: number;
  adaptiveThreshold: boolean;
  trackingWindow: number;
  
  // AI enhancement
  enableAI: boolean;
  modelPath?: string;
  confidenceThreshold: number;
  
  // Performance settings
  enableRealTimeProcessing: boolean;
  maxLatency: number;
  qualityMode: 'fast' | 'accurate' | 'adaptive';
}

export interface BeatEvent {
  timestamp: number;
  confidence: number;
  strength: number;
  position: number; // Position within measure (0-1)
  tempo: number;
  timeSignature: {
    numerator: number;
    denominator: number;
  };
}

export interface TempoChange {
  timestamp: number;
  oldTempo: number;
  newTempo: number;
  confidence: number;
}

export interface BeatSyncState {
  currentTempo: number;
  lastBeatTime: number;
  nextBeatTime: number;
  beatPhase: number; // 0-1 within beat
  measurePhase: number; // 0-1 within measure
  isStable: boolean;
  confidence: number;
  adaptiveThreshold: number;
}

export interface SyncMetrics {
  accuracy: number;
  latency: number;
  stability: number;
  processingTime: number;
  beatCount: number;
  missedBeats: number;
  falsePositives: number;
}

/**
 * Onset Detection Function (ODF) Calculator
 */
export class OnsetDetectionFunction {
  private windowSize: number;
  private hopSize: number;
  private sampleRate: number;
  private previousSpectrum: Float32Array | null = null;
  private previousPhase: Float32Array | null = null;

  constructor(sampleRate: number, windowSize: number = 1024, hopSize: number = 512) {
    this.sampleRate = sampleRate;
    this.windowSize = windowSize;
    this.hopSize = hopSize;
  }

  /**
   * Calculate spectral flux onset detection function
   */
  calculateSpectralFlux(spectrum: Float32Array): number {
    if (!this.previousSpectrum) {
      this.previousSpectrum = new Float32Array(spectrum.length);
      spectrum.forEach((value, index) => {
        this.previousSpectrum![index] = value;
      });
      return 0;
    }

    let flux = 0;
    for (let i = 0; i < spectrum.length; i++) {
      const diff = spectrum[i] - this.previousSpectrum[i];
      flux += Math.max(0, diff); // Half-wave rectification
    }

    // Update previous spectrum
    spectrum.forEach((value, index) => {
      this.previousSpectrum![index] = value;
    });

    return flux;
  }

  /**
   * Calculate phase deviation onset detection function
   */
  calculatePhaseDeviation(spectrum: Float32Array, phase: Float32Array): number {
    if (!this.previousSpectrum || !this.previousPhase) {
      this.previousSpectrum = new Float32Array(spectrum);
      this.previousPhase = new Float32Array(phase);
      return 0;
    }

    let deviation = 0;
    for (let i = 1; i < spectrum.length - 1; i++) {
      if (spectrum[i] > 0.01) { // Threshold to avoid noise
        const expectedPhase = 2 * this.previousPhase[i] - this.previousPhase[i];
        const actualPhase = phase[i];
        const phaseDiff = this.wrapPhase(actualPhase - expectedPhase);
        deviation += Math.abs(phaseDiff) * spectrum[i];
      }
    }

    // Update previous values
    this.previousSpectrum.set(spectrum);
    this.previousPhase.set(phase);

    return deviation;
  }

  /**
   * Calculate complex domain onset detection function
   */
  calculateComplexDomain(spectrum: Float32Array, phase: Float32Array): number {
    if (!this.previousSpectrum || !this.previousPhase) {
      this.previousSpectrum = new Float32Array(spectrum);
      this.previousPhase = new Float32Array(phase);
      return 0;
    }

    let onset = 0;
    for (let i = 0; i < spectrum.length; i++) {
      const prevReal = this.previousSpectrum[i] * Math.cos(this.previousPhase[i]);
      const prevImag = this.previousSpectrum[i] * Math.sin(this.previousPhase[i]);
      const currReal = spectrum[i] * Math.cos(phase[i]);
      const currImag = spectrum[i] * Math.sin(phase[i]);

      const realDiff = currReal - prevReal;
      const imagDiff = currImag - prevImag;
      const magnitude = Math.sqrt(realDiff * realDiff + imagDiff * imagDiff);

      onset += magnitude;
    }

    // Update previous values
    this.previousSpectrum.set(spectrum);
    this.previousPhase.set(phase);

    return onset;
  }

  /**
   * Wrap phase to [-π, π]
   */
  private wrapPhase(phase: number): number {
    while (phase > Math.PI) phase -= 2 * Math.PI;
    while (phase < -Math.PI) phase += 2 * Math.PI;
    return phase;
  }

  /**
   * Reset internal state
   */
  reset(): void {
    this.previousSpectrum = null;
    this.previousPhase = null;
  }
}

/**
 * Adaptive Peak Picker
 */
export class AdaptivePeakPicker {
  private threshold: number;
  private window: number[];
  private windowSize: number;
  private meanWindow: number[];
  private varianceWindow: number[];
  private alpha: number; // Adaptation rate

  constructor(initialThreshold: number = 0.3, windowSize: number = 5, alpha: number = 0.01) {
    this.threshold = initialThreshold;
    this.windowSize = windowSize;
    this.window = [];
    this.meanWindow = [];
    this.varianceWindow = [];
    this.alpha = alpha;
  }

  /**
   * Detect peaks in onset detection function
   */
  detectPeaks(odf: number, timestamp: number): BeatEvent | null {
    this.window.push(odf);
    if (this.window.length > this.windowSize) {
      this.window.shift();
    }

    if (this.window.length < this.windowSize) {
      return null;
    }

    const centerIndex = Math.floor(this.windowSize / 2);
    const centerValue = this.window[centerIndex];
    const centerTime = timestamp - (this.windowSize - centerIndex - 1) * (1 / 44100); // Assuming 44.1kHz

    // Check if center value is a local maximum
    let isLocalMax = true;
    for (let i = 0; i < this.windowSize; i++) {
      if (i !== centerIndex && this.window[i] >= centerValue) {
        isLocalMax = false;
        break;
      }
    }

    if (!isLocalMax) {
      return null;
    }

    // Update adaptive threshold
    this.updateThreshold(centerValue);

    // Check if peak exceeds threshold
    if (centerValue > this.threshold) {
      return {
        timestamp: centerTime,
        confidence: Math.min(1, centerValue / this.threshold),
        strength: centerValue,
        position: 0, // Will be calculated later
        tempo: 0, // Will be calculated later
        timeSignature: { numerator: 4, denominator: 4 },
      };
    }

    return null;
  }

  /**
   * Update adaptive threshold
   */
  private updateThreshold(currentValue: number): void {
    // Calculate local statistics
    const mean = this.window.reduce((sum, val) => sum + val, 0) / this.window.length;
    const variance = this.window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.window.length;

    this.meanWindow.push(mean);
    this.varianceWindow.push(variance);

    if (this.meanWindow.length > 20) {
      this.meanWindow.shift();
      this.varianceWindow.shift();
    }

    // Calculate adaptive threshold
    const globalMean = this.meanWindow.reduce((sum, val) => sum + val, 0) / this.meanWindow.length;
    const globalVariance = this.varianceWindow.reduce((sum, val) => sum + val, 0) / this.varianceWindow.length;
    const stdDev = Math.sqrt(globalVariance);

    const newThreshold = globalMean + 2 * stdDev;
    this.threshold = this.threshold * (1 - this.alpha) + newThreshold * this.alpha;
  }

  /**
   * Get current threshold
   */
  getThreshold(): number {
    return this.threshold;
  }

  /**
   * Reset state
   */
  reset(): void {
    this.window = [];
    this.meanWindow = [];
    this.varianceWindow = [];
  }
}

/**
 * Tempo Tracker
 */
export class TempoTracker {
  private beatIntervals: number[] = [];
  private maxIntervals: number = 8;
  private minTempo: number;
  private maxTempo: number;
  private currentTempo: number = 120;
  private tempoHistory: number[] = [];
  private confidence: number = 0;

  constructor(minTempo: number = 60, maxTempo: number = 200) {
    this.minTempo = minTempo;
    this.maxTempo = maxTempo;
  }

  /**
   * Update tempo based on beat interval
   */
  updateTempo(beatTimestamp: number): number {
    if (this.beatIntervals.length > 0) {
      const lastBeat = this.beatIntervals[this.beatIntervals.length - 1];
      const interval = beatTimestamp - lastBeat;
      
      // Validate interval
      const tempoFromInterval = 60 / interval;
      if (tempoFromInterval >= this.minTempo && tempoFromInterval <= this.maxTempo) {
        this.beatIntervals.push(beatTimestamp);
        
        if (this.beatIntervals.length > this.maxIntervals) {
          this.beatIntervals.shift();
        }
        
        this.currentTempo = this.calculateTempo();
        this.updateConfidence();
      }
    } else {
      this.beatIntervals.push(beatTimestamp);
    }

    return this.currentTempo;
  }

  /**
   * Calculate tempo from beat intervals
   */
  private calculateTempo(): number {
    if (this.beatIntervals.length < 2) {
      return this.currentTempo;
    }

    const intervals: number[] = [];
    for (let i = 1; i < this.beatIntervals.length; i++) {
      intervals.push(this.beatIntervals[i] - this.beatIntervals[i - 1]);
    }

    // Remove outliers
    intervals.sort((a, b) => a - b);
    const q1 = intervals[Math.floor(intervals.length * 0.25)];
    const q3 = intervals[Math.floor(intervals.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const filteredIntervals = intervals.filter(interval => 
      interval >= lowerBound && interval <= upperBound
    );

    if (filteredIntervals.length === 0) {
      return this.currentTempo;
    }

    // Calculate median interval
    const medianInterval = filteredIntervals[Math.floor(filteredIntervals.length / 2)];
    const tempo = 60 / medianInterval;

    // Smooth tempo changes
    this.tempoHistory.push(tempo);
    if (this.tempoHistory.length > 5) {
      this.tempoHistory.shift();
    }

    return this.tempoHistory.reduce((sum, t) => sum + t, 0) / this.tempoHistory.length;
  }

  /**
   * Update confidence based on tempo stability
   */
  private updateConfidence(): void {
    if (this.tempoHistory.length < 3) {
      this.confidence = 0.5;
      return;
    }

    const variance = this.tempoHistory.reduce((sum, tempo) => {
      const diff = tempo - this.currentTempo;
      return sum + diff * diff;
    }, 0) / this.tempoHistory.length;

    this.confidence = Math.max(0, Math.min(1, 1 - variance / 100));
  }

  /**
   * Get current tempo
   */
  getCurrentTempo(): number {
    return this.currentTempo;
  }

  /**
   * Get tempo confidence
   */
  getConfidence(): number {
    return this.confidence;
  }

  /**
   * Reset tracker
   */
  reset(): void {
    this.beatIntervals = [];
    this.tempoHistory = [];
    this.confidence = 0;
  }
}

/**
 * AI Beat Detection Model
 */
export class AIBeatDetectionModel {
  private model: tf.LayersModel | null = null;
  private isLoaded: boolean = false;
  private featureBuffer: Float32Array[] = [];
  private bufferSize: number = 10;

  constructor() {}

  /**
   * Initialize AI model
   */
  async initialize(modelPath?: string): Promise<void> {
    try {
      if (modelPath) {
        this.model = await tf.loadLayersModel(modelPath);
      } else {
        this.model = await this.createPlaceholderModel();
      }
      
      this.isLoaded = true;
      console.log('[AIBeatDetectionModel] Model loaded successfully');
    } catch (error) {
      console.error('[AIBeatDetectionModel] Failed to load model:', error);
      this.isLoaded = false;
    }
  }

  /**
   * Create placeholder model for development
   */
  private async createPlaceholderModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [this.bufferSize, 50], // 10 frames of 50 features
          units: 128,
          activation: 'relu',
        }),
        tf.layers.lstm({
          units: 64,
          returnSequences: true,
        }),
        tf.layers.lstm({
          units: 32,
          returnSequences: false,
        }),
        tf.layers.dense({
          units: 16,
          activation: 'relu',
        }),
        tf.layers.dense({
          units: 2, // [beat_probability, tempo_adjustment]
          activation: 'sigmoid',
        }),
      ],
    });

    model.compile({
      optimizer: 'adam',
      loss: 'binaryCrossentropy',
      metrics: ['accuracy'],
    });

    return model;
  }

  /**
   * Predict beat probability
   */
  async predict(features: Float32Array): Promise<{ beatProbability: number; tempoAdjustment: number }> {
    if (!this.isLoaded || !this.model) {
      return { beatProbability: 0, tempoAdjustment: 0 };
    }

    // Add features to buffer
    this.featureBuffer.push(features);
    if (this.featureBuffer.length > this.bufferSize) {
      this.featureBuffer.shift();
    }

    if (this.featureBuffer.length < this.bufferSize) {
      return { beatProbability: 0, tempoAdjustment: 0 };
    }

    // Create input tensor
    const inputData = new Float32Array(this.bufferSize * 50);
    for (let i = 0; i < this.bufferSize; i++) {
      const features = this.featureBuffer[i];
      for (let j = 0; j < Math.min(50, features.length); j++) {
        inputData[i * 50 + j] = features[j];
      }
    }

    const inputTensor = tf.tensor3d([inputData], [1, this.bufferSize, 50]);
    
    try {
      const prediction = this.model.predict(inputTensor) as tf.Tensor;
      const result = await prediction.data();
      
      inputTensor.dispose();
      prediction.dispose();
      
      return {
        beatProbability: result[0],
        tempoAdjustment: result[1],
      };
    } catch (error) {
      console.error('[AIBeatDetectionModel] Prediction failed:', error);
      inputTensor.dispose();
      return { beatProbability: 0, tempoAdjustment: 0 };
    }
  }

  /**
   * Check if model is loaded
   */
  isModelLoaded(): boolean {
    return this.isLoaded;
  }

  /**
   * Dispose model
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.isLoaded = false;
    this.featureBuffer = [];
  }
}

/**
 * Main AI Beat Detection System
 */
export class AIBeatDetection {
  private config: BeatDetectionConfig;
  private odfCalculator: OnsetDetectionFunction;
  private peakPicker: AdaptivePeakPicker;
  private tempoTracker: TempoTracker;
  private aiModel: AIBeatDetectionModel;
  private syncState: BeatSyncState;
  private metrics: SyncMetrics;

  // Audio processing
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private frequencyData: Float32Array;
  private timeData: Float32Array;
  private isProcessing: boolean = false;

  // Beat tracking
  private beatEvents: BeatEvent[] = [];
  private lastProcessTime: number = 0;
  private frameCount: number = 0;

  constructor(audioContext: AudioContext, config: Partial<BeatDetectionConfig> = {}) {
    this.audioContext = audioContext;
    this.config = {
      sampleRate: audioContext.sampleRate,
      bufferSize: 2048,
      hopSize: 512,
      minTempo: 60,
      maxTempo: 200,
      adaptiveThreshold: true,
      trackingWindow: 8,
      enableAI: true,
      confidenceThreshold: 0.7,
      enableRealTimeProcessing: true,
      maxLatency: 50,
      qualityMode: 'accurate',
      ...config,
    };

    this.initializeComponents();
    this.initializeAudio();
    this.initializeState();
  }

  /**
   * Initialize components
   */
  private initializeComponents(): void {
    this.odfCalculator = new OnsetDetectionFunction(
      this.config.sampleRate,
      this.config.bufferSize,
      this.config.hopSize
    );

    this.peakPicker = new AdaptivePeakPicker(
      0.3,
      5,
      0.01
    );

    this.tempoTracker = new TempoTracker(
      this.config.minTempo,
      this.config.maxTempo
    );

    if (this.config.enableAI) {
      this.aiModel = new AIBeatDetectionModel();
    }
  }

  /**
   * Initialize audio processing
   */
  private initializeAudio(): void {
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.config.bufferSize;
    this.analyser.smoothingTimeConstant = 0.0;

    this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
    this.timeData = new Float32Array(this.analyser.frequencyBinCount);
  }

  /**
   * Initialize state
   */
  private initializeState(): void {
    this.syncState = {
      currentTempo: 120,
      lastBeatTime: 0,
      nextBeatTime: 0,
      beatPhase: 0,
      measurePhase: 0,
      isStable: false,
      confidence: 0,
      adaptiveThreshold: 0.3,
    };

    this.metrics = {
      accuracy: 0,
      latency: 0,
      stability: 0,
      processingTime: 0,
      beatCount: 0,
      missedBeats: 0,
      falsePositives: 0,
    };
  }

  /**
   * Initialize system
   */
  async initialize(): Promise<void> {
    if (this.config.enableAI) {
      await this.aiModel.initialize(this.config.modelPath);
    }
    console.log('[AIBeatDetection] System initialized');
  }

  /**
   * Connect audio source
   */
  connect(source: AudioNode): void {
    source.connect(this.analyser);
  }

  /**
   * Start beat detection
   */
  start(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.processAudio();
  }

  /**
   * Stop beat detection
   */
  stop(): void {
    this.isProcessing = false;
  }

  /**
   * Main audio processing loop
   */
  private async processAudio(): Promise<void> {
    if (!this.isProcessing) return;

    const startTime = performance.now();

    // Get audio data
    this.analyser.getFloatFrequencyData(this.frequencyData);
    this.analyser.getFloatTimeDomainData(this.timeData);

    // Calculate onset detection function
    const odfValue = this.odfCalculator.calculateSpectralFlux(this.frequencyData);
    
    // Detect peaks
    const peak = this.peakPicker.detectPeaks(odfValue, this.audioContext.currentTime);
    
    if (peak) {
      await this.processBeatEvent(peak);
    }

    // Update sync state
    this.updateSyncState();

    // Update metrics
    this.metrics.processingTime = performance.now() - startTime;
    this.frameCount++;

    // Continue processing
    if (this.config.enableRealTimeProcessing) {
      requestAnimationFrame(() => this.processAudio());
    } else {
      setTimeout(() => this.processAudio(), 1000 / 60); // 60 FPS
    }
  }

  /**
   * Process detected beat event
   */
  private async processBeatEvent(beat: BeatEvent): Promise<void> {
    // AI enhancement if enabled
    if (this.config.enableAI && this.aiModel.isModelLoaded()) {
      const features = this.extractFeatures();
      const aiResult = await this.aiModel.predict(features);
      
      // Adjust beat confidence based on AI prediction
      beat.confidence *= aiResult.beatProbability;
      
      // Apply tempo adjustment
      beat.tempo = this.syncState.currentTempo * (1 + aiResult.tempoAdjustment * 0.1);
    }

    // Filter based on confidence threshold
    if (beat.confidence < this.config.confidenceThreshold) {
      return;
    }

    // Update tempo
    beat.tempo = this.tempoTracker.updateTempo(beat.timestamp);
    
    // Calculate beat position within measure
    if (this.beatEvents.length > 0) {
      const timeSinceLastBeat = beat.timestamp - this.beatEvents[this.beatEvents.length - 1].timestamp;
      const expectedInterval = 60 / beat.tempo;
      beat.position = (timeSinceLastBeat % expectedInterval) / expectedInterval;
    }

    // Add to beat events
    this.beatEvents.push(beat);
    
    // Keep only recent events
    const maxHistory = 100;
    if (this.beatEvents.length > maxHistory) {
      this.beatEvents.shift();
    }

    // Update metrics
    this.metrics.beatCount++;
    this.updateAccuracyMetrics();
  }

  /**
   * Update synchronization state
   */
  private updateSyncState(): void {
    const currentTime = this.audioContext.currentTime;
    
    if (this.beatEvents.length > 0) {
      const lastBeat = this.beatEvents[this.beatEvents.length - 1];
      const tempo = this.tempoTracker.getCurrentTempo();
      const beatInterval = 60 / tempo;
      
      this.syncState.currentTempo = tempo;
      this.syncState.lastBeatTime = lastBeat.timestamp;
      this.syncState.nextBeatTime = lastBeat.timestamp + beatInterval;
      
      // Calculate beat phase (0-1 within beat)
      const timeSinceLastBeat = currentTime - lastBeat.timestamp;
      this.syncState.beatPhase = (timeSinceLastBeat % beatInterval) / beatInterval;
      
      // Calculate measure phase (0-1 within measure, assuming 4/4 time)
      const measureInterval = beatInterval * 4;
      const timeSinceLastMeasure = timeSinceLastBeat % measureInterval;
      this.syncState.measurePhase = timeSinceLastMeasure / measureInterval;
      
      // Update confidence and stability
      this.syncState.confidence = this.tempoTracker.getConfidence();
      this.syncState.isStable = this.syncState.confidence > 0.8;
      this.syncState.adaptiveThreshold = this.peakPicker.getThreshold();
    }
  }

  /**
   * Extract features for AI model
   */
  private extractFeatures(): Float32Array {
    const features = new Float32Array(50);
    
    // Spectral features
    for (let i = 0; i < 20; i++) {
      features[i] = this.frequencyData[i] || 0;
    }
    
    // Temporal features
    for (let i = 0; i < 20; i++) {
      features[20 + i] = this.timeData[i] || 0;
    }
    
    // Beat tracking features
    features[40] = this.syncState.currentTempo / 200; // Normalized tempo
    features[41] = this.syncState.beatPhase;
    features[42] = this.syncState.measurePhase;
    features[43] = this.syncState.confidence;
    features[44] = this.peakPicker.getThreshold();
    
    // Recent beat intervals
    if (this.beatEvents.length >= 2) {
      for (let i = 0; i < Math.min(5, this.beatEvents.length - 1); i++) {
        const interval = this.beatEvents[this.beatEvents.length - 1 - i].timestamp - 
                        this.beatEvents[this.beatEvents.length - 2 - i].timestamp;
        features[45 + i] = interval;
      }
    }
    
    return features;
  }

  /**
   * Update accuracy metrics
   */
  private updateAccuracyMetrics(): void {
    if (this.beatEvents.length < 2) return;

    const recentBeats = this.beatEvents.slice(-10);
    const intervals = [];
    
    for (let i = 1; i < recentBeats.length; i++) {
      intervals.push(recentBeats[i].timestamp - recentBeats[i - 1].timestamp);
    }
    
    if (intervals.length > 0) {
      const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
      
      this.metrics.stability = Math.max(0, 1 - variance / (avgInterval * avgInterval));
      this.metrics.accuracy = this.syncState.confidence;
    }
  }

  /**
   * Get current sync state
   */
  getSyncState(): BeatSyncState {
    return { ...this.syncState };
  }

  /**
   * Get recent beat events
   */
  getRecentBeats(count: number = 10): BeatEvent[] {
    return this.beatEvents.slice(-count);
  }

  /**
   * Get performance metrics
   */
  getMetrics(): SyncMetrics {
    return { ...this.metrics };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<BeatDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update components if needed
    if (newConfig.minTempo !== undefined || newConfig.maxTempo !== undefined) {
      this.tempoTracker = new TempoTracker(this.config.minTempo, this.config.maxTempo);
    }
  }

  /**
   * Reset system
   */
  reset(): void {
    this.odfCalculator.reset();
    this.peakPicker.reset();
    this.tempoTracker.reset();
    this.beatEvents = [];
    this.initializeState();
    this.frameCount = 0;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stop();
    
    if (this.aiModel) {
      this.aiModel.dispose();
    }
    
    this.beatEvents = [];
    this.isProcessing = false;
  }
}

/**
 * Factory function to create AI beat detection system
 */
export async function createAIBeatDetection(
  audioContext: AudioContext,
  config?: Partial<BeatDetectionConfig>
): Promise<AIBeatDetection> {
  const detector = new AIBeatDetection(audioContext, config);
  await detector.initialize();
  return detector;
}