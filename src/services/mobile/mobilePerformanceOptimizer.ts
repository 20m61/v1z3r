/**
 * Mobile Performance Optimizer
 * Optimizes performance for iOS and mobile devices
 */

import { iosDetector } from '@/utils/iosDetection';
import { errorHandler } from '@/utils/errorHandler';

export interface MobilePerformanceConfig {
  targetFPS: number;
  maxParticles: number;
  renderScale: number;
  audioBufferSize: number;
  enableAdaptiveQuality: boolean;
  enableBatteryOptimization: boolean;
  enableThermalManagement: boolean;
  lowPowerMode: boolean;
}

export interface PerformanceMetrics {
  currentFPS: number;
  averageFPS: number;
  frameTime: number;
  memoryUsage: number;
  batteryLevel: number;
  thermalState: 'nominal' | 'fair' | 'serious' | 'critical';
  cpuUsage: number;
  gpuUsage: number;
}

export interface QualitySettings {
  particleCount: number;
  renderScale: number;
  effectComplexity: 'low' | 'medium' | 'high';
  audioAnalysisRate: number;
  enablePostProcessing: boolean;
  enableShadows: boolean;
  enableReflections: boolean;
}

export class MobilePerformanceOptimizer {
  private static instance: MobilePerformanceOptimizer | null = null;
  private config: MobilePerformanceConfig;
  private metrics: PerformanceMetrics;
  private qualitySettings: QualitySettings;
  private frameTimeHistory: number[] = [];
  private lastFrameTime: number = 0;
  private adaptiveQualityTimer: number | null = null;
  private batteryCheckTimer: number | null = null;

  private constructor() {
    const deviceInfo = iosDetector.detectDevice();
    const recommendations = iosDetector.getRecommendedSettings();
    
    this.config = {
      targetFPS: deviceInfo.performanceProfile === 'high' ? 60 : 30,
      maxParticles: recommendations.maxParticles,
      renderScale: recommendations.renderScale,
      audioBufferSize: recommendations.audioBufferSize,
      enableAdaptiveQuality: true,
      enableBatteryOptimization: true,
      enableThermalManagement: true,
      lowPowerMode: false,
    };

    this.metrics = {
      currentFPS: 0,
      averageFPS: 0,
      frameTime: 0,
      memoryUsage: 0,
      batteryLevel: 1,
      thermalState: 'nominal',
      cpuUsage: 0,
      gpuUsage: 0,
    };

    this.qualitySettings = this.getInitialQualitySettings();
  }

  static getInstance(): MobilePerformanceOptimizer {
    if (!MobilePerformanceOptimizer.instance) {
      MobilePerformanceOptimizer.instance = new MobilePerformanceOptimizer();
    }
    return MobilePerformanceOptimizer.instance;
  }

  /**
   * Initialize performance optimization
   */
  async initialize(): Promise<void> {
    try {
      // Check battery status
      await this.updateBatteryStatus();
      
      // Start performance monitoring
      this.startPerformanceMonitoring();
      
      // Setup adaptive quality if enabled
      if (this.config.enableAdaptiveQuality) {
        this.startAdaptiveQuality();
      }
      
      // Setup battery optimization
      if (this.config.enableBatteryOptimization) {
        this.startBatteryOptimization();
      }
      
      // Setup thermal management
      if (this.config.enableThermalManagement) {
        this.startThermalManagement();
      }
      
      errorHandler.info('Mobile performance optimizer initialized', this.config);
    } catch (error) {
      errorHandler.error('Failed to initialize mobile performance optimizer', error as Error);
    }
  }

