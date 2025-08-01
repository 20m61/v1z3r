# Performance Monitor API Reference

## Overview

The V1Z3R Performance Monitoring System provides a comprehensive API for tracking and optimizing application performance in real-time. This document details all available classes, methods, and types.

---

## Core Classes

### PerformanceMonitor

The central class that orchestrates all performance monitoring activities.

```typescript
class PerformanceMonitor {
  constructor(config?: Partial<PerformanceMonitorConfig>)
  
  // Lifecycle methods
  start(): Promise<void>
  stop(): void
  
  // Metrics access
  getMetrics(): PerformanceSnapshot | null
  getHistory(duration?: number): PerformanceHistory
  
  // Collector management
  addCollector(collector: MetricCollector): void
  removeCollector(name: string): void
  
  // Alert management
  addAlert(rule: AlertRule): void
  removeAlert(id: string): void
  getActiveAlerts(): PerformanceAlert[]
  acknowledgeAlert(alertId: string): void
  resolveAlert(alertId: string): void
  
  // Subscription
  subscribe(callback: MetricsCallback): () => void
  
  // Store integration
  integrateWithStore(store: any): void
}
```

#### Configuration Options

```typescript
interface PerformanceMonitorConfig {
  updateInterval: number;        // Default: 1000ms
  historyLength: number;         // Default: 300 samples
  enableAutoOptimization: boolean; // Default: true
  thresholds: PerformanceThresholds;
  collectors: CollectorConfig[];
}
```

---

### AdaptiveQualityManager

Manages automatic quality adjustments based on performance metrics.

```typescript
class AdaptiveQualityManager {
  constructor(
    renderer?: any,
    audioContext?: AudioContext,
    store?: any
  )
  
  // Core methods
  processMetrics(metrics: PerformanceSnapshot): void
  getCurrentProfile(): QualityProfile
  setQualityProfile(profileName: string): void
  
  // Control methods
  setEnabled(enabled: boolean): void
  getDeviceTier(): DeviceTier
  getDeviceCapabilities(): DeviceCapabilities
  
  // Analysis methods
  getPerformanceGrade(): string
  getRecommendations(): string[]
  getAdaptationHistory(): AdaptationRecord[]
}
```

---

## Metric Collectors

### MetricCollector Interface

All collectors implement this base interface:

```typescript
interface MetricCollector {
  name: string;
  initialize(): Promise<void>;
  collect(): Promise<MetricData>;
  cleanup(): void;
}
```

### RenderingCollector

Collects frame rate and GPU performance metrics.

```typescript
class RenderingCollector implements MetricCollector {
  constructor(renderer?: any)
  
  // Manual frame tracking
  onFrameStart(): void
  onFrameEnd(): void
  
  // Metrics access
  getCurrentFPS(): number
  getAverageFPS(): number
  getFrameTimes(): number[]
}
```

### MemoryCollector

Monitors memory usage and detects leaks.

```typescript
class MemoryCollector implements MetricCollector {
  constructor(renderer?: any)
  
  // Leak detection
  checkForMemoryLeak(): boolean
  getMemoryTrend(): 'stable' | 'growing' | 'shrinking'
}
```

### AudioCollector

Tracks audio performance and latency.

```typescript
class AudioCollector implements MetricCollector {
  constructor(audioContext?: AudioContext)
  
  // Audio metrics
  getLatency(): number
  getUnderrunCount(): number
  getContextState(): AudioContextState
}
```

### MobileCollector

Collects mobile-specific metrics.

```typescript
class MobileCollector implements MetricCollector {
  constructor()
  
  // Mobile metrics
  getBatteryLevel(): Promise<number>
  isCharging(): Promise<boolean>
  getNetworkType(): string
  getTouchLatency(): number
}
```

---

## Data Types

### PerformanceSnapshot

Complete performance state at a point in time.

