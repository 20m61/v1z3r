/**
 * Enhanced Performance Monitor Mock System for Testing
 * Provides realistic performance monitoring behavior simulation
 */

import { PerformanceSnapshot, PerformanceAlert, QualityProfile } from '../performanceMonitor/types';

export interface PerformanceMonitorMockConfig {
  fps?: number;
  memoryUsage?: number;
  audioLatency?: number;
  simulateAlerts?: boolean;
  alertThresholds?: {
    fps?: number;
    memory?: number;
    audio?: number;
  };
  variability?: boolean;
  asyncDelay?: number;
}

export class MockPerformanceMonitor {
  private config: PerformanceMonitorMockConfig;
  private running: boolean = false;
  private history: PerformanceSnapshot[] = [];
  private alerts: PerformanceAlert[] = [];
  private subscribers: Array<(metrics: PerformanceSnapshot, alerts: PerformanceAlert[]) => void> = [];
  private intervalId?: NodeJS.Timeout;
  private collectors: Map<string, any> = new Map();

  constructor(config: PerformanceMonitorMockConfig = {}) {
    this.config = {
      fps: 60,
      memoryUsage: 100 * 1024 * 1024, // 100MB
      audioLatency: 20,
      simulateAlerts: false,
      alertThresholds: {
        fps: 30,
        memory: 800 * 1024 * 1024, // 800MB
        audio: 100
      },
      variability: true,
      asyncDelay: 0,
      ...config
    };
  }

