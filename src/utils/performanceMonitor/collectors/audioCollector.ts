/**
 * Audio Performance Collector
 * Monitors audio latency, buffer underruns, and context state
 */

import { MetricCollector, AudioMetrics, PerformanceSnapshot } from '../types';

export class AudioCollector implements MetricCollector {
  name = 'audio';
  enabled = true;

  private audioContext?: AudioContext;
  private bufferUnderruns: number = 0;
  private lastLatencyMeasurement: number = 0;
  private latencyHistory: number[] = [];
  private processingTimeHistory: number[] = [];
  private contextStateHistory: AudioContextState[] = [];

  constructor(audioContext?: AudioContext) {
    this.audioContext = audioContext;
  }

  async initialize(): Promise<void> {
    console.log('Initializing audio performance collector...');
    
    // Try to get global audio context if not provided
    if (!this.audioContext && typeof window !== 'undefined' && (window as any).audioContext) {
      this.audioContext = (window as any).audioContext;
    }

    if (this.audioContext) {
      this.setupAudioContextMonitoring();
    }
  }

  cleanup(): void {
    // Clear histories
    this.latencyHistory = [];
    this.processingTimeHistory = [];
    this.contextStateHistory = [];
  }

  async collect(): Promise<Partial<PerformanceSnapshot>> {
    const audioMetrics = await this.collectAudioMetrics();

    return {
      audio: audioMetrics,
    };
  }

  /**
   * Set audio context reference
   */
  setAudioContext(audioContext: AudioContext): void {
    this.audioContext = audioContext;
    this.setupAudioContextMonitoring();
  }

  /**
   * Collect comprehensive audio metrics
   */
  private async collectAudioMetrics(): Promise<AudioMetrics> {
    if (!this.audioContext) {
      return this.getDefaultAudioMetrics();
    }

    const latency = await this.measureLatency();
    const bufferSize = this.getBufferSize();
    const underruns = this.getBufferUnderruns();
    const processingTime = this.measureProcessingTime();

    // Track metrics history
    this.trackLatency(latency);
    this.trackProcessingTime(processingTime);
    this.trackContextState(this.audioContext.state);

    return {
      latency,
      bufferSize,
      underruns,
      contextState: this.audioContext.state,
      sampleRate: this.audioContext.sampleRate,
      processingTime,
    };
  }

  /**
   * Get default audio metrics when no context is available
   */
  private getDefaultAudioMetrics(): AudioMetrics {
    return {
      latency: 0,
      bufferSize: 0,
      underruns: 0,
      contextState: 'suspended',
      sampleRate: 44100,
      processingTime: 0,
    };
  }

  /**
   * Measure audio latency
   */
  private async measureLatency(): Promise<number> {
    if (!this.audioContext) {
      return 0;
    }

    try {
      // Use AudioContext latency properties if available
      const outputLatency = (this.audioContext as any).outputLatency || 0;
      const baseLatency = (this.audioContext as any).baseLatency || 0;
      
      // Total latency in milliseconds
      const totalLatency = (outputLatency + baseLatency) * 1000;
      
      if (totalLatency > 0) {
        return totalLatency;
      }

      // Fallback: estimate from buffer size and sample rate
      return this.estimateLatencyFromBuffer();
    } catch (error) {
      console.warn('Failed to measure audio latency:', error);
      return this.estimateLatencyFromBuffer();
    }
  }

  /**
   * Estimate latency from buffer size
   */
  private estimateLatencyFromBuffer(): number {
    if (!this.audioContext) {
      return 0;
    }

    // Estimate based on sample rate and typical buffer sizes
    const bufferSize = this.getBufferSize();
    if (bufferSize > 0) {
      return (bufferSize / this.audioContext.sampleRate) * 1000;
    }

    // Default estimation for Web Audio API
    // Typical latency: 5-20ms for modern browsers
    return 10; // milliseconds
  }

  /**
   * Get current buffer size
   */
  private getBufferSize(): number {
    if (!this.audioContext) {
      return 0;
    }

    // Estimate buffer size from base latency
    const baseLatency = (this.audioContext as any).baseLatency || 0.005; // 5ms default
    return Math.ceil(baseLatency * this.audioContext.sampleRate);
  }

  /**
   * Get buffer underrun count
   */
  private getBufferUnderruns(): number {
    // This would need integration with actual audio processing nodes
    // For now, estimate based on context state changes and performance
    if (!this.audioContext) {
      return 0;
    }

    // Estimate underruns based on context state history
    const recentSuspensions = this.contextStateHistory
      .slice(-10) // Last 10 measurements
      .filter(state => state === 'suspended').length;

    // Add to buffer underrun count if context was suspended
    if (recentSuspensions > 0) {
      this.bufferUnderruns += recentSuspensions;
    }

    return this.bufferUnderruns;
  }