```typescript
interface PerformanceSnapshot {
  timestamp: number;
  
  rendering: {
    fps: number;
    frameTimes: number[];
    droppedFrames: number;
    renderTime: number;
    gpuTime?: number;
  };
  
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
  
  audio: {
    latency: number;
    bufferSize: number;
    underruns: number;
    contextState: AudioContextState;
    sampleRate: number;
  };
  
  mobile?: {
    battery?: {
      level: number;
      charging: boolean;
    };
    network?: {
      type: string;
      downlink: number;
      rtt: number;
    };
    deviceMotion: boolean;
    touchLatency: number;
  };
  
  ux: {
    inputLatency: number;
    loadTime: number;
    errorCount: number;
    interactionSuccess: number;
  };
}
```

### QualityProfile

Rendering quality configuration.

```typescript
interface QualityProfile {
  name: string;
  renderScale: number;        // 0.5 - 2.0
  particleCount: number;      // Max particles
  effectComplexity: number;   // 1-5 complexity level
  fpsTarget: number;          // Target FPS
  audioLatency: number;       // Audio buffer size
}
```

### PerformanceAlert

Alert information for performance issues.

```typescript
interface PerformanceAlert {
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
```

### AlertRule

Configuration for alert generation.

```typescript
interface AlertRule {
  id: string;
  name: string;
  metric: string;              // Dot notation path to metric
  threshold: number;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
  severity: 'info' | 'warning' | 'critical';
  duration: number;            // Milliseconds before triggering
}
```

---

## Store Integration

### Performance State

Properties added to Zustand store:

```typescript
interface PerformanceState {
  // Core objects
  performanceMonitor?: PerformanceMonitor;
  adaptiveQualityManager?: AdaptiveQualityManager;
  
  // Current state
  performanceMetrics?: PerformanceSnapshot;
  performanceAlerts: PerformanceAlert[];
  performanceProfile: QualityProfile;
  showPerformanceDashboard: boolean;
  
  // Settings
  performanceSettings: {
    enableAdaptiveQuality: boolean;
    alertThresholds: Record<string, number>;
    dashboardCompactMode: boolean;
  };
}
```

### Store Actions

```typescript
interface PerformanceActions {
  // Initialization
  initializePerformanceMonitoring: (renderer?: any) => Promise<void>;
  
  // Quality control
  setQualityProfile: (profileName: string) => void;
  toggleAdaptiveQuality: () => void;
  
  // Dashboard control
  togglePerformanceDashboard: () => void;
  setDashboardCompactMode: (compact: boolean) => void;
  
  // Alert management
  acknowledgePerformanceAlert: (alertId: string) => void;
  resolvePerformanceAlert: (alertId: string) => void;
  clearResolvedAlerts: () => void;
  
  // Settings
  updatePerformanceSettings: (settings: Partial<PerformanceSettings>) => void;
}
```

---

## Constants

### Quality Profiles

```typescript
const QUALITY_PROFILES = {
  potato: {
    name: 'Ultra Low',
    renderScale: 0.5,
    particleCount: 100,
    effectComplexity: 1,
    fpsTarget: 30,
    audioLatency: 512
  },
  low: { /* ... */ },
  medium: { /* ... */ },
  high: { /* ... */ },
  ultra: { /* ... */ }
};
```

### Default Alert Rules

```typescript
const DEFAULT_ALERT_RULES = [
  {
    id: 'fps-critical',
    name: 'Critical FPS Drop',
    metric: 'rendering.fps',
    threshold: 20,
    operator: 'lt',
    severity: 'critical',
    duration: 2000
  },
  {
    id: 'memory-warning',
    name: 'High Memory Usage',
    metric: 'memory.heap.used',
    threshold: 0.75, // 75% of limit
    operator: 'gt',
    severity: 'warning',
    duration: 5000
  },
  // ... more rules
];
```

---

## Usage Examples

### Basic Setup

