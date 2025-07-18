/**
 * iOS-Specific Audio Handler
 * Handles iOS Safari audio constraints and limitations
 */

import { iosDetector } from '@/utils/iosDetection';
import { errorHandler } from '@/utils/errorHandler';

export interface IOSAudioConfig {
  sampleRate: number;
  bufferSize: number;
  channels: number;
  enableEchoCancellation: boolean;
  enableNoiseSuppression: boolean;
  enableAutoGainControl: boolean;
}

export interface IOSAudioState {
  context: AudioContext | null;
  isInitialized: boolean;
  isPlaying: boolean;
  userInteractionRequired: boolean;
  currentStream: MediaStream | null;
  analyser: AnalyserNode | null;
  gainNode: GainNode | null;
  source: MediaStreamAudioSourceNode | null;
}

export class IOSAudioHandler {
  private static instance: IOSAudioHandler | null = null;
  private state: IOSAudioState = {
    context: null,
    isInitialized: false,
    isPlaying: false,
    userInteractionRequired: true,
    currentStream: null,
    analyser: null,
    gainNode: null,
    source: null,
  };
  private config: IOSAudioConfig;
  private unlockPromise: Promise<void> | null = null;

  private constructor() {
    const deviceInfo = iosDetector.detectDevice();
    const recommendations = iosDetector.getRecommendedSettings();
    
    this.config = {
      sampleRate: Math.min(deviceInfo.audioConstraints.maxSampleRate, 44100),
      bufferSize: Math.min(recommendations.audioBufferSize, deviceInfo.audioConstraints.bufferSizeLimit),
      channels: Math.min(deviceInfo.audioConstraints.maxChannels, 2),
      enableEchoCancellation: true,
      enableNoiseSuppression: true,
      enableAutoGainControl: false, // Disable for music analysis
    };
  }

  static getInstance(): IOSAudioHandler {
    if (!IOSAudioHandler.instance) {
      IOSAudioHandler.instance = new IOSAudioHandler();
    }
    return IOSAudioHandler.instance;
  }

  /**
   * Initialize audio context with iOS-specific considerations
   */
  async initialize(): Promise<void> {
    const deviceInfo = iosDetector.detectDevice();
    
    if (!deviceInfo.isIOS) {
      throw new Error('IOSAudioHandler should only be used on iOS devices');
    }

    try {
      // Create audio context with iOS-compatible settings
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      
      if (!AudioContextClass) {
        throw new Error('AudioContext not supported on this device');
      }

      this.state.context = new AudioContextClass({
        sampleRate: this.config.sampleRate,
        latencyHint: 'interactive',
      });

      // iOS requires user interaction to start audio context
      if (this.state.context.state === 'suspended') {
        this.state.userInteractionRequired = true;
        errorHandler.info('Audio context suspended - waiting for user interaction');
      }

      // Create analyser node
      this.state.analyser = this.state.context.createAnalyser();
      this.state.analyser.fftSize = this.config.bufferSize * 2;
      this.state.analyser.smoothingTimeConstant = 0.8;

      // Create gain node for volume control
      this.state.gainNode = this.state.context.createGain();
      this.state.gainNode.gain.value = 1.0;

      // Connect nodes
      this.state.analyser.connect(this.state.gainNode);
      this.state.gainNode.connect(this.state.context.destination);

      this.state.isInitialized = true;
      
      errorHandler.info('iOS audio handler initialized', {
        sampleRate: this.state.context.sampleRate,
        bufferSize: this.config.bufferSize,
        state: this.state.context.state,
      });

    } catch (error) {
      errorHandler.error('Failed to initialize iOS audio handler', error as Error);
      throw error;
    }
  }

  /**
   * Unlock audio context with user interaction
   */
  async unlockAudioContext(): Promise<void> {
    if (!this.state.context || !this.state.userInteractionRequired) {
      return;
    }

    // Prevent multiple unlock attempts
    if (this.unlockPromise) {
      return this.unlockPromise;
    }

    this.unlockPromise = new Promise(async (resolve, reject) => {
      try {
        const context = this.state.context!;
        if (context.state === 'suspended') {
          await context.resume();
        }

        // Play a silent sound to fully unlock
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        gainNode.gain.value = 0;
        oscillator.frequency.value = 440;
        oscillator.start();
        oscillator.stop(context.currentTime + 0.1);

        this.state.userInteractionRequired = false;
        
        errorHandler.info('Audio context unlocked');
        resolve();
      } catch (error) {
        errorHandler.error('Failed to unlock audio context', error as Error);
        reject(error);
      }
    });

    return this.unlockPromise;
  }

  /**
   * Start microphone with iOS-specific constraints
   */
  async startMicrophone(): Promise<void> {
    if (!this.state.isInitialized || !this.state.context) {
      throw new Error('Audio handler not initialized');
    }

    // Ensure audio context is unlocked
    await this.unlockAudioContext();

    try {
      // Request microphone access with iOS-optimized constraints
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: this.config.enableEchoCancellation,
          noiseSuppression: this.config.enableNoiseSuppression,
          autoGainControl: this.config.enableAutoGainControl,
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels,
        },
        video: false,
      };