  async start(): Promise<void> {
    if (this.running) return;

    if (this.config.asyncDelay) {
      await new Promise(resolve => setTimeout(resolve, this.config.asyncDelay));
    }

    this.running = true;

    // Start simulated metrics collection
    this.intervalId = setInterval(() => {
      this.collectSimulatedMetrics();
    }, 100);

    // Initial collection
    this.collectSimulatedMetrics();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  getMetrics(): PerformanceSnapshot | null {
    if (this.history.length === 0) {
      return null;
    }
    return this.history[this.history.length - 1];
  }

  getHistory(): { entries: PerformanceSnapshot[]; maxLength: number; timeRange: number } {
    return {
      entries: [...this.history],
      maxLength: 100,
      timeRange: 100 * 1000 // 100 seconds
    };
  }

  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  subscribe(callback: (metrics: PerformanceSnapshot, alerts: PerformanceAlert[]) => void): () => void {
    this.subscribers.push(callback);
    
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  addAlert(rule: any): void {
    // Mock alert rule addition
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.timestamp = Date.now();
    }
  }

  addCollector(collector: any): void {
    this.collectors.set(collector.name, collector);
  }

  removeCollector(name: string): void {
    this.collectors.delete(name);
  }

  integrateWithStore(store: any): void {
    this.subscribe((metrics, alerts) => {
      if (store.setState) {
        const updateData: any = {
          performanceMetrics: metrics,
          performanceAlerts: alerts,
        };

        // Auto-show dashboard on critical alerts
        const criticalAlerts = alerts.filter(alert => 
          alert.severity === 'critical' && !alert.acknowledged
        );

        if (criticalAlerts.length > 0) {
          updateData.showPerformanceDashboard = true;
        }

        store.setState(updateData);
      }
    });
  }

  private collectSimulatedMetrics(): void {
    const timestamp = Date.now();

    // Create realistic metrics with optional variability
    let fps = this.config.fps!;
    let memoryUsage = this.config.memoryUsage!;
    let audioLatency = this.config.audioLatency!;

    if (this.config.variability) {
      fps += (Math.random() - 0.5) * 10; // ±5 FPS variation
      memoryUsage += (Math.random() - 0.5) * 50 * 1024 * 1024; // ±25MB variation
      audioLatency += (Math.random() - 0.5) * 10; // ±5ms variation
    }

    const snapshot: PerformanceSnapshot = {
      timestamp,
      rendering: {
        fps: Math.max(0, fps),
        frameTimes: Array(30).fill(1000 / fps),
        droppedFrames: fps < 50 ? Math.floor((60 - fps) / 10) : 0,
        renderTime: 1000 / fps * 0.8,
        gpuTime: 1000 / fps * 0.6,
      },
      memory: {
        heap: {
          used: Math.max(0, memoryUsage),
          total: memoryUsage * 1.5,
          limit: 1000 * 1024 * 1024, // 1GB limit
        },
        textures: 10 + Math.floor(memoryUsage / (10 * 1024 * 1024)),
        geometries: 5 + Math.floor(memoryUsage / (20 * 1024 * 1024)),
        materials: 3 + Math.floor(memoryUsage / (30 * 1024 * 1024)),
      },
      audio: {
        latency: Math.max(0, audioLatency),
        bufferSize: audioLatency < 50 ? 128 : 256,
        underruns: audioLatency > 80 ? Math.floor(audioLatency / 20) : 0,
        contextState: 'running' as const,
        sampleRate: 48000,
      },
      ux: {
        inputLatency: Math.max(5, audioLatency / 4),
        loadTime: 1000 + Math.random() * 2000,
        errorCount: 0,
        interactionSuccess: fps > 30 ? 95 + Math.random() * 5 : 70 + Math.random() * 20,
      }
    };

    // Store in history
    this.history.push(snapshot);
    if (this.history.length > 100) {
      this.history.shift();
    }

    // Generate alerts if enabled
    if (this.config.simulateAlerts) {
      this.generateAlerts(snapshot);
    }

    // Notify subscribers
    this.notifySubscribers(snapshot);
  }

  private generateAlerts(snapshot: PerformanceSnapshot): void {
    const thresholds = this.config.alertThresholds!;

    // FPS alert
    if (snapshot.rendering.fps < thresholds.fps!) {
      const existingAlert = this.alerts.find(a => 
        a.type === 'fps_drop' && !a.resolved
      );

      if (!existingAlert) {
        this.alerts.push({
          id: `fps-critical-${snapshot.timestamp}`,
          ruleId: 'fps-critical',
          type: 'fps_drop',
          severity: snapshot.rendering.fps < 20 ? 'critical' : 'warning',
          message: `${snapshot.rendering.fps < 20 ? 'Critical FPS Drop' : 'FPS Warning'}: rendering.fps = ${snapshot.rendering.fps.toFixed(0)} (threshold: ${thresholds.fps})`,
          timestamp: snapshot.timestamp,
          acknowledged: false,
          resolved: false,
          data: {
            metric: 'rendering.fps',
            value: snapshot.rendering.fps,
            threshold: thresholds.fps,
            operator: 'lt'
          }
        });
      }
    }

    // Memory alert
    if (snapshot.memory.heap.used > thresholds.memory!) {
      const existingAlert = this.alerts.find(a => 
        a.type === 'memory_leak' && !a.resolved
      );

      if (!existingAlert) {
        this.alerts.push({
          id: `memory-leak-${snapshot.timestamp}`,
          ruleId: 'memory-critical',
          type: 'memory_leak',
          severity: snapshot.memory.heap.used > thresholds.memory! * 1.2 ? 'critical' : 'warning',
          message: `Memory Usage High: memory.heap.used = ${Math.floor(snapshot.memory.heap.used / 1024 / 1024)}MB (threshold: ${Math.floor(thresholds.memory! / 1024 / 1024)}MB)`,
          timestamp: snapshot.timestamp,
          acknowledged: false,
          resolved: false,
          data: {
            metric: 'memory.heap.used',
            value: snapshot.memory.heap.used,
            threshold: thresholds.memory,
            operator: 'gt'
          }
        });
      }
    }

    // Audio alert
    if (snapshot.audio.latency > thresholds.audio!) {
      const existingAlert = this.alerts.find(a => 
        a.type === 'audio_glitch' && !a.resolved
      );

      if (!existingAlert) {
        this.alerts.push({
          id: `audio-latency-${snapshot.timestamp}`,
          ruleId: 'audio-latency',
          type: 'audio_glitch',
          severity: snapshot.audio.latency > 150 ? 'critical' : 'warning',
          message: `High Audio Latency: audio.latency = ${snapshot.audio.latency.toFixed(0)}ms (threshold: ${thresholds.audio}ms)`,
          timestamp: snapshot.timestamp,
          acknowledged: false,
          resolved: false,
          data: {
            metric: 'audio.latency',
            value: snapshot.audio.latency,
            threshold: thresholds.audio,
            operator: 'gt'
          }
        });
      }
    }
  }

  private notifySubscribers(snapshot: PerformanceSnapshot): void {
    const activeAlerts = this.getActiveAlerts();
    this.subscribers.forEach(callback => {
      try {
        callback(snapshot, activeAlerts);
      } catch (error) {
        // Ignore subscriber errors in tests
      }
    });
  }
}

export class MockAdaptiveQualityManager {
  private currentProfile: QualityProfile;
  private enabled: boolean = true;

