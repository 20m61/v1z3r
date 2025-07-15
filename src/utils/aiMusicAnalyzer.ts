/**
 * AI-Powered Music Analysis Engine for v1z3r
 * Real-time music understanding and visual parameter generation
 */

import * as tf from '@tensorflow/tfjs';

export interface MusicFeatures {
  // Temporal features
  tempo: number;
  beatTimes: number[];
  beatStrength: number[];
  onsetTimes: number[];
  
  // Spectral features
  spectralCentroid: number;
  spectralRolloff: number;
  spectralBandwidth: number;
  spectralFlatness: number;
  mfcc: Float32Array; // Mel-frequency cepstral coefficients
  
  // Harmonic features
  chromaticFeatures: Float32Array; // 12-bin chroma vector
  key: string;
  mode: 'major' | 'minor';
  
  // Rhythmic features
  rhythmPattern: Float32Array;
  syncopation: number;
  rhythmComplexity: number;
  
  // Emotional features
  energy: number;
  valence: number; // Musical positiveness
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  loudness: number;
}

export interface VisualParameters {
  // Color parameters
  hue: number; // 0-360
  saturation: number; // 0-1
  brightness: number; // 0-1
  colorTemperature: number; // warm/cool
  
  // Motion parameters
  speed: number; // 0-2
  intensity: number; // 0-1
  complexity: number; // 0-1
  smoothness: number; // 0-1
  
  // Effect parameters
  particleDensity: number; // 0-1
  particleSize: number; // 0-1
  waveAmplitude: number; // 0-1
  geometryComplexity: number; // 0-1
  
  // Style parameters
  visualStyle: 'minimal' | 'organic' | 'geometric' | 'abstract' | 'retro';
  effectType: 'particles' | 'waves' | 'geometry' | 'fluid' | 'fractals';
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'difference';
  
  // Temporal parameters
  transitionSpeed: number; // 0-1
  synchronization: number; // 0-1 (beat sync strength)
  anticipation: number; // 0-1 (build-up detection)
}

export interface MusicContext {
  currentTime: number;
  duration: number;
  segment: AudioSegment;
  recentHistory: MusicFeatures[];
  predictions: VisualParameters[];
}

export interface AudioSegment {
  start: number;
  duration: number;
  confidence: number;
  features: MusicFeatures;
  visualParams: VisualParameters;
}

/**
 * Real-time Audio Analysis Pipeline
 */
export class AudioProcessor {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private frequencyData: Uint8Array;
  private timeData: Uint8Array;
  private sampleRate: number;
  private bufferSize: number = 2048;
  
  // Feature extraction parameters
  private windowSize: number = 2048;
  private hopSize: number = 512;
  private melFilterBanks: number = 128;
  private mfccCoefficients: number = 13;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.sampleRate = audioContext.sampleRate;
    
    // Create analyser node
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = this.bufferSize;
    this.analyser.smoothingTimeConstant = 0.0; // No smoothing for raw data
    