  /**
   * Measure audio processing time
   */
  private measureProcessingTime(): number {
    if (!this.audioContext) {
      return 0;
    }

    const startTime = performance.now();
    
    // Simulate audio processing measurement
    // In real implementation, this would measure actual audio callback time
    try {
      // This is a placeholder for actual audio processing time measurement
      // Real implementation would integrate with audio worklet or script processor
      const processingTime = performance.now() - startTime;
      return processingTime;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Setup audio context monitoring
   */
  private setupAudioContextMonitoring(): void {
    if (!this.audioContext) {
      return;
    }

    // Monitor context state changes
    this.audioContext.addEventListener('statechange', () => {
      console.log(`Audio context state changed to: ${this.audioContext!.state}`);
      this.trackContextState(this.audioContext!.state);
    });
  }

  /**
   * Track latency in history
   */
  private trackLatency(latency: number): void {
    this.latencyHistory.push(latency);
    
    // Keep only last 60 measurements
    if (this.latencyHistory.length > 60) {
      this.latencyHistory.shift();
    }
  }

  /**
   * Track processing time in history
   */
  private trackProcessingTime(processingTime: number): void {
    this.processingTimeHistory.push(processingTime);
    
    // Keep only last 60 measurements
    if (this.processingTimeHistory.length > 60) {
      this.processingTimeHistory.shift();
    }
  }

  /**
   * Track context state in history
   */
  private trackContextState(state: AudioContextState): void {
    this.contextStateHistory.push(state);
    
    // Keep only last 60 measurements
    if (this.contextStateHistory.length > 60) {
      this.contextStateHistory.shift();
    }
  }

  /**
   * Get audio performance statistics
   */
  getAudioPerformanceStats(): {
    averageLatency: number;
    minLatency: number;
    maxLatency: number;
    latencyVariation: number;
    contextStability: number; // 0-100 score
    processingEfficiency: number; // 0-100 score
  } {
    const avgLatency = this.latencyHistory.length > 0
      ? this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length
      : 0;

    const minLatency = this.latencyHistory.length > 0 ? Math.min(...this.latencyHistory) : 0;
    const maxLatency = this.latencyHistory.length > 0 ? Math.max(...this.latencyHistory) : 0;
    
    // Calculate latency variation (coefficient of variation)
    const latencyStdDev = this.calculateStandardDeviation(this.latencyHistory);
    const latencyVariation = avgLatency > 0 ? (latencyStdDev / avgLatency) * 100 : 0;

    // Context stability: percentage of time in 'running' state
    const runningStateCount = this.contextStateHistory.filter(state => state === 'running').length;
    const contextStability = this.contextStateHistory.length > 0
      ? (runningStateCount / this.contextStateHistory.length) * 100
      : 0;

    // Processing efficiency: inverse of processing time
    const avgProcessingTime = this.processingTimeHistory.length > 0
      ? this.processingTimeHistory.reduce((a, b) => a + b, 0) / this.processingTimeHistory.length
      : 0;
    const processingEfficiency = avgProcessingTime > 0 ? Math.max(0, 100 - avgProcessingTime * 10) : 100;

    return {
      averageLatency: avgLatency,
      minLatency,
      maxLatency,
      latencyVariation,
      contextStability,
      processingEfficiency,
    };
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Check if audio performance is acceptable
   */
  isPerformanceAcceptable(): boolean {
    const stats = this.getAudioPerformanceStats();
    
    // Performance is acceptable if:
    // - Average latency is below 100ms
    // - Context is stable (>80% running time)
    // - Latency variation is reasonable (<50%)
    return stats.averageLatency < 100 &&
           stats.contextStability > 80 &&
           stats.latencyVariation < 50;
  }

  /**
   * Get audio optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.getAudioPerformanceStats();

    if (stats.averageLatency > 100) {
      recommendations.push('High audio latency detected - consider reducing buffer size');
    }

    if (stats.latencyVariation > 50) {
      recommendations.push('High latency variation - check for system performance issues');
    }

    if (stats.contextStability < 80) {
      recommendations.push('Audio context instability - ensure proper user gesture handling');
    }

    if (stats.processingEfficiency < 70) {
      recommendations.push('Poor audio processing efficiency - optimize audio worklet code');
    }

    if (this.bufferUnderruns > 10) {
      recommendations.push('High buffer underrun count - increase buffer size or optimize processing');
    }

    if (!this.audioContext) {
      recommendations.push('No audio context available - ensure audio system is properly initialized');
    } else if (this.audioContext.state !== 'running') {
      recommendations.push('Audio context not running - may need user interaction to resume');
    }

    return recommendations;
  }

  /**
   * Reset buffer underrun counter
   */
  resetUnderrunCounter(): void {
    this.bufferUnderruns = 0;
  }

  /**
   * Get current audio context info
   */
  getAudioContextInfo(): {
    state: AudioContextState;
    sampleRate: number;
    currentTime: number;
    baseLatency?: number;
    outputLatency?: number;
  } | null {
    if (!this.audioContext) {
      return null;
    }

    return {
      state: this.audioContext.state,
      sampleRate: this.audioContext.sampleRate,
      currentTime: this.audioContext.currentTime,
      baseLatency: (this.audioContext as any).baseLatency,
      outputLatency: (this.audioContext as any).outputLatency,
    };
  }

  /**
   * Test audio latency using ping method
   */
  async testAudioLatency(): Promise<number> {
    if (!this.audioContext || this.audioContext.state !== 'running') {
      throw new Error('Audio context not available or not running');
    }

    return new Promise((resolve, reject) => {
      try {
        // Create a test tone and measure round-trip time
        const startTime = this.audioContext!.currentTime;
        const oscillator = this.audioContext!.createOscillator();
        const gainNode = this.audioContext!.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext!.destination);
        
        oscillator.frequency.value = 440; // A4 note
        gainNode.gain.value = 0.1; // Low volume
        
        oscillator.start(startTime);
        oscillator.stop(startTime + 0.1); // 100ms tone
        
        oscillator.addEventListener('ended', () => {
          const endTime = this.audioContext!.currentTime;
          const latency = (endTime - startTime) * 1000; // Convert to milliseconds
          resolve(latency);
        });
        
        // Timeout after 1 second
        setTimeout(() => {
          reject(new Error('Audio latency test timeout'));
        }, 1000);
        
      } catch (error) {
        reject(error);
      }
    });
  }
}