  /**
   * Update frame timing and calculate FPS
   */
  updateFrameMetrics(deltaTime: number): void {
    const currentTime = performance.now();
    
    if (this.lastFrameTime > 0) {
      const frameTime = currentTime - this.lastFrameTime;
      this.metrics.frameTime = frameTime;
      this.metrics.currentFPS = 1000 / frameTime;
      
      // Keep history for average calculation
      this.frameTimeHistory.push(frameTime);
      if (this.frameTimeHistory.length > 60) {
        this.frameTimeHistory.shift();
      }
      
      // Calculate average FPS
      const averageFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
      this.metrics.averageFPS = 1000 / averageFrameTime;
    }
    
    this.lastFrameTime = currentTime;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current quality settings
   */
  getQualitySettings(): QualitySettings {
    return { ...this.qualitySettings };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MobilePerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Apply configuration changes
    if (newConfig.enableAdaptiveQuality !== undefined) {
      if (newConfig.enableAdaptiveQuality) {
        this.startAdaptiveQuality();
      } else {
        this.stopAdaptiveQuality();
      }
    }
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    // Monitor memory usage
    if ('memory' in performance) {
      const memoryInfo = (performance as any).memory;
      this.metrics.memoryUsage = memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize;
    }

    // Monitor CPU usage (approximation)
    this.monitorCPUUsage();
  }

  /**
   * Monitor CPU usage (approximation based on frame timing)
   */
  private monitorCPUUsage(): void {
    const checkCPU = () => {
      if (this.frameTimeHistory.length > 10) {
        const recentFrames = this.frameTimeHistory.slice(-10);
        const averageFrameTime = recentFrames.reduce((a, b) => a + b, 0) / recentFrames.length;
        
        // Estimate CPU usage based on frame time vs target
        const targetFrameTime = 1000 / this.config.targetFPS;
        this.metrics.cpuUsage = Math.min(1, averageFrameTime / targetFrameTime);
      }
      
      setTimeout(checkCPU, 1000);
    };
    
    checkCPU();
  }

  /**
   * Start adaptive quality adjustment
   */
  private startAdaptiveQuality(): void {
    if (this.adaptiveQualityTimer) {
      clearInterval(this.adaptiveQualityTimer);
    }
    
    this.adaptiveQualityTimer = window.setInterval(() => {
      this.adjustQuality();
    }, 2000); // Check every 2 seconds
  }

  /**
   * Stop adaptive quality adjustment
   */
  private stopAdaptiveQuality(): void {
    if (this.adaptiveQualityTimer) {
      clearInterval(this.adaptiveQualityTimer);
      this.adaptiveQualityTimer = null;
    }
  }

  /**
   * Adjust quality based on performance metrics
   */
  private adjustQuality(): void {
    const { averageFPS, cpuUsage, memoryUsage, thermalState } = this.metrics;
    const targetFPS = this.config.targetFPS;
    
    let qualityChange = 0;
    
    // Performance-based adjustments
    if (averageFPS < targetFPS * 0.8) {
      qualityChange -= 1; // Reduce quality
    } else if (averageFPS > targetFPS * 0.95 && cpuUsage < 0.7) {
      qualityChange += 1; // Increase quality
    }
    
    // CPU usage adjustments
    if (cpuUsage > 0.9) {
      qualityChange -= 2;
    } else if (cpuUsage < 0.5) {
      qualityChange += 1;
    }
    
    // Memory usage adjustments
    if (memoryUsage > 0.8) {
      qualityChange -= 1;
    }
    
    // Thermal state adjustments
    if (thermalState === 'critical') {
      qualityChange -= 3;
    } else if (thermalState === 'serious') {
      qualityChange -= 2;
    } else if (thermalState === 'fair') {
      qualityChange -= 1;
    }
    
    // Battery level adjustments
    if (this.metrics.batteryLevel < 0.2) {
      qualityChange -= 2;
    } else if (this.metrics.batteryLevel < 0.5) {
      qualityChange -= 1;
    }
    
    // Apply quality changes
    if (qualityChange !== 0) {
      this.applyQualityChange(qualityChange);
    }
  }

  /**
   * Apply quality adjustments
   */
  private applyQualityChange(change: number): void {
    const settings = { ...this.qualitySettings };
    
    if (change < 0) {
      // Reduce quality
      settings.particleCount = Math.max(1000, settings.particleCount * 0.8);
      settings.renderScale = Math.max(0.3, settings.renderScale * 0.9);
      settings.audioAnalysisRate = Math.max(10, settings.audioAnalysisRate * 0.8);
      
      if (settings.effectComplexity === 'high') {
        settings.effectComplexity = 'medium';
      } else if (settings.effectComplexity === 'medium') {
        settings.effectComplexity = 'low';
      }
      
      settings.enablePostProcessing = false;
      settings.enableShadows = false;
      settings.enableReflections = false;
    } else {
      // Increase quality
      settings.particleCount = Math.min(this.config.maxParticles, settings.particleCount * 1.2);
      settings.renderScale = Math.min(1.0, settings.renderScale * 1.1);
      settings.audioAnalysisRate = Math.min(60, settings.audioAnalysisRate * 1.2);
      
      if (settings.effectComplexity === 'low') {
        settings.effectComplexity = 'medium';
      } else if (settings.effectComplexity === 'medium') {
        settings.effectComplexity = 'high';
      }
      
      settings.enablePostProcessing = true;
      settings.enableShadows = true;
      settings.enableReflections = true;
    }
    
    this.qualitySettings = settings;
    
    errorHandler.info('Quality adjusted', {
      change,
      newSettings: settings,
      metrics: this.metrics,
    });
  }

  /**
   * Start battery optimization
   */
  private startBatteryOptimization(): void {
    if (this.batteryCheckTimer) {
      clearInterval(this.batteryCheckTimer);
    }
    
    this.batteryCheckTimer = window.setInterval(() => {
      this.updateBatteryStatus();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Update battery status
   */
  private async updateBatteryStatus(): Promise<void> {
    try {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        this.metrics.batteryLevel = battery.level;
        
        // Enable low power mode if battery is low
        if (battery.level < 0.2 && !this.config.lowPowerMode) {
          this.enableLowPowerMode();
        } else if (battery.level > 0.5 && this.config.lowPowerMode) {
          this.disableLowPowerMode();
        }
      }
    } catch (error) {
      // Battery API not available
    }
  }

  /**
   * Start thermal management
   */
  private startThermalManagement(): void {
    // Monitor CPU usage as thermal indicator
    const checkThermal = () => {
      const { cpuUsage, averageFPS } = this.metrics;
      
      // Estimate thermal state based on performance
      if (cpuUsage > 0.95 && averageFPS < this.config.targetFPS * 0.5) {
        this.metrics.thermalState = 'critical';
      } else if (cpuUsage > 0.9 && averageFPS < this.config.targetFPS * 0.7) {
        this.metrics.thermalState = 'serious';
      } else if (cpuUsage > 0.8 && averageFPS < this.config.targetFPS * 0.8) {
        this.metrics.thermalState = 'fair';
      } else {
        this.metrics.thermalState = 'nominal';
      }
      
      setTimeout(checkThermal, 5000);
    };
    
    checkThermal();
  }

  /**
   * Enable low power mode
   */
  private enableLowPowerMode(): void {
    this.config.lowPowerMode = true;
    this.config.targetFPS = 30;
    
    // Reduce quality settings
    this.qualitySettings.particleCount = Math.max(1000, this.qualitySettings.particleCount * 0.5);
    this.qualitySettings.renderScale = Math.max(0.3, this.qualitySettings.renderScale * 0.7);
    this.qualitySettings.effectComplexity = 'low';
    this.qualitySettings.enablePostProcessing = false;
    this.qualitySettings.enableShadows = false;
    this.qualitySettings.enableReflections = false;
    
    errorHandler.info('Low power mode enabled');
  }

  /**
   * Disable low power mode
   */
  private disableLowPowerMode(): void {
    this.config.lowPowerMode = false;
    
    const deviceInfo = iosDetector.detectDevice();
    this.config.targetFPS = deviceInfo.performanceProfile === 'high' ? 60 : 30;
    
    // Restore quality settings
    this.qualitySettings = this.getInitialQualitySettings();
    
    errorHandler.info('Low power mode disabled');
  }

  /**
   * Get initial quality settings based on device
   */
  private getInitialQualitySettings(): QualitySettings {
    const deviceInfo = iosDetector.detectDevice();
    const recommendations = iosDetector.getRecommendedSettings();
    
    switch (deviceInfo.performanceProfile) {
      case 'high':
        return {
          particleCount: recommendations.maxParticles,
          renderScale: 1.0,
          effectComplexity: 'high',
          audioAnalysisRate: 60,
          enablePostProcessing: true,
          enableShadows: true,
          enableReflections: true,
        };
      
      case 'medium':
        return {
          particleCount: Math.floor(recommendations.maxParticles * 0.7),
          renderScale: 0.8,
          effectComplexity: 'medium',
          audioAnalysisRate: 30,
          enablePostProcessing: true,
          enableShadows: false,
          enableReflections: false,
        };
      
      case 'low':
      default:
        return {
          particleCount: Math.floor(recommendations.maxParticles * 0.5),
          renderScale: 0.6,
          effectComplexity: 'low',
          audioAnalysisRate: 15,
          enablePostProcessing: false,
          enableShadows: false,
          enableReflections: false,
        };
    }
  }

  /**
   * Force quality preset
   */
  setQualityPreset(preset: 'low' | 'medium' | 'high'): void {
    const deviceInfo = iosDetector.detectDevice();
    const recommendations = iosDetector.getRecommendedSettings();
    
    switch (preset) {
      case 'low':
        this.qualitySettings = {
          particleCount: 10000,
          renderScale: 0.5,
          effectComplexity: 'low',
          audioAnalysisRate: 15,
          enablePostProcessing: false,
          enableShadows: false,
          enableReflections: false,
        };
        break;
      
      case 'medium':
        this.qualitySettings = {
          particleCount: 50000,
          renderScale: 0.7,
          effectComplexity: 'medium',
          audioAnalysisRate: 30,
          enablePostProcessing: true,
          enableShadows: false,
          enableReflections: false,
        };
        break;
      
      case 'high':
        this.qualitySettings = {
          particleCount: recommendations.maxParticles,
          renderScale: 1.0,
          effectComplexity: 'high',
          audioAnalysisRate: 60,
          enablePostProcessing: true,
          enableShadows: true,
          enableReflections: true,
        };
        break;
    }
    
    errorHandler.info('Quality preset applied', { preset, settings: this.qualitySettings });
  }

  /**
   * Get performance recommendations
   */
  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const { averageFPS, cpuUsage, memoryUsage, batteryLevel, thermalState } = this.metrics;
    
    if (averageFPS < this.config.targetFPS * 0.8) {
      recommendations.push('Consider reducing particle count or visual effects');
    }
    
    if (cpuUsage > 0.9) {
      recommendations.push('CPU usage is high - try reducing audio analysis rate');
    }
    
    if (memoryUsage > 0.8) {
      recommendations.push('Memory usage is high - consider reducing buffer sizes');
    }
    
    if (batteryLevel < 0.2) {
      recommendations.push('Battery is low - enable low power mode');
    }
    
    if (thermalState === 'critical') {
      recommendations.push('Device is overheating - reduce quality settings');
    }
    
    return recommendations;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.adaptiveQualityTimer) {
      clearInterval(this.adaptiveQualityTimer);
    }
    
    if (this.batteryCheckTimer) {
      clearInterval(this.batteryCheckTimer);
    }
    
    this.frameTimeHistory = [];
    
    errorHandler.info('Mobile performance optimizer destroyed');
  }
}

// Export singleton instance
export const mobilePerformanceOptimizer = MobilePerformanceOptimizer.getInstance();