  constructor(
    private renderer?: any,
    private audioContext?: any,
    private store?: any
  ) {
    this.currentProfile = {
      name: 'Medium',
      particleCount: 1000,
      renderScale: 1.0,
      effectComplexity: 3,
      fpsTarget: 60,
      audioLatency: 128,
    };
  }

  processMetrics(metrics: PerformanceSnapshot): void {
    if (!this.enabled) return;

    // Simulate quality adaptation based on performance
    if (metrics.rendering.fps < 30 || metrics.memory.heap.used > 700 * 1024 * 1024) {
      this.setQualityProfile('low');
    } else if (metrics.rendering.fps > 50 && metrics.memory.heap.used < 300 * 1024 * 1024) {
      this.setQualityProfile('high');
    }
  }

  getCurrentProfile(): QualityProfile {
    return this.currentProfile;
  }

  setQualityProfile(profileName: string): void {
    const profiles: Record<string, QualityProfile> = {
      'low': {
        name: 'Low',
        particleCount: 500,
        renderScale: 0.75,
        effectComplexity: 1,
        fpsTarget: 30,
        audioLatency: 256,
      },
      'medium': {
        name: 'Medium',
        particleCount: 1000,
        renderScale: 1.0,
        effectComplexity: 3,
        fpsTarget: 60,
        audioLatency: 128,
      },
      'high': {
        name: 'High',
        particleCount: 2000,
        renderScale: 1.25,
        effectComplexity: 5,
        fpsTarget: 60,
        audioLatency: 64,
      }
    };

    this.currentProfile = profiles[profileName.toLowerCase()] || profiles.medium;

    if (this.store && this.store.setState) {
      this.store.setState({
        performanceProfile: this.currentProfile,
        maxParticles: this.currentProfile.particleCount,
        effectComplexity: this.currentProfile.effectComplexity,
        renderScale: this.currentProfile.renderScale,
        qualityLevel: this.currentProfile.name,
      });
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  getDeviceCapabilities(): any {
    return {
      hardwareConcurrency: navigator.hardwareConcurrency || 4,
      webgl: true,
      webgpu: 'gpu' in navigator,
      deviceMemory: 8 * 1024 * 1024 * 1024, // 8GB
      maxTextureSize: 4096,
    };
  }
}

/**
 * Setup comprehensive performance monitor mocks
 */
export function setupPerformanceMonitorMocks(config: PerformanceMonitorMockConfig = {}): {
  mockMonitor: MockPerformanceMonitor;
  mockQualityManager: MockAdaptiveQualityManager;
} {
  // Mock performance.memory if not available
  if (typeof performance !== 'undefined' && !(performance as any).memory) {
    Object.defineProperty(performance, 'memory', {
      value: {
        usedJSHeapSize: config.memoryUsage || 100 * 1024 * 1024,
        totalJSHeapSize: (config.memoryUsage || 100 * 1024 * 1024) * 1.5,
        jsHeapSizeLimit: 1000 * 1024 * 1024,
      },
      configurable: true,
      writable: true,
    });
  }

  const mockMonitor = new MockPerformanceMonitor(config);
  const mockQualityManager = new MockAdaptiveQualityManager();

  return { mockMonitor, mockQualityManager };
}

/**
 * Create performance scenario for specific test cases
 */
export function createPerformanceScenario(scenario: string): PerformanceMonitorMockConfig {
  switch (scenario) {
    case 'poor-performance':
      return {
        fps: 15,
        memoryUsage: 850 * 1024 * 1024,
        audioLatency: 120,
        simulateAlerts: true,
        variability: true
      };
    
    case 'good-performance':
      return {
        fps: 60,
        memoryUsage: 200 * 1024 * 1024,
        audioLatency: 20,
        simulateAlerts: false,
        variability: false
      };
    
    case 'variable-performance':
      return {
        fps: 45,
        memoryUsage: 400 * 1024 * 1024,
        audioLatency: 60,
        simulateAlerts: true,
        variability: true
      };
    
    case 'memory-pressure':
      return {
        fps: 50,
        memoryUsage: 900 * 1024 * 1024,
        audioLatency: 40,
        simulateAlerts: true,
        alertThresholds: {
          memory: 800 * 1024 * 1024
        }
      };
    
    case 'slow-start':
      return {
        fps: 60,
        memoryUsage: 100 * 1024 * 1024,
        audioLatency: 20,
        asyncDelay: 200,
        simulateAlerts: false
      };
    
    default:
      return {};
  }
}