```typescript
import { PerformanceMonitor } from '@/utils/performanceMonitor';

// Create and configure monitor
const monitor = new PerformanceMonitor({
  updateInterval: 1000,
  historyLength: 300,
  enableAutoOptimization: true
});

// Add collectors
monitor.addCollector(new RenderingCollector(renderer));
monitor.addCollector(new MemoryCollector());
monitor.addCollector(new AudioCollector(audioContext));

// Start monitoring
await monitor.start();
```

### Custom Alerts

```typescript
// Add custom alert rule
monitor.addAlert({
  id: 'particle-overload',
  name: 'Too Many Particles',
  metric: 'custom.particleCount',
  threshold: 10000,
  operator: 'gt',
  severity: 'warning',
  duration: 3000
});

// Subscribe to alerts
monitor.subscribe((metrics, alerts) => {
  const particleAlert = alerts.find(a => a.ruleId === 'particle-overload');
  if (particleAlert && !particleAlert.acknowledged) {
    console.warn('Particle count too high!');
  }
});
```

### Adaptive Quality

```typescript
// Create quality manager
const qualityManager = new AdaptiveQualityManager(
  renderer,
  audioContext,
  store
);

// Process metrics for adaptation
monitor.subscribe((metrics) => {
  qualityManager.processMetrics(metrics);
});

// Manual quality control
qualityManager.setQualityProfile('high');
qualityManager.setEnabled(false); // Disable auto-adaptation
```

### Store Integration

```typescript
// In your component
const Component = () => {
  const {
    performanceMetrics,
    performanceProfile,
    setQualityProfile,
    togglePerformanceDashboard
  } = useVisualizerStore();
  
  return (
    <div>
      <p>Current FPS: {performanceMetrics?.rendering.fps}</p>
      <p>Quality: {performanceProfile.name}</p>
      <button onClick={() => setQualityProfile('low')}>
        Low Quality
      </button>
      <button onClick={togglePerformanceDashboard}>
        Toggle Dashboard
      </button>
    </div>
  );
};
```

---

## Events

### Monitor Events

The PerformanceMonitor emits events through the subscription system:

```typescript
// Subscribe to all events
const unsubscribe = monitor.subscribe((metrics, alerts) => {
  // Called on every update interval
  console.log('Metrics updated:', metrics);
  console.log('Active alerts:', alerts);
});

// Unsubscribe when done
unsubscribe();
```

### Quality Change Events

Track quality adaptations:

```typescript
const history = qualityManager.getAdaptationHistory();
history.forEach(record => {
  console.log(`${record.timestamp}: ${record.fromProfile} → ${record.toProfile} (${record.reason})`);
});
```

---

## Error Handling

All methods include proper error handling:

```typescript
try {
  await monitor.start();
} catch (error) {
  console.error('Failed to start monitoring:', error);
  // Monitoring will continue without failed collectors
}

// Collectors handle errors gracefully
class CustomCollector implements MetricCollector {
  async collect() {
    try {
      // Collect metrics
    } catch (error) {
      console.error(`${this.name} collection failed:`, error);
      return { /* default values */ };
    }
  }
}
```

---

## Performance Considerations

- **Collection Overhead**: < 2ms per frame
- **Memory Usage**: ~10MB for 5 minutes of history
- **Update Frequency**: Configurable (default 1000ms)
- **History Limit**: Automatically pruned to prevent memory growth

---

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Mobile |
|---------|--------|---------|--------|--------|
| Basic Monitoring | ✅ | ✅ | ✅ | ✅ |
| Memory Metrics | ✅ | ⚠️ | ❌ | ⚠️ |
| GPU Metrics | ✅ | ⚠️ | ❌ | ❌ |
| Battery API | ✅ | ✅ | ❌ | ✅ |
| Network Info | ✅ | ❌ | ❌ | ✅ |

⚠️ = Partial support
❌ = Not supported (graceful fallback)

---

For implementation details, see the [source code](https://github.com/20m61/v1z3r/tree/main/src/utils/performanceMonitor).