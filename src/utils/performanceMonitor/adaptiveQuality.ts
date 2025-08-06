/**
 * Adaptive Quality Manager
 * Automatically adjusts rendering quality based on performance metrics
 */

import {
  QualityProfile,
  PerformanceSnapshot,
  DeviceTier,
  DeviceCapabilities,
  DeviceConstraints,
  QUALITY_PROFILES,
} from './types';

export class AdaptiveQualityManager {
  private currentProfile: QualityProfile;
  private deviceTier: DeviceTier;
  private deviceCapabilities: DeviceCapabilities;
  private deviceConstraints: DeviceConstraints;
  private performanceHistory: PerformanceSnapshot[] = [];
  private adaptationHistory: { timestamp: number; profile: string; reason: string }[] = [];
  private enabled: boolean = true;
  private lastAdaptation: number = 0;
  private adaptationCooldown: number = 5000; // 5 seconds

  constructor(
    private renderer?: any,
    private audioContext?: AudioContext,
    private store?: any
  ) {
    this.deviceTier = this.detectDeviceTier();
    this.deviceCapabilities = this.detectDeviceCapabilities();
    this.deviceConstraints = this.detectDeviceConstraints();
    this.currentProfile = this.selectInitialProfile();
    
    console.log(`Device tier detected: ${this.deviceTier}`);
    console.log(`Initial quality profile: ${this.currentProfile.name}`);
  }

  /**
   * Process new performance metrics and adapt quality if needed
   */
  processMetrics(metrics: PerformanceSnapshot): void {
    if (!this.enabled) {
      return;
    }

    this.addToHistory(metrics);

    // Check if adaptation is needed (with cooldown)
    const now = Date.now();
    if (now - this.lastAdaptation < this.adaptationCooldown) {
      return;
    }

    if (this.shouldAdaptQuality(metrics)) {
      this.adaptQuality(metrics);
      this.lastAdaptation = now;
    }
  }

  /**
   * Get current quality profile
   */
  getCurrentProfile(): QualityProfile {
    return { ...this.currentProfile };
  }

  /**
   * Set quality profile manually
   */
  setQualityProfile(profileName: string): void {
    const profile = QUALITY_PROFILES[profileName];
    if (!profile) {
      console.warn(`Unknown quality profile: ${profileName}`);
      return;
    }

    this.applyQualityProfile(profile, 'manual_override');
  }

  /**
   * Enable or disable automatic adaptation
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`Adaptive quality management ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get device tier
   */
  getDeviceTier(): DeviceTier {
    return this.deviceTier;
  }

  /**
   * Get device capabilities
   */
  getDeviceCapabilities(): DeviceCapabilities {
    return { ...this.deviceCapabilities };
  }

  /**
   * Detect device tier based on capabilities
   */
  private detectDeviceTier(): DeviceTier {
    const capabilities = this.detectDeviceCapabilities();
    
    // Check for high-end indicators
    const hasWebGPU = capabilities.webgpu;
    const hasHighMemory = (capabilities.deviceMemory || 4) >= 8;
    const hasHighConcurrency = capabilities.hardwareConcurrency >= 8;
    const hasOffscreenCanvas = capabilities.offscreenCanvas;

    if (hasWebGPU && hasHighMemory && hasHighConcurrency) {
      return 'high';
    }

    // Check for low-end indicators
    const hasLowMemory = (capabilities.deviceMemory || 4) <= 2;
    const hasLowConcurrency = capabilities.hardwareConcurrency <= 2;
    const isMobile = this.isMobileDevice();

    if (hasLowMemory || (hasLowConcurrency && isMobile)) {
      return 'low';
    }

    // Default to mid-tier
    return 'mid';
  }