    // Initialize data arrays
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.frequencyBinCount);
  }

  /**
   * Connect audio source to processor
   */
  connect(source: AudioNode): void {
    source.connect(this.analyser);
  }

  /**
   * Extract comprehensive music features from current audio buffer
   */
  extractFeatures(): MusicFeatures {
    // Get current audio data
    this.analyser.getByteFrequencyData(this.frequencyData);
    this.analyser.getByteTimeDomainData(this.timeData);
    
    // Convert to float arrays for processing
    const frequencyFloat = new Float32Array(this.frequencyData.length);
    const timeFloat = new Float32Array(this.timeData.length);
    
    for (let i = 0; i < this.frequencyData.length; i++) {
      frequencyFloat[i] = this.frequencyData[i] / 255.0;
      timeFloat[i] = (this.timeData[i] - 128) / 128.0;
    }

    // Extract various feature types
    const spectralFeatures = this.extractSpectralFeatures(frequencyFloat);
    const temporalFeatures = this.extractTemporalFeatures(timeFloat);
    const harmonicFeatures = this.extractHarmonicFeatures(frequencyFloat);
    const rhythmicFeatures = this.extractRhythmicFeatures(timeFloat);
    const emotionalFeatures = this.extractEmotionalFeatures(frequencyFloat);

    return {
      ...spectralFeatures,
      ...temporalFeatures,
      ...harmonicFeatures,
      ...rhythmicFeatures,
      ...emotionalFeatures,
    };
  }

  /**
   * Extract spectral features (frequency domain)
   */
  private extractSpectralFeatures(spectrum: Float32Array): Partial<MusicFeatures> {
    const nyquist = this.sampleRate / 2;
    const binWidth = nyquist / spectrum.length;
    
    // Spectral centroid (brightness)
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      const frequency = i * binWidth;
      const magnitude = spectrum[i];
      numerator += frequency * magnitude;
      denominator += magnitude;
    }
    
    const spectralCentroid = denominator > 0 ? numerator / denominator : 0;
    
    // Spectral rolloff (90% of energy)
    let cumulativeEnergy = 0;
    const totalEnergy = spectrum.reduce((sum, val) => sum + val * val, 0);
    let rolloffBin = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      cumulativeEnergy += spectrum[i] * spectrum[i];
      if (cumulativeEnergy >= 0.9 * totalEnergy) {
        rolloffBin = i;
        break;
      }
    }
    
    const spectralRolloff = rolloffBin * binWidth;
    
    // Spectral bandwidth
    let bandwidthSum = 0;
    for (let i = 0; i < spectrum.length; i++) {
      const frequency = i * binWidth;
      const magnitude = spectrum[i];
      bandwidthSum += Math.pow(frequency - spectralCentroid, 2) * magnitude;
    }
    
    const spectralBandwidth = denominator > 0 ? Math.sqrt(bandwidthSum / denominator) : 0;
    
    // Spectral flatness (measure of noisiness)
    let geometricMean = 1;
    let arithmeticMean = 0;
    let nonZeroCount = 0;
    
    for (let i = 1; i < spectrum.length; i++) { // Skip DC component
      if (spectrum[i] > 0) {
        geometricMean *= Math.pow(spectrum[i], 1 / (spectrum.length - 1));
        arithmeticMean += spectrum[i];
        nonZeroCount++;
      }
    }
    
    arithmeticMean /= nonZeroCount || 1;
    const spectralFlatness = arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
    
    // MFCC calculation (simplified)
    const mfcc = this.calculateMFCC(spectrum);
    
    return {
      spectralCentroid,
      spectralRolloff,
      spectralBandwidth,
      spectralFlatness,
      mfcc,
    };
  }

  /**
   * Extract temporal features (time domain)
   */
  private extractTemporalFeatures(waveform: Float32Array): Partial<MusicFeatures> {
    // Zero crossing rate
    let zeroCrossings = 0;
    for (let i = 1; i < waveform.length; i++) {
      if ((waveform[i] >= 0) !== (waveform[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    
    // RMS energy
    const rms = Math.sqrt(waveform.reduce((sum, val) => sum + val * val, 0) / waveform.length);
    
    // Simple beat detection (onset detection)
    const onsetTimes = this.detectOnsets(waveform);
    const beatTimes = this.estimateBeats(onsetTimes);
    const tempo = this.estimateTempo(beatTimes);
    
    return {
      tempo,
      beatTimes,
      beatStrength: onsetTimes.map(() => rms), // Simplified
      onsetTimes,
    };
  }

  /**
   * Extract harmonic features
   */
  private extractHarmonicFeatures(spectrum: Float32Array): Partial<MusicFeatures> {
    // Chromatic features (12-bin pitch class profile)
    const chromaticFeatures = this.calculateChromaVector(spectrum);
    
    // Key detection (simplified)
    const { key, mode } = this.detectKey(chromaticFeatures);
    
    return {
      chromaticFeatures,
      key,
      mode,
    };
  }

  /**
   * Extract rhythmic features
   */
  private extractRhythmicFeatures(waveform: Float32Array): Partial<MusicFeatures> {
    // Rhythm pattern analysis
    const rhythmPattern = this.analyzeRhythmPattern(waveform);
    
    // Syncopation measure
    const syncopation = this.calculateSyncopation(rhythmPattern);
    
    // Rhythm complexity
    const rhythmComplexity = this.calculateRhythmComplexity(rhythmPattern);
    
    return {
      rhythmPattern,
      syncopation,
      rhythmComplexity,
    };
  }

  /**
   * Extract emotional features
   */
  private extractEmotionalFeatures(spectrum: Float32Array): Partial<MusicFeatures> {
    // Energy (total spectral energy)
    const energy = spectrum.reduce((sum, val) => sum + val * val, 0) / spectrum.length;
    
    // Brightness-based valence estimation
    const highFreqEnergy = spectrum.slice(spectrum.length * 0.5).reduce((sum, val) => sum + val, 0);
    const lowFreqEnergy = spectrum.slice(0, spectrum.length * 0.5).reduce((sum, val) => sum + val, 0);
    const valence = highFreqEnergy / (highFreqEnergy + lowFreqEnergy + 0.001);
    
    // Simplified estimates for other emotional features
    const danceability = Math.min(1, energy * 2); // Higher energy = more danceable
    const acousticness = 1 - (highFreqEnergy / (lowFreqEnergy + 0.001)); // Less high freq = more acoustic
    const instrumentalness = 1 - valence; // Simplified inverse relationship
    const liveness = energy * 0.5; // Simplified
    const loudness = 20 * Math.log10(energy + 0.001); // dB scale
    
    return {
      energy,
      valence,
      danceability,
      acousticness,
      instrumentalness,
      liveness,
      loudness,
    };
  }

  /**
   * Calculate MFCC features
   */
  private calculateMFCC(spectrum: Float32Array): Float32Array {
    // Simplified MFCC calculation
    const mfcc = new Float32Array(this.mfccCoefficients);
    
    // Create mel filter bank
    const melFilters = this.createMelFilterBank(spectrum.length);
    
    // Apply mel filters
    const melSpectrum = new Float32Array(this.melFilterBanks);
    for (let i = 0; i < this.melFilterBanks; i++) {
      for (let j = 0; j < spectrum.length; j++) {
        melSpectrum[i] += spectrum[j] * melFilters[i][j];
      }
      melSpectrum[i] = Math.log(melSpectrum[i] + 1e-10); // Log scale
    }
    
    // DCT to get MFCC coefficients
    for (let i = 0; i < this.mfccCoefficients; i++) {
      for (let j = 0; j < this.melFilterBanks; j++) {
        mfcc[i] += melSpectrum[j] * Math.cos((Math.PI * i * (j + 0.5)) / this.melFilterBanks);
      }
    }
    
    return mfcc;
  }

  /**
   * Create mel filter bank
   */
  private createMelFilterBank(spectrumLength: number): number[][] {
    const filters: number[][] = [];
    const nyquist = this.sampleRate / 2;
    
    // Convert Hz to Mel scale
    const hzToMel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
    const melToHz = (mel: number) => 700 * (Math.pow(10, mel / 2595) - 1);
    
    const melLow = hzToMel(0);
    const melHigh = hzToMel(nyquist);
    const melStep = (melHigh - melLow) / (this.melFilterBanks + 1);
    
    for (let i = 0; i < this.melFilterBanks; i++) {
      const filter = new Array(spectrumLength).fill(0);
      
      const melStart = melLow + i * melStep;
      const melCenter = melLow + (i + 1) * melStep;
      const melEnd = melLow + (i + 2) * melStep;
      
      const hzStart = melToHz(melStart);
      const hzCenter = melToHz(melCenter);
      const hzEnd = melToHz(melEnd);
      
      const binStart = Math.floor(hzStart * spectrumLength / nyquist);
      const binCenter = Math.floor(hzCenter * spectrumLength / nyquist);
      const binEnd = Math.floor(hzEnd * spectrumLength / nyquist);
      
      // Triangular filter
      for (let j = binStart; j < binCenter; j++) {
        filter[j] = (j - binStart) / (binCenter - binStart);
      }
      for (let j = binCenter; j < binEnd; j++) {
        filter[j] = (binEnd - j) / (binEnd - binCenter);
      }
      
      filters.push(filter);
    }
    
    return filters;
  }

  /**
   * Calculate chromatic vector (pitch class profile)
   */
  private calculateChromaVector(spectrum: Float32Array): Float32Array {
    const chroma = new Float32Array(12);
    const nyquist = this.sampleRate / 2;
    const binWidth = nyquist / spectrum.length;
    
    for (let i = 1; i < spectrum.length; i++) {
      const frequency = i * binWidth;
      const pitch = 12 * Math.log2(frequency / 440) + 69; // MIDI note number
      const pitchClass = Math.floor(pitch) % 12;
      
      if (pitchClass >= 0 && pitchClass < 12) {
        chroma[pitchClass] += spectrum[i];
      }
    }
    
    // Normalize
    const sum = chroma.reduce((s, v) => s + v, 0);
    if (sum > 0) {
      for (let i = 0; i < 12; i++) {
        chroma[i] /= sum;
      }
    }
    
    return chroma;
  }

  /**
   * Detect key and mode from chroma vector
   */
  private detectKey(chroma: Float32Array): { key: string; mode: 'major' | 'minor' } {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    // Major scale template
    const majorTemplate = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
    // Minor scale template  
    const minorTemplate = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0];
    
    let bestKey = 'C';
    let bestMode: 'major' | 'minor' = 'major';
    let bestCorrelation = -1;
    
    // Test all keys and modes
    for (let key = 0; key < 12; key++) {
      // Test major
      let correlation = 0;
      for (let i = 0; i < 12; i++) {
        correlation += chroma[i] * majorTemplate[(i - key + 12) % 12];
      }
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestKey = notes[key];
        bestMode = 'major';
      }
      
      // Test minor
      correlation = 0;
      for (let i = 0; i < 12; i++) {
        correlation += chroma[i] * minorTemplate[(i - key + 12) % 12];
      }
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestKey = notes[key];
        bestMode = 'minor';
      }
    }
    
    return { key: bestKey, mode: bestMode };
  }

  /**
   * Simple onset detection
   */
  private detectOnsets(waveform: Float32Array): number[] {
    const onsets: number[] = [];
    const windowSize = 512;
    const threshold = 0.1;
    
    for (let i = windowSize; i < waveform.length - windowSize; i += windowSize) {
      const currentEnergy = this.calculateEnergy(waveform, i, windowSize);
      const previousEnergy = this.calculateEnergy(waveform, i - windowSize, windowSize);
      
      if (currentEnergy > previousEnergy * (1 + threshold)) {
        onsets.push(i / this.sampleRate);
      }
    }
    
    return onsets;
  }

  /**
   * Calculate energy in a window
   */
  private calculateEnergy(waveform: Float32Array, start: number, length: number): number {
    let energy = 0;
    for (let i = start; i < Math.min(start + length, waveform.length); i++) {
      energy += waveform[i] * waveform[i];
    }
    return energy / length;
  }

  /**
   * Estimate beats from onsets
   */
  private estimateBeats(onsets: number[]): number[] {
    // Simplified beat estimation
    // In a real implementation, this would use more sophisticated algorithms
    return onsets.filter((_, i) => i % 2 === 0); // Every other onset
  }

  /**
   * Estimate tempo from beat times
   */
  private estimateTempo(beats: number[]): number {
    if (beats.length < 2) return 120; // Default tempo
    
    const intervals = [];
    for (let i = 1; i < beats.length; i++) {
      intervals.push(beats[i] - beats[i - 1]);
    }
    
    // Median interval
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];
    
    return medianInterval > 0 ? 60 / medianInterval : 120;
  }

  /**
   * Analyze rhythm pattern
   */
  private analyzeRhythmPattern(waveform: Float32Array): Float32Array {
    // Simplified rhythm pattern analysis
    const patternLength = 16; // 16th note resolution
    const pattern = new Float32Array(patternLength);
    
    const segmentLength = Math.floor(waveform.length / patternLength);
    
    for (let i = 0; i < patternLength; i++) {
      const start = i * segmentLength;
      const end = Math.min(start + segmentLength, waveform.length);
      pattern[i] = this.calculateEnergy(waveform, start, end - start);
    }
    
    return pattern;
  }

  /**
   * Calculate syncopation measure
   */
  private calculateSyncopation(rhythmPattern: Float32Array): number {
    // Simplified syncopation calculation
    const strongBeats = [0, 4, 8, 12]; // Typical strong beats in 4/4
    const weakBeats = [2, 6, 10, 14];
    
    let strongBeatEnergy = 0;
    let weakBeatEnergy = 0;
    
    strongBeats.forEach(beat => {
      if (beat < rhythmPattern.length) {
        strongBeatEnergy += rhythmPattern[beat];
      }
    });
    
    weakBeats.forEach(beat => {
      if (beat < rhythmPattern.length) {
        weakBeatEnergy += rhythmPattern[beat];
      }
    });
    
    return weakBeatEnergy / (strongBeatEnergy + weakBeatEnergy + 0.001);
  }

  /**
   * Calculate rhythm complexity
   */
  private calculateRhythmComplexity(rhythmPattern: Float32Array): number {
    // Entropy-based complexity measure
    const sum = rhythmPattern.reduce((s, v) => s + v, 0);
    if (sum === 0) return 0;
    
    let entropy = 0;
    for (const value of rhythmPattern) {
      const probability = value / sum;
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
      }
    }
    
    return entropy / Math.log2(rhythmPattern.length); // Normalized entropy
  }

  /**
   * Get analyser node for connecting to other audio nodes
   */
  getAnalyser(): AnalyserNode {
    return this.analyser;
  }

  /**
   * Update buffer size
   */
  setBufferSize(size: number): void {
    this.bufferSize = size;
    this.analyser.fftSize = size;
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.frequencyBinCount);
  }
}