      this.state.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Create audio source
      this.state.source = this.state.context.createMediaStreamSource(this.state.currentStream);
      
      // Connect to analyser
      this.state.source.connect(this.state.analyser!);

      this.state.isPlaying = true;
      
      errorHandler.info('Microphone started', {
        sampleRate: this.state.context.sampleRate,
        tracks: this.state.currentStream.getAudioTracks().length,
      });

    } catch (error) {
      errorHandler.error('Failed to start microphone', error as Error);
      throw error;
    }
  }

  /**
   * Stop microphone
   */
  stopMicrophone(): void {
    if (this.state.currentStream) {
      this.state.currentStream.getTracks().forEach(track => track.stop());
      this.state.currentStream = null;
    }

    if (this.state.source) {
      this.state.source.disconnect();
      this.state.source = null;
    }

    this.state.isPlaying = false;
    
    errorHandler.info('Microphone stopped');
  }

  /**
   * Get audio data for analysis
   */
  getAudioData(): Float32Array {
    if (!this.state.analyser || !this.state.isPlaying) {
      return new Float32Array(this.config.bufferSize);
    }

    const dataArray = new Float32Array(this.state.analyser.frequencyBinCount);
    this.state.analyser.getFloatFrequencyData(dataArray);
    
    return dataArray;
  }

  /**
   * Get time domain data
   */
  getTimeDomainData(): Float32Array {
    if (!this.state.analyser || !this.state.isPlaying) {
      return new Float32Array(this.config.bufferSize);
    }

    const dataArray = new Float32Array(this.state.analyser.fftSize);
    this.state.analyser.getFloatTimeDomainData(dataArray);
    
    return dataArray;
  }

  /**
   * Set volume (iOS has limitations)
   */
  setVolume(volume: number): void {
    if (this.state.gainNode) {
      // Clamp volume to safe range
      const clampedVolume = Math.max(0, Math.min(1, volume));
      this.state.gainNode.gain.value = clampedVolume;
    }
  }

  /**
   * Handle iOS-specific audio interruptions
   */
  setupAudioInterruptionHandling(): void {
    if (!this.state.context) return;

    // Handle audio interruptions (phone calls, etc.)
    this.state.context.addEventListener('statechange', () => {
      const context = this.state.context!;
      const state = context.state;
      
      if (state === 'suspended') {
        this.state.isPlaying = false;
        errorHandler.info('Audio interrupted', { state });
      } else if (state === 'running' && this.state.currentStream) {
        this.state.isPlaying = true;
        errorHandler.info('Audio resumed', { state });
      }
    });

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state.isPlaying) {
        // Pause audio when page is hidden to preserve battery
        this.pauseAudio();
      } else if (!document.hidden && this.state.currentStream) {
        // Resume audio when page becomes visible
        this.resumeAudio();
      }
    });
  }

  /**
   * Pause audio processing
   */
  private pauseAudio(): void {
    if (this.state.context && this.state.context.state === 'running') {
      this.state.context.suspend();
    }
  }

  /**
   * Resume audio processing
   */
  private async resumeAudio(): Promise<void> {
    if (this.state.context && this.state.context.state === 'suspended') {
      await this.state.context.resume();
    }
  }

  /**
   * Get current audio state
   */
  getState(): IOSAudioState {
    return { ...this.state };
  }

  /**
   * Get current configuration
   */
  getConfig(): IOSAudioConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<IOSAudioConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update analyser settings if available
    if (this.state.analyser) {
      if (newConfig.bufferSize) {
        this.state.analyser.fftSize = newConfig.bufferSize * 2;
      }
    }
  }

  /**
   * Check if audio is ready for use
   */
  isReady(): boolean {
    return this.state.isInitialized && 
           this.state.context !== null && 
           this.state.context.state === 'running' &&
           !this.state.userInteractionRequired;
  }

  /**
   * Get recommended settings for current device
   */
  getRecommendedSettings(): IOSAudioConfig {
    const deviceInfo = iosDetector.detectDevice();
    const recommendations = iosDetector.getRecommendedSettings();
    
    return {
      sampleRate: Math.min(deviceInfo.audioConstraints.maxSampleRate, 44100),
      bufferSize: recommendations.audioBufferSize,
      channels: Math.min(deviceInfo.audioConstraints.maxChannels, 2),
      enableEchoCancellation: true,
      enableNoiseSuppression: deviceInfo.performanceProfile !== 'low',
      enableAutoGainControl: false,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopMicrophone();
    
    if (this.state.context) {
      this.state.context.close();
      this.state.context = null;
    }

    this.state.isInitialized = false;
    this.state.userInteractionRequired = true;
    this.unlockPromise = null;
    
    errorHandler.info('iOS audio handler destroyed');
  }
}

// Export singleton instance
export const iosAudioHandler = IOSAudioHandler.getInstance();