  /**
   * Detect device capabilities
   */
  private detectDeviceCapabilities(): DeviceCapabilities {
    const capabilities: DeviceCapabilities = {
      webgl: false,
      webgpu: false,
      audioContext: false,
      offscreenCanvas: false,
      webWorkers: false,
      memoryInfo: false,
      hardwareConcurrency: (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined) || 2,
    };

    if (typeof window !== 'undefined') {
      // WebGL detection
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        capabilities.webgl = !!gl;
      } catch (e) {
        capabilities.webgl = false;
      }

      // WebGPU detection
      capabilities.webgpu = typeof navigator !== 'undefined' && 'gpu' in navigator;

      // OffscreenCanvas detection
      capabilities.offscreenCanvas = 'OffscreenCanvas' in window;

      // Web Workers detection
      capabilities.webWorkers = 'Worker' in window;

      // Memory info detection
      capabilities.memoryInfo = !!(performance as any).memory;
      
      // Device memory (Chrome only)
      if (typeof navigator !== 'undefined' && 'deviceMemory' in navigator) {
        capabilities.deviceMemory = (navigator as any).deviceMemory;
      }
    }

    // AudioContext detection
    if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
      capabilities.audioContext = true;
    }

    return capabilities;
  }

  /**
   * Detect device constraints
   */
  private detectDeviceConstraints(): DeviceConstraints {
    const constraints: DeviceConstraints = {
      maxTextureSize: 2048,
      maxRenderTargets: 4,
      maxVertexAttributes: 16,
      audioLatencyConstraint: 128,
      memoryConstraint: 512 * 1024 * 1024, // 512MB
    };

    // Try to get WebGL limits
    if (this.deviceCapabilities.webgl) {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (gl) {
          constraints.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
          // MAX_DRAW_BUFFERS is WebGL2 only, fallback to 4 for WebGL1
          constraints.maxRenderTargets = (gl as any).MAX_DRAW_BUFFERS ? gl.getParameter((gl as any).MAX_DRAW_BUFFERS) : 4;
          constraints.maxVertexAttributes = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
        }
      } catch (e) {
        console.warn('Failed to detect WebGL constraints:', e);
      }
    }

    // Adjust constraints based on device tier
    switch (this.deviceTier) {
      case 'low':
        constraints.maxTextureSize = Math.min(constraints.maxTextureSize, 1024);
        constraints.audioLatencyConstraint = 256;
        constraints.memoryConstraint = 256 * 1024 * 1024; // 256MB
        break;
      case 'high':
        constraints.audioLatencyConstraint = 64;
        constraints.memoryConstraint = 1024 * 1024 * 1024; // 1GB
        break;
    }

    return constraints;
  }

  /**
   * Select initial quality profile based on device tier
   */
  private selectInitialProfile(): QualityProfile {
    switch (this.deviceTier) {
      case 'low':
        return QUALITY_PROFILES.low;
      case 'high':
        return QUALITY_PROFILES.high;
      default:
        return QUALITY_PROFILES.medium;
    }
  }

  /**
   * Check if device is mobile
   */
  private isMobileDevice(): boolean {
    if (typeof navigator === 'undefined') {
      return false;
    }

    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad'];
    return mobileKeywords.some(keyword => userAgent.includes(keyword)) ||
           ('ontouchstart' in window && window.innerWidth <= 768);
  }

  /**
   * Add metrics to performance history
   */
  private addToHistory(metrics: PerformanceSnapshot): void {
    this.performanceHistory.push(metrics);

    // Keep only last 30 seconds of data (assuming 1s intervals)
    if (this.performanceHistory.length > 30) {
      this.performanceHistory.shift();
    }
  }

  /**
   * Check if quality adaptation is needed
   */
  private shouldAdaptQuality(metrics: PerformanceSnapshot): boolean {
    const avgFPS = this.getAverageFPS();
    const memoryPressure = this.getMemoryPressure(metrics);
    const audioLatency = metrics.audio.latency;
    const batteryLevel = metrics.mobile?.battery?.level || 100;

    // Conditions for quality reduction
    if (avgFPS < this.currentProfile.fpsTarget * 0.8) return true;
    if (memoryPressure > 0.85) return true;
    if (metrics.audio.underruns > 5) return true;
    if (batteryLevel < 20 && !metrics.mobile?.battery?.charging) return true;
    if (audioLatency > this.currentProfile.audioLatency * 2) return true;

    // Conditions for quality increase (only if performance is good)
    if (avgFPS > this.currentProfile.fpsTarget * 1.1 && 
        memoryPressure < 0.6 && 
        audioLatency < this.currentProfile.audioLatency * 0.8 &&
        batteryLevel > 50) {
      return true;
    }

    return false;
  }

  /**
   * Adapt quality based on performance metrics
   */
  private adaptQuality(metrics: PerformanceSnapshot): void {
    const currentLevel = this.getProfileLevel(this.currentProfile);
    let newLevel = currentLevel;
    let reason = 'performance_optimization';

    // Determine direction and reason
    const avgFPS = this.getAverageFPS();
    const memoryPressure = this.getMemoryPressure(metrics);
    const audioLatency = metrics.audio.latency;
    const batteryLevel = metrics.mobile?.battery?.level || 100;

    // Critical conditions - immediate quality reduction
    if (avgFPS < 20) {
      newLevel = Math.max(0, currentLevel - 2);
      reason = 'critical_fps_drop';
    } else if (memoryPressure > 0.9) {
      newLevel = Math.max(0, currentLevel - 2);
      reason = 'critical_memory_pressure';
    } else if (batteryLevel < 10) {
      newLevel = Math.max(0, currentLevel - 2);
      reason = 'critical_battery_level';
    }
    // Performance degradation - single step reduction
    else if (avgFPS < this.currentProfile.fpsTarget * 0.8 || 
             memoryPressure > 0.85 || 
             metrics.audio.underruns > 5) {
      newLevel = Math.max(0, currentLevel - 1);
      reason = 'performance_degradation';
    }
    // Battery saving mode
    else if (batteryLevel < 20 && !metrics.mobile?.battery?.charging) {
      newLevel = Math.max(0, currentLevel - 1);
      reason = 'battery_saving';
    }
    // Performance improvement - single step increase
    else if (avgFPS > this.currentProfile.fpsTarget * 1.1 && 
             memoryPressure < 0.6 && 
             audioLatency < this.currentProfile.audioLatency * 0.8 &&
             batteryLevel > 50) {
      newLevel = Math.min(4, currentLevel + 1);
      reason = 'performance_improvement';
    }

    if (newLevel !== currentLevel) {
      const newProfile = this.getProfileByLevel(newLevel);
      this.applyQualityProfile(newProfile, reason);
    }
  }

  /**
   * Apply quality profile to renderer and systems
   */
  private applyQualityProfile(profile: QualityProfile, reason: string): void {
    const oldProfile = this.currentProfile.name;
    this.currentProfile = { ...profile };

    // Apply to renderer
    if (this.renderer) {
      this.applyRendererSettings(profile);
    }

    // Apply to audio context
    if (this.audioContext) {
      this.applyAudioSettings(profile);
    }

    // Apply to store
    if (this.store) {
      this.applyStoreSettings(profile);
    }

    // Record adaptation
    this.recordAdaptation(profile.name, reason);

    console.log(`Quality adapted: ${oldProfile} → ${profile.name} (${reason})`);
  }

  /**
   * Apply renderer settings
   */
  private applyRendererSettings(profile: QualityProfile): void {
    if (!this.renderer) return;

    try {
      // Set pixel ratio
      if (this.renderer.setPixelRatio) {
        const devicePixelRatio = window.devicePixelRatio || 1;
        this.renderer.setPixelRatio(devicePixelRatio * profile.renderScale);
      }

      // Set size if method available
      if (this.renderer.setSize && this.renderer.domElement) {
        const canvas = this.renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        this.renderer.setSize(
          rect.width * profile.renderScale,
          rect.height * profile.renderScale,
          false
        );
      }
    } catch (error) {
      console.warn('Failed to apply renderer settings:', error);
    }
  }

  /**
   * Apply audio settings
   */
  private applyAudioSettings(profile: QualityProfile): void {
    // Audio settings would be applied through the audio system
    // This is a placeholder for audio buffer size adjustments
    console.log(`Audio latency target: ${profile.audioLatency}ms`);
  }

  /**
   * Apply store settings
   */
  private applyStoreSettings(profile: QualityProfile): void {
    if (!this.store || !this.store.setState) return;

    try {
      this.store.setState({
        performanceProfile: profile,
        maxParticles: profile.particleCount,
        effectComplexity: profile.effectComplexity,
        renderScale: profile.renderScale,
        qualityLevel: profile.name,
      });
    } catch (error) {
      console.warn('Failed to apply store settings:', error);
    }
  }

  /**
   * Get profile level index (0-4)
   */
  private getProfileLevel(profile: QualityProfile): number {
    const profiles = Object.values(QUALITY_PROFILES);
    return profiles.findIndex(p => p.name === profile.name);
  }

  /**
   * Get profile by level index
   */
  private getProfileByLevel(level: number): QualityProfile {
    const profiles = Object.values(QUALITY_PROFILES);
    return profiles[Math.max(0, Math.min(profiles.length - 1, level))];
  }

  /**
   * Get average FPS from recent history
   */
  private getAverageFPS(): number {
    if (this.performanceHistory.length === 0) {
      return 60; // Assume good performance if no data
    }

    const recentEntries = this.performanceHistory.slice(-10); // Last 10 seconds
    const fpsValues = recentEntries.map(entry => entry.rendering.fps).filter(fps => fps > 0);
    
    if (fpsValues.length === 0) {
      return 60;
    }

    return fpsValues.reduce((sum, fps) => sum + fps, 0) / fpsValues.length;
  }

  /**
   * Get memory pressure (0-1)
   */
  private getMemoryPressure(metrics: PerformanceSnapshot): number {
    const heap = metrics.memory.heap;
    if (heap.limit <= 0) {
      return 0;
    }

    return heap.used / heap.limit;
  }

  /**
   * Record adaptation event
   */
  private recordAdaptation(profileName: string, reason: string): void {
    this.adaptationHistory.push({
      timestamp: Date.now(),
      profile: profileName,
      reason,
    });

    // Keep only last 50 adaptations
    if (this.adaptationHistory.length > 50) {
      this.adaptationHistory.shift();
    }
  }

  /**
   * Get adaptation history
   */
  getAdaptationHistory(): Array<{ timestamp: number; profile: string; reason: string }> {
    return [...this.adaptationHistory];
  }

  /**
   * Get quality recommendations
   */
  getQualityRecommendations(): string[] {
    const recommendations: string[] = [];
    const avgFPS = this.getAverageFPS();
    
    if (this.performanceHistory.length === 0) {
      return ['Insufficient performance data for recommendations'];
    }

    const latestMetrics = this.performanceHistory[this.performanceHistory.length - 1];
    const memoryPressure = this.getMemoryPressure(latestMetrics);

    if (avgFPS < 30) {
      recommendations.push('Consider reducing visual effects complexity');
    }

    if (memoryPressure > 0.8) {
      recommendations.push('High memory usage - reduce particle count or texture quality');
    }

    if (latestMetrics.audio.underruns > 5) {
      recommendations.push('Audio buffer underruns detected - increase audio buffer size');
    }

    if (this.deviceTier === 'low' && this.currentProfile.name !== 'Ultra Low') {
      recommendations.push('Device has limited capabilities - consider lower quality preset');
    }

    if (this.deviceTier === 'high' && this.currentProfile.name === 'Ultra Low') {
      recommendations.push('Device can handle higher quality - consider upgrading preset');
    }

    return recommendations;
  }

  /**
   * Get performance grade
   */
  getPerformanceGrade(): 'excellent' | 'good' | 'fair' | 'poor' {
    const avgFPS = this.getAverageFPS();
    const latestMetrics = this.performanceHistory[this.performanceHistory.length - 1];
    
    if (!latestMetrics) {
      return 'fair';
    }

    const memoryPressure = this.getMemoryPressure(latestMetrics);
    const audioLatency = latestMetrics.audio.latency;

    if (avgFPS >= 55 && memoryPressure < 0.6 && audioLatency < 50) {
      return 'excellent';
    } else if (avgFPS >= 45 && memoryPressure < 0.75 && audioLatency < 100) {
      return 'good';
    } else if (avgFPS >= 30 && memoryPressure < 0.85 && audioLatency < 150) {
      return 'fair';
    } else {
      return 'poor';
    }
  }
}