/**
 * AI Music Analyzer with TensorFlow.js integration
 */
export class AIMusicalAnalyzer {
  private audioProcessor: AudioProcessor;
  private tfModel: tf.LayersModel | null = null;
  private isModelLoaded: boolean = false;
  private featureHistory: MusicFeatures[] = [];
  private maxHistoryLength: number = 100;

  constructor(audioContext: AudioContext) {
    this.audioProcessor = new AudioProcessor(audioContext);
  }

  /**
   * Initialize and load AI model
   */
  async initialize(): Promise<void> {
    console.log('[AIMusicalAnalyzer] Initializing AI model...');
    
    try {
      // Load pre-trained model (placeholder URL)
      // In production, this would load a real trained model
      this.tfModel = await this.createPlaceholderModel();
      this.isModelLoaded = true;
      
      console.log('[AIMusicalAnalyzer] AI model loaded successfully');
    } catch (error) {
      console.error('[AIMusicalAnalyzer] Failed to load AI model:', error);
      // Continue without AI model - fallback to rule-based analysis
    }
  }

  /**
   * Create placeholder model for development
   */
  private async createPlaceholderModel(): Promise<tf.LayersModel> {
    // Simple neural network for music-to-visual mapping
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [50], // Combined feature vector size
          units: 128,
          activation: 'relu',
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 64,
          activation: 'relu',
        }),
        tf.layers.dense({
          units: 32,
          activation: 'relu',
        }),
        tf.layers.dense({
          units: 15, // Visual parameter count
          activation: 'sigmoid',
        }),
      ],
    });

    // Compile model
    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['mae'],
    });

    return model;
  }

  /**
   * Connect audio source
   */
  connect(source: AudioNode): void {
    this.audioProcessor.connect(source);
  }

  /**
   * Analyze current audio and generate visual parameters
   */
  async analyzeRealtime(): Promise<VisualParameters> {
    // Extract audio features
    const features = this.audioProcessor.extractFeatures();
    
    // Add to history
    this.featureHistory.push(features);
    if (this.featureHistory.length > this.maxHistoryLength) {
      this.featureHistory.shift();
    }

    // Generate visual parameters
    let visualParams: VisualParameters;
    
    if (this.isModelLoaded && this.tfModel) {
      // Use AI model for prediction
      visualParams = await this.generateWithAI(features);
    } else {
      // Fallback to rule-based generation
      visualParams = this.generateWithRules(features);
    }

    return visualParams;
  }

  /**
   * Generate visual parameters using AI model
   */
  private async generateWithAI(features: MusicFeatures): Promise<VisualParameters> {
    if (!this.tfModel) {
      throw new Error('AI model not loaded');
    }

    // Prepare feature vector
    const featureVector = this.prepareFeaturesForAI(features);
    
    // Run inference
    const prediction = this.tfModel.predict(featureVector) as tf.Tensor;
    const result = await prediction.data();
    
    // Convert prediction to visual parameters
    const visualParams = this.interpretAIPrediction(result);
    
    // Cleanup tensors
    featureVector.dispose();
    prediction.dispose();
    
    return visualParams;
  }

  /**
   * Prepare features for AI model input
   */
  private prepareFeaturesForAI(features: MusicFeatures): tf.Tensor {
    // Create feature vector from music features
    const featureArray = [
      features.tempo / 200, // Normalize tempo
      features.energy,
      features.valence,
      features.danceability,
      features.spectralCentroid / 8000, // Normalize frequency
      features.spectralRolloff / 8000,
      features.spectralBandwidth / 8000,
      features.spectralFlatness,
      features.syncopation,
      features.rhythmComplexity,
      features.loudness / 100, // Normalize dB
      ...Array.from(features.mfcc.slice(0, 13)), // First 13 MFCC coefficients
      ...Array.from(features.chromaticFeatures), // 12 chroma features
      ...Array.from(features.rhythmPattern.slice(0, 16)), // Rhythm pattern
    ];

    // Pad or truncate to exactly 50 features
    while (featureArray.length < 50) {
      featureArray.push(0);
    }
    featureArray.length = 50;

    return tf.tensor2d([featureArray]);
  }

  /**
   * Interpret AI model prediction
   */
  private interpretAIPrediction(prediction: Float32Array): VisualParameters {
    return {
      // Color parameters
      hue: prediction[0] * 360,
      saturation: prediction[1],
      brightness: prediction[2],
      colorTemperature: prediction[3],
      
      // Motion parameters
      speed: prediction[4] * 2,
      intensity: prediction[5],
      complexity: prediction[6],
      smoothness: prediction[7],
      
      // Effect parameters
      particleDensity: prediction[8],
      particleSize: prediction[9],
      waveAmplitude: prediction[10],
      geometryComplexity: prediction[11],
      
      // Style parameters
      visualStyle: this.selectStyle(prediction[12]),
      effectType: this.selectEffectType(prediction[13]),
      blendMode: this.selectBlendMode(prediction[14]),
      
      // Temporal parameters
      transitionSpeed: prediction[15] || 0.5,
      synchronization: prediction[16] || 0.8,
      anticipation: prediction[17] || 0.5,
    };
  }

  /**
   * Generate visual parameters using rule-based approach
   */
  private generateWithRules(features: MusicFeatures): VisualParameters {
    // Rule-based music-to-visual mapping
    return {
      // Color based on harmonic content
      hue: this.mapKeyToHue(features.key),
      saturation: Math.min(1, features.energy * 1.5),
      brightness: Math.min(1, features.loudness / -10), // Convert dB to 0-1
      colorTemperature: features.valence,
      
      // Motion based on rhythm
      speed: Math.min(2, features.tempo / 60),
      intensity: features.energy,
      complexity: features.rhythmComplexity,
      smoothness: 1 - features.syncopation,
      
      // Effects based on spectral content
      particleDensity: Math.min(1, features.spectralCentroid / 4000),
      particleSize: Math.min(1, features.spectralBandwidth / 2000),
      waveAmplitude: features.energy,
      geometryComplexity: features.rhythmComplexity,
      
      // Style based on musical characteristics
      visualStyle: this.selectStyleFromFeatures(features),
      effectType: this.selectEffectFromFeatures(features),
      blendMode: features.mode === 'major' ? 'screen' : 'multiply',
      
      // Temporal parameters
      transitionSpeed: Math.min(1, features.tempo / 120),
      synchronization: 0.8,
      anticipation: 0.5,
    };
  }

  /**
   * Map musical key to hue
   */
  private mapKeyToHue(key: string): number {
    const keyHueMap: Record<string, number> = {
      'C': 0,    // Red
      'C#': 30,  // Orange
      'D': 60,   // Yellow
      'D#': 90,  // Yellow-green
      'E': 120,  // Green
      'F': 150,  // Green-blue
      'F#': 180, // Cyan
      'G': 210,  // Blue
      'G#': 240, // Blue-purple
      'A': 270,  // Purple
      'A#': 300, // Purple-red
      'B': 330,  // Red-purple
    };
    
    return keyHueMap[key] || 0;
  }

  /**
   * Select visual style from audio features
   */
  private selectStyleFromFeatures(features: MusicFeatures): 'minimal' | 'organic' | 'geometric' | 'abstract' | 'retro' {
    if (features.acousticness > 0.7) return 'organic';
    if (features.instrumentalness > 0.8) return 'abstract';
    if (features.energy > 0.8 && features.danceability > 0.7) return 'geometric';
    if (features.valence < 0.3) return 'minimal';
    return 'retro';
  }

  /**
   * Select effect type from audio features
   */
  private selectEffectFromFeatures(features: MusicFeatures): 'particles' | 'waves' | 'geometry' | 'fluid' | 'fractals' {
    if (features.rhythmComplexity > 0.7) return 'fractals';
    if (features.spectralFlatness > 0.5) return 'fluid';
    if (features.energy > 0.8) return 'particles';
    if (features.spectralCentroid > 3000) return 'geometry';
    return 'waves';
  }

  /**
   * Select style based on AI prediction
   */
  private selectStyle(value: number): 'minimal' | 'organic' | 'geometric' | 'abstract' | 'retro' {
    const styles = ['minimal', 'organic', 'geometric', 'abstract', 'retro'] as const;
    const index = Math.floor(value * styles.length);
    return styles[Math.min(index, styles.length - 1)];
  }

  /**
   * Select effect type based on AI prediction
   */
  private selectEffectType(value: number): 'particles' | 'waves' | 'geometry' | 'fluid' | 'fractals' {
    const effects = ['particles', 'waves', 'geometry', 'fluid', 'fractals'] as const;
    const index = Math.floor(value * effects.length);
    return effects[Math.min(index, effects.length - 1)];
  }

  /**
   * Select blend mode based on AI prediction
   */
  private selectBlendMode(value: number): 'normal' | 'multiply' | 'screen' | 'overlay' | 'difference' {
    const modes = ['normal', 'multiply', 'screen', 'overlay', 'difference'] as const;
    const index = Math.floor(value * modes.length);
    return modes[Math.min(index, modes.length - 1)];
  }

  /**
   * Get current music features
   */
  getCurrentFeatures(): MusicFeatures | null {
    return this.featureHistory[this.featureHistory.length - 1] || null;
  }

  /**
   * Get feature history
   */
  getFeatureHistory(): MusicFeatures[] {
    return [...this.featureHistory];
  }

  /**
   * Check if AI model is loaded
   */
  isAIModelLoaded(): boolean {
    return this.isModelLoaded;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.tfModel) {
      this.tfModel.dispose();
      this.tfModel = null;
    }
    this.isModelLoaded = false;
    this.featureHistory = [];
  }
}