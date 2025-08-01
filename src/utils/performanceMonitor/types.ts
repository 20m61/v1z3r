/**
 * Performance Monitoring System - Type Definitions
 * Comprehensive types for V1Z3R performance monitoring and optimization
 */

// Core Performance Metrics Snapshot
export interface PerformanceSnapshot {
  timestamp: number;
  
  // Rendering Performance Metrics
  rendering: {
    fps: number;
    frameTimes: number[];      // Last 60 frame times
    droppedFrames: number;
    renderTime: number;        // Average render time in ms
    gpuTime?: number;          // GPU frame time (if available)
  };
  
  // Memory Usage Metrics
  memory: {
    heap: {
      used: number;
      total: number;
      limit: number;
    };
    gpu?: {
      used: number;
      total: number;
    };
    textures: number;
    geometries: number;
    materials: number;
  };
  
  // Audio Performance Metrics
  audio: {
    latency: number;
    bufferSize: number;
    underruns: number;
    contextState: AudioContextState;
    sampleRate: number;
  };
  
  // Mobile-specific Metrics
  mobile?: {
    battery?: {
      level: number;
      charging: boolean;
    };
    network?: {
      type: string;
      downlink?: number;
    };
    deviceMotion: boolean;
    touchLatency: number;
  };
  
  // User Experience Metrics
  ux: {
    inputLatency: number;
    loadTime: number;
    errorCount: number;
    interactionSuccess: number;
  };
}

// Performance History Management
export interface PerformanceHistory {
  entries: PerformanceSnapshot[];
  maxLength: number;
  timeRange: number; // milliseconds
}

// Performance Alert System
export interface PerformanceAlert {
  id: string;
  ruleId: string;
  type: 'fps_drop' | 'memory_leak' | 'audio_glitch' | 'battery_low' | 'latency_high';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  acknowledged: boolean;
  resolved: boolean;
  data?: any;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: keyof PerformanceSnapshot | string;
  threshold: number;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  severity: 'info' | 'warning' | 'critical';
  duration: number; // milliseconds
  enabled: boolean;
  description: string;
}

// Performance Thresholds Configuration
export interface PerformanceThresholds {
  fps: {
    critical: number;
    warning: number;
    target: number;
  };
  memory: {
    critical: number; // % of available memory
    warning: number;
  };
  audio: {
    latency: {
      critical: number; // milliseconds
      warning: number;
    };
    underruns: {
      critical: number;
      warning: number;
    };
  };
  mobile?: {
    battery: {
      critical: number; // % battery level
      warning: number;
    };
    touchLatency: {
      critical: number; // milliseconds
      warning: number;
    };
  };
}

// Metric Collector Interface
export interface MetricCollector {
  name: string;
  enabled: boolean;
  collect(): Promise<Partial<PerformanceSnapshot>>;
  initialize?(): Promise<void>;
  cleanup?(): void;
}

// Collector Configuration
export interface CollectorConfig {
  name: string;
  enabled: boolean;
  options?: Record<string, any>;
}

// Performance Monitor Configuration
export interface PerformanceMonitorConfig {
  updateInterval: number;        // Default: 1000ms
  historyLength: number;         // Default: 300 samples (5 minutes)
  enableAutoOptimization: boolean; // Default: true
  thresholds: PerformanceThresholds;
  collectors: CollectorConfig[];
}

// Device Capability Detection
export interface DeviceCapabilities {
  webgl: boolean;
  webgpu: boolean;
  audioContext: boolean;
  offscreenCanvas: boolean;
  webWorkers: boolean;
  memoryInfo: boolean;
  deviceMemory?: number;
  hardwareConcurrency: number;
}

export interface DeviceConstraints {
  maxTextureSize: number;
  maxRenderTargets: number;
  maxVertexAttributes: number;
  audioLatencyConstraint: number;
  memoryConstraint: number;
}

export type DeviceTier = 'low' | 'mid' | 'high';

// Quality Profile System
export interface QualityProfile {
  name: string;
  renderScale: number;        // 0.5 - 2.0
  particleCount: number;      // Max particles
  effectComplexity: number;   // 1-5 complexity level
  fpsTarget: number;          // Target FPS
  audioLatency: number;       // Audio buffer size
}

// Metrics Subscription Callback
export type MetricsCallback = (metrics: PerformanceSnapshot, alerts: PerformanceAlert[]) => void;
export type MetricsSubscriber = {
  callback: MetricsCallback;
  id: string;
};

// Performance Event Types
export interface PerformanceEvent {
  type: 'fps_drop' | 'memory_spike' | 'audio_glitch' | 'quality_change';
  timestamp: number;
  data: any;
  severity: 'info' | 'warning' | 'critical';
}

