/**
 * Enhanced Performance Monitor for Production Optimization
 * Tracks Core Web Vitals, custom metrics, and real-time performance
 */

import { useState, useEffect } from 'react';
import { errorHandler } from './errorHandler';

export interface CoreWebVitals {
  LCP: number;  // Largest Contentful Paint
  FID: number;  // First Input Delay  
  CLS: number;  // Cumulative Layout Shift
  FCP: number;  // First Contentful Paint
  TTFB: number; // Time to First Byte
}

export interface CustomMetrics {
  webglInitTime: number;
  audioContextDelay: number;
  effectSwitchTime: number;
  memoryUsage: number;
  frameRate: number;
  bundleLoadTime: number;
  stateUpdateTime: number;
  websocketLatency: number;
  // WebGPU/WebGL specific metrics
  webgpuSupported?: boolean;
  webgpuInitTime?: number;
  renderMode?: 'webgpu' | 'webgl' | 'fallback';
  renderModeStats?: { webgpu: number; webgl: number; fallback: number };
  textureUploadTime?: number;
  particleCount?: number;
  shaderCompilationTimes?: Record<string, number>;
  // Mobile-specific metrics
  isMobileDevice?: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  orientationChangeTime?: number;
  touchResponseTime?: number;
  batteryLevel?: number;
  batteryCharging?: boolean;
  offscreenCanvasFallback?: boolean;
  mobileOptimizationLevel?: 'low' | 'medium' | 'high';
  realFrameRate?: number; // Actual measured FPS vs target FPS
  memoryPressure?: boolean;
}

export interface PerformanceMetrics extends CoreWebVitals, CustomMetrics {
  timestamp: number;
  userAgent: string;
  viewport: { width: number; height: number };
  connection?: {
    effectiveType: string;
    downlink: number;
    rtt: number;
  };
}

export class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private observers: Map<string, PerformanceObserver> = new Map();
  private frameRateCounter: { count: number; startTime: number } = { count: 0, startTime: 0 };
  private memoryCheckInterval?: NodeJS.Timeout;
  private callbacks: Array<(metrics: PerformanceMetrics) => void> = [];

  constructor(private config: {
    enableCoreWebVitals?: boolean;
    enableCustomMetrics?: boolean;
    enableRealTimeMonitoring?: boolean;
    reportingInterval?: number;
    enableDebugMode?: boolean;
  } = {}) {
    this.config = {
      enableCoreWebVitals: true,
      enableCustomMetrics: true,
      enableRealTimeMonitoring: true,
      reportingInterval: 10000, // 10 seconds
      enableDebugMode: false,
      ...config,
    };

    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize(): void {
    if (this.config.enableCoreWebVitals) {
      this.setupCoreWebVitals();
    }

    if (this.config.enableCustomMetrics) {
      this.setupCustomMetrics();
    }

    if (this.config.enableRealTimeMonitoring) {
      this.startRealTimeMonitoring();
    }

    // Setup base metrics
    this.metrics.timestamp = performance.now();
    this.metrics.userAgent = navigator.userAgent;
    this.metrics.viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    // Network information if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      this.metrics.connection = {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
      };
    }
  }

  private setupCoreWebVitals(): void {
    // Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        this.metrics.LCP = lastEntry.renderTime || lastEntry.loadTime;
        this.debugLog('LCP:', this.metrics.LCP);
      });

      try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.set('lcp', lcpObserver);
      } catch (e) {
        console.warn('LCP observer not supported');
      }

      // First Contentful Paint
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.metrics.FCP = lastEntry.startTime;
        this.debugLog('FCP:', this.metrics.FCP);
      });

      try {
        fcpObserver.observe({ entryTypes: ['paint'] });
        this.observers.set('fcp', fcpObserver);
      } catch (e) {
        console.warn('FCP observer not supported');
      }

      // Cumulative Layout Shift
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        this.metrics.CLS = clsValue;
        this.debugLog('CLS:', this.metrics.CLS);
      });

      try {
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.set('cls', clsObserver);
      } catch (e) {
        console.warn('CLS observer not supported');
      }
    }

    // First Input Delay
    if ('addEventListener' in window) {
      const measureFID = (event: Event) => {
        this.metrics.FID = performance.now() - (event as any).timeStamp;
        this.debugLog('FID:', this.metrics.FID);
        // Remove listener after first interaction
        ['mousedown', 'keydown', 'touchstart', 'pointerdown'].forEach(type => {
          window.removeEventListener(type, measureFID);
        });
      };

      ['mousedown', 'keydown', 'touchstart', 'pointerdown'].forEach(type => {
        window.addEventListener(type, measureFID, { once: true, passive: true });
      });
    }

    // Time to First Byte
    if ('PerformanceNavigationTiming' in window) {
      window.addEventListener('load', () => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        this.metrics.TTFB = navigation.responseStart - navigation.requestStart;
        this.debugLog('TTFB:', this.metrics.TTFB);
      });
    }
  }

  private setupCustomMetrics(): void {
    // WebGL initialization time
    this.measureWebGLInit();
    
    // Audio context delay
    this.measureAudioContextDelay();
    
    // Bundle load time
    this.measureBundleLoadTime();
  }

  private startRealTimeMonitoring(): void {
    // Frame rate monitoring
    this.startFrameRateMonitoring();
    
    // Memory usage monitoring
    if ('memory' in performance) {
      this.memoryCheckInterval = setInterval(() => {
        const memory = (performance as any).memory;
        this.metrics.memoryUsage = memory.usedJSHeapSize;
        this.debugLog('Memory:', this.metrics.memoryUsage);
      }, 1000);
    }

    // Periodic reporting
    if (this.config.reportingInterval) {
      setInterval(() => {
        this.reportMetrics();
      }, this.config.reportingInterval);
    }
  }

  private startFrameRateMonitoring(): void {
    this.frameRateCounter.startTime = performance.now();
    
    const measureFrame = () => {
      this.frameRateCounter.count++;
      const elapsed = performance.now() - this.frameRateCounter.startTime;
      
      if (elapsed >= 1000) { // Calculate FPS every second
        this.metrics.frameRate = Math.round((this.frameRateCounter.count * 1000) / elapsed);
        this.frameRateCounter.count = 0;
        this.frameRateCounter.startTime = performance.now();
        this.debugLog('FPS:', this.metrics.frameRate);
      }
      
      requestAnimationFrame(measureFrame);
    };
    
    requestAnimationFrame(measureFrame);
  }

  // Custom measurement methods
  public measureWebGLInit(): void {
    const startTime = performance.now();
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    
    if (gl) {
      this.metrics.webglInitTime = performance.now() - startTime;
      this.debugLog('WebGL Init Time:', this.metrics.webglInitTime);
    }
  }

  public measureAudioContextDelay(): void {
    const startTime = performance.now();
    try {
      const audioContext = new AudioContext();
      audioContext.resume().then(() => {
        this.metrics.audioContextDelay = performance.now() - startTime;
        this.debugLog('Audio Context Delay:', this.metrics.audioContextDelay);
        audioContext.close();
      });
    } catch (e) {
      console.warn('AudioContext measurement failed:', e);
    }
  }

  public measureBundleLoadTime(): void {
    if ('PerformanceResourceTiming' in window) {
      window.addEventListener('load', () => {
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const jsResources = resources.filter(r => r.name.includes('.js'));
        const totalLoadTime = jsResources.reduce((sum, resource) => {
          return sum + (resource.responseEnd - resource.requestStart);
        }, 0);
        
        this.metrics.bundleLoadTime = totalLoadTime;
        this.debugLog('Bundle Load Time:', this.metrics.bundleLoadTime);
      });
    }
  }

  public measureEffectSwitchTime(effectName: string): () => void {
    const startTime = performance.now();
    return () => {
      this.metrics.effectSwitchTime = performance.now() - startTime;
      this.debugLog(`Effect Switch Time (${effectName}):`, this.metrics.effectSwitchTime);
    };
  }

  public measureStateUpdateTime(): () => void {
    const startTime = performance.now();
    return () => {
      this.metrics.stateUpdateTime = performance.now() - startTime;
      this.debugLog('State Update Time:', this.metrics.stateUpdateTime);
    };
  }

  public measureWebSocketLatency(startTime: number): void {
    this.metrics.websocketLatency = performance.now() - startTime;
    this.debugLog('WebSocket Latency:', this.metrics.websocketLatency);
  }

  // WebGPU/WebGL specific monitoring
  public measureWebGPUSupport(): void {
    const startTime = performance.now();
    
    // Check WebGPU support
    if (navigator.gpu) {
      navigator.gpu.requestAdapter().then(adapter => {
        if (adapter) {
          this.metrics.webgpuSupported = true;
          this.metrics.webgpuInitTime = performance.now() - startTime;
          this.debugLog('WebGPU Supported - Init Time:', this.metrics.webgpuInitTime);
        } else {
          this.metrics.webgpuSupported = false;
          this.debugLog('WebGPU Not Supported');
        }
      }).catch(() => {
        this.metrics.webgpuSupported = false;
        this.debugLog('WebGPU Check Failed');
      });
    } else {
      this.metrics.webgpuSupported = false;
      this.debugLog('WebGPU Not Available');
    }
  }

  public recordRenderMode(mode: 'webgpu' | 'webgl' | 'fallback'): void {
    this.metrics.renderMode = mode;
    this.debugLog('Render Mode:', mode);
    
    // Track render mode usage
    if (!this.metrics.renderModeStats) {
      this.metrics.renderModeStats = { webgpu: 0, webgl: 0, fallback: 0 };
    }
    this.metrics.renderModeStats[mode]++;
    
    // Log performance warning if using fallback
    if (mode === 'fallback' || mode === 'webgl') {
      errorHandler.info('Using fallback rendering mode', { mode });
    }
  }

  public measureTextureUploadTime(textureSize: number): () => void {
    const startTime = performance.now();
    return () => {
      const uploadTime = performance.now() - startTime;
      this.metrics.textureUploadTime = uploadTime;
      this.debugLog(`Texture Upload (${textureSize}px):`, uploadTime);
      
      // Warn if texture upload is slow
      if (uploadTime > 50) {
        errorHandler.warn('Slow texture upload detected', new Error('Texture upload performance issue'), {
          uploadTime,
          textureSize
        });
      }
    };
  }

  public recordParticleCount(count: number): void {
    this.metrics.particleCount = count;
    this.debugLog('Particle Count:', count);
    
    // Warn if particle count is very high
    if (count > 100000) {
      errorHandler.warn('High particle count detected', new Error('Particle count performance issue'), { count });
    }
  }

  public measureShaderCompilationTime(shaderName: string): () => void {
    const startTime = performance.now();
    return () => {
      const compilationTime = performance.now() - startTime;
      if (!this.metrics.shaderCompilationTimes) {
        this.metrics.shaderCompilationTimes = {};
      }
      this.metrics.shaderCompilationTimes[shaderName] = compilationTime;
      this.debugLog(`Shader Compilation (${shaderName}):`, compilationTime);
      
      // Warn if shader compilation is slow
      if (compilationTime > 100) {
        errorHandler.warn('Slow shader compilation detected', new Error('Shader compilation performance issue'), {
          shaderName,
          compilationTime
        });
      }
    };
  }

  // Reporting and callbacks
  public onMetricsUpdate(callback: (metrics: PerformanceMetrics) => void): void {
    this.callbacks.push(callback);
  }

  private reportMetrics(): void {
    const completeMetrics = this.getMetrics();
    this.callbacks.forEach(callback => callback(completeMetrics));
    
    if (this.config.enableDebugMode) {
      console.table(completeMetrics);
    }
  }

  public getMetrics(): PerformanceMetrics {
    return {
      ...this.metrics,
      timestamp: performance.now(),
    } as PerformanceMetrics;
  }

  public getCoreWebVitals(): CoreWebVitals {
    return {
      LCP: this.metrics.LCP || 0,
      FID: this.metrics.FID || 0,
      CLS: this.metrics.CLS || 0,
      FCP: this.metrics.FCP || 0,
      TTFB: this.metrics.TTFB || 0,
    };
  }

  public getCustomMetrics(): CustomMetrics {
    return {
      webglInitTime: this.metrics.webglInitTime || 0,
      audioContextDelay: this.metrics.audioContextDelay || 0,
      effectSwitchTime: this.metrics.effectSwitchTime || 0,
      memoryUsage: this.metrics.memoryUsage || 0,
      frameRate: this.metrics.frameRate || 0,
      bundleLoadTime: this.metrics.bundleLoadTime || 0,
      stateUpdateTime: this.metrics.stateUpdateTime || 0,
      websocketLatency: this.metrics.websocketLatency || 0,
      // Mobile-specific metrics
      isMobileDevice: this.metrics.isMobileDevice,
      deviceMemory: this.metrics.deviceMemory,
      hardwareConcurrency: this.metrics.hardwareConcurrency,
      orientationChangeTime: this.metrics.orientationChangeTime,
      touchResponseTime: this.metrics.touchResponseTime,
      batteryLevel: this.metrics.batteryLevel,
      batteryCharging: this.metrics.batteryCharging,
      offscreenCanvasFallback: this.metrics.offscreenCanvasFallback,
      mobileOptimizationLevel: this.metrics.mobileOptimizationLevel,
      realFrameRate: this.metrics.realFrameRate,
      memoryPressure: this.metrics.memoryPressure,
    };
  }

  // Mobile-specific performance methods
  public initializeMobileMetrics(): void {
    this.metrics.isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (!this.metrics.isMobileDevice) return;

    // Device memory (Chrome only)
    if ('deviceMemory' in navigator) {
      this.metrics.deviceMemory = (navigator as any).deviceMemory;
    }

    // Hardware concurrency
    this.metrics.hardwareConcurrency = navigator.hardwareConcurrency || 1;

    // Battery status (if available)
    this.initializeBatteryMonitoring();

    // Touch response monitoring
    this.initializeTouchResponseMonitoring();

    // Orientation change monitoring
    this.initializeOrientationChangeMonitoring();

    // Memory pressure detection
    this.initializeMemoryPressureDetection();

    // Determine mobile optimization level
    this.determineMobileOptimizationLevel();
  }

  private async initializeBatteryMonitoring(): Promise<void> {
    try {
      // @ts-ignore - Battery API is experimental
      if ('getBattery' in navigator) {
        // @ts-ignore
        const battery = await navigator.getBattery();
        this.metrics.batteryLevel = battery.level;
        this.metrics.batteryCharging = battery.charging;

        battery.addEventListener('levelchange', () => {
          this.metrics.batteryLevel = battery.level;
        });

        battery.addEventListener('chargingchange', () => {
          this.metrics.batteryCharging = battery.charging;
        });
      }
    } catch (error) {
      // Battery API not supported, ignore silently
    }
  }

  private initializeTouchResponseMonitoring(): void {
    let touchStartTime = 0;

    document.addEventListener('touchstart', () => {
      touchStartTime = performance.now();
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (touchStartTime > 0) {
        const responseTime = performance.now() - touchStartTime;
        this.metrics.touchResponseTime = responseTime;
        touchStartTime = 0;
      }
    }, { passive: true });
  }

  private initializeOrientationChangeMonitoring(): void {
    let orientationChangeStart = 0;

    window.addEventListener('orientationchange', () => {
      orientationChangeStart = performance.now();
    });

    // Use resize event to detect when orientation change is complete
    window.addEventListener('resize', () => {
      if (orientationChangeStart > 0) {
        const orientationChangeTime = performance.now() - orientationChangeStart;
        this.metrics.orientationChangeTime = orientationChangeTime;
        orientationChangeStart = 0;
      }
    });
  }

  private initializeMemoryPressureDetection(): void {
    // Monitor memory usage trends to detect memory pressure
    let memoryReadings: number[] = [];
    
    setInterval(() => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const currentUsage = memory.usedJSHeapSize;
        memoryReadings.push(currentUsage);

        // Keep only last 10 readings
        if (memoryReadings.length > 10) {
          memoryReadings = memoryReadings.slice(-10);
        }

        // Detect memory pressure (increasing trend + high usage)
        if (memoryReadings.length >= 5) {
          const recent = memoryReadings.slice(-5);
          const isIncreasing = recent.every((val, i) => i === 0 || val >= recent[i - 1]);
          const highUsage = currentUsage > memory.totalJSHeapSize * 0.8;
          
          this.metrics.memoryPressure = isIncreasing && highUsage;
        }
      }
    }, 2000);
  }

  private determineMobileOptimizationLevel(): void {
    const device = this.metrics;
    let score = 0;

    // Device memory score
    if (device.deviceMemory && device.deviceMemory >= 4) score += 2;
    else if (device.deviceMemory && device.deviceMemory >= 2) score += 1;

    // Hardware concurrency score  
    if (device.hardwareConcurrency && device.hardwareConcurrency >= 8) score += 2;
    else if (device.hardwareConcurrency && device.hardwareConcurrency >= 4) score += 1;

    // Battery level score (low battery = lower performance)
    if (device.batteryLevel && device.batteryLevel > 0.5) score += 1;

    // Determine optimization level
    if (score >= 4) {
      this.metrics.mobileOptimizationLevel = 'low'; // High-end device, minimal optimization
    } else if (score >= 2) {
      this.metrics.mobileOptimizationLevel = 'medium';
    } else {
      this.metrics.mobileOptimizationLevel = 'high'; // Low-end device, heavy optimization
    }
  }

  public measureOffscreenCanvasFallback(fallbackUsed: boolean): void {
    this.metrics.offscreenCanvasFallback = fallbackUsed;
  }

  public updateRealFrameRate(actualFps: number, targetFps: number): void {
    this.metrics.realFrameRate = actualFps;
    this.metrics.frameRate = actualFps; // Update the standard frameRate as well
    
    // Log performance gap if significant
    if (Math.abs(actualFps - targetFps) > 5) {
      this.debugLog(`FPS Gap: Target ${targetFps}, Actual ${actualFps}`);
    }
  }

  // Performance budgets
  public checkPerformanceBudgets(): {
    passed: boolean;
    violations: string[];
  } {
    const violations: string[] = [];
    const metrics = this.getMetrics();

    // Core Web Vitals thresholds (Google recommendations)
    if (metrics.LCP > 2500) violations.push(`LCP: ${metrics.LCP}ms (should be < 2500ms)`);
    if (metrics.FID > 100) violations.push(`FID: ${metrics.FID}ms (should be < 100ms)`);
    if (metrics.CLS > 0.1) violations.push(`CLS: ${metrics.CLS} (should be < 0.1)`);
    if (metrics.FCP > 1800) violations.push(`FCP: ${metrics.FCP}ms (should be < 1800ms)`);
    if (metrics.TTFB > 600) violations.push(`TTFB: ${metrics.TTFB}ms (should be < 600ms)`);

    // Custom thresholds
    if (metrics.frameRate < 30) violations.push(`FPS: ${metrics.frameRate} (should be > 30)`);
    if (metrics.memoryUsage > 200 * 1024 * 1024) violations.push(`Memory: ${(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB (should be < 200MB)`);
    if (metrics.effectSwitchTime > 100) violations.push(`Effect Switch: ${metrics.effectSwitchTime}ms (should be < 100ms)`);
    if (metrics.websocketLatency > 100) violations.push(`WebSocket Latency: ${metrics.websocketLatency}ms (should be < 100ms)`);

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  private debugLog(...args: any[]): void {
    if (this.config.enableDebugMode) {
      console.log('[Performance Monitor]', ...args);
    }
  }

  public dispose(): void {
    // Clear observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();

    // Clear intervals
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }

    // Clear callbacks
    this.callbacks = [];
  }
}

// Global instance
export const performanceMonitor = new PerformanceMonitor({
  enableDebugMode: process.env.NODE_ENV === 'development',
});

// React hook for performance monitoring
export function usePerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [budgetStatus, setBudgetStatus] = useState<{ passed: boolean; violations: string[] } | null>(null);

  useEffect(() => {
    const updateMetrics = (newMetrics: PerformanceMetrics) => {
      setMetrics(newMetrics);
      setBudgetStatus(performanceMonitor.checkPerformanceBudgets());
    };

    performanceMonitor.onMetricsUpdate(updateMetrics);

    return () => {
      performanceMonitor.dispose();
    };
  }, []);

  return {
    metrics,
    budgetStatus,
    measureEffectSwitch: performanceMonitor.measureEffectSwitchTime.bind(performanceMonitor),
    measureStateUpdate: performanceMonitor.measureStateUpdateTime.bind(performanceMonitor),
    getCoreWebVitals: performanceMonitor.getCoreWebVitals.bind(performanceMonitor),
    getCustomMetrics: performanceMonitor.getCustomMetrics.bind(performanceMonitor),
  };
}