// Resource Usage Tracking
export interface ResourceUsage {
  textures: {
    count: number;
    memoryUsage: number;
  };
  geometries: {
    count: number;
    memoryUsage: number;
  };
  materials: {
    count: number;
    memoryUsage: number;
  };
  shaders: {
    count: number;
    compileTime: number;
  };
}

// GPU Memory Information
export interface GPUMemoryInfo {
  used: number;
  total: number;
  available: number;
  textureMemory: number;
  bufferMemory: number;
}

// Audio Performance Metrics
export interface AudioMetrics {
  latency: number;
  bufferSize: number;
  underruns: number;
  contextState: AudioContextState;
  sampleRate: number;
  processingTime?: number;
}

// Rendering Performance Metrics
export interface RenderingMetrics {
  fps: number;
  frameTimes: number[];
  droppedFrames: number;
  renderTime: number;
  gpuTime?: number;
  drawCalls?: number;
  triangles?: number;
}

// Memory Performance Metrics
export interface MemoryMetrics {
  heap: {
    used: number;
    total: number;
    limit: number;
  };
  gpu?: GPUMemoryInfo;
  textures: number;
  geometries: number;
  materials: number;
}

// Mobile Performance Metrics
export interface MobileMetrics {
  battery?: {
    level: number;
    charging: boolean;
  };
  network?: {
    type: string;
    downlink?: number;
  };
  deviceMotion: boolean;
  touchLatency: number;
  orientation?: string;
}

// Default Configuration Constants
export const DEFAULT_CONFIG: PerformanceMonitorConfig = {
  updateInterval: 1000,
  historyLength: 300,
  enableAutoOptimization: true,
  thresholds: {
    fps: {
      critical: 20,
      warning: 30,
      target: 60,
    },
    memory: {
      critical: 90,
      warning: 75,
    },
    audio: {
      latency: {
        critical: 200,
        warning: 100,
      },
      underruns: {
        critical: 10,
        warning: 5,
      },
    },
    mobile: {
      battery: {
        critical: 10,
        warning: 20,
      },
      touchLatency: {
        critical: 100,
        warning: 50,
      },
    },
  },
  collectors: [
    { name: 'rendering', enabled: true },
    { name: 'memory', enabled: true },
    { name: 'audio', enabled: true },
    { name: 'mobile', enabled: true },
  ],
};

// Quality Profile Presets
export const QUALITY_PROFILES: Record<string, QualityProfile> = {
  potato: {
    name: 'Ultra Low',
    renderScale: 0.5,
    particleCount: 100,
    effectComplexity: 1,
    fpsTarget: 30,
    audioLatency: 512,
  },
  low: {
    name: 'Low',
    renderScale: 0.75,
    particleCount: 500,
    effectComplexity: 2,
    fpsTarget: 45,
    audioLatency: 256,
  },
  medium: {
    name: 'Medium',
    renderScale: 1.0,
    particleCount: 1000,
    effectComplexity: 3,
    fpsTarget: 60,
    audioLatency: 128,
  },
  high: {
    name: 'High',
    renderScale: 1.25,
    particleCount: 2000,
    effectComplexity: 4,
    fpsTarget: 60,
    audioLatency: 64,
  },
  ultra: {
    name: 'Ultra',
    renderScale: 1.5,
    particleCount: 5000,
    effectComplexity: 5,
    fpsTarget: 60,
    audioLatency: 32,
  },
};

// Alert Rule Presets
export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'fps-critical',
    name: 'Critical FPS Drop',
    metric: 'rendering.fps',
    threshold: 20,
    operator: 'lt',
    severity: 'critical',
    duration: 5000,
    enabled: true,
    description: 'FPS dropped below 20 for more than 5 seconds',
  },
  {
    id: 'fps-warning',
    name: 'FPS Warning',
    metric: 'rendering.fps',
    threshold: 30,
    operator: 'lt',
    severity: 'warning',
    duration: 10000,
    enabled: true,
    description: 'FPS dropped below 30 for more than 10 seconds',
  },
  {
    id: 'memory-critical',
    name: 'Critical Memory Usage',
    metric: 'memory.heap.used',
    threshold: 500 * 1024 * 1024, // 500MB
    operator: 'gt',
    severity: 'critical',
    duration: 30000,
    enabled: true,
    description: 'Memory usage above 500MB for more than 30 seconds',
  },
  {
    id: 'audio-latency-critical',
    name: 'Critical Audio Latency',
    metric: 'audio.latency',
    threshold: 200,
    operator: 'gt',
    severity: 'critical',
    duration: 15000,
    enabled: true,
    description: 'Audio latency above 200ms for more than 15 seconds',
  },
  {
    id: 'battery-low',
    name: 'Low Battery Warning',
    metric: 'mobile.battery.level',
    threshold: 20,
    operator: 'lt',
    severity: 'warning',
    duration: 5000,
    enabled: true,
    description: 'Battery level below 20%',
  },
];