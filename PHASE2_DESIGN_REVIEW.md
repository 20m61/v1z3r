# Phase 2: Performance Monitoring System - Design Review
## Comprehensive System Architecture & Implementation Plan
### August 1, 2025

---

## 🎯 Design Overview

### System Architecture
The Phase 2 Performance Monitoring System integrates with V1Z3R's existing architecture while adding comprehensive real-time monitoring and adaptive optimization capabilities.

```
┌─────────────────────────────────────────────────────────┐
│                V1Z3R Application                        │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐             │
│  │  Visual Engine  │  │   Audio Engine  │             │
│  │  (Three.js/GPU) │  │  (Web Audio)    │             │
│  └─────────────────┘  └─────────────────┘             │
├─────────────────────────────────────────────────────────┤
│           Performance Monitoring Layer                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │   Metrics    │ │  Dashboard   │ │  Optimizer   │   │
│  │  Collector   │ │    UI        │ │   Engine     │   │
│  └──────────────┘ └──────────────┘ └──────────────┘   │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐ │
│  │         Performance Monitor Core                    │ │
│  │  - Real-time data collection                       │ │
│  │  - Alert management                                │ │
│  │  - Historical data storage                         │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 🏗️ Component Design Specifications

### 1. Performance Monitor Core

#### Primary Interface
```typescript
// src/utils/performanceMonitor/core.ts
export interface PerformanceMonitorConfig {
  updateInterval: number;        // Default: 1000ms
  historyLength: number;         // Default: 300 samples (5 minutes)
  enableAutoOptimization: boolean; // Default: true
  thresholds: PerformanceThresholds;
  collectors: CollectorConfig[];
}

export class PerformanceMonitor {
  private config: PerformanceMonitorConfig;
  private collectors: Map<string, MetricCollector>;
  private history: PerformanceHistory;
  private subscribers: Set<MetricsSubscriber>;
  
  constructor(config: PerformanceMonitorConfig);
  
  // Core Methods
  start(): Promise<void>;
  stop(): void;
  getMetrics(): PerformanceSnapshot;
  getHistory(duration?: number): PerformanceHistory;
  subscribe(callback: MetricsCallback): () => void;
  
  // Alert Management
  addAlert(rule: AlertRule): void;
  removeAlert(id: string): void;
  getActiveAlerts(): PerformanceAlert[];
  
  // Integration
  integrateWithStore(store: any): void;
}
```

#### Metrics Data Structure
```typescript
// src/utils/performanceMonitor/types.ts
export interface PerformanceSnapshot {
  timestamp: number;
  
  // Rendering Metrics
  rendering: {
    fps: number;
    frameTimes: number[];      // Last 60 frame times
    droppedFrames: number;
    renderTime: number;        // Average render time
    gpuTime?: number;          // GPU frame time (if available)
  };
  
  // Memory Metrics
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
  
  // Audio Metrics
  audio: {
    latency: number;
    bufferSize: number;
    underruns: number;
    contextState: AudioContextState;
    sampleRate: number;
  };
  
  // Mobile Metrics
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
  
  // User Experience
  ux: {
    inputLatency: number;
    loadTime: number;
    errorCount: number;
    interactionSuccess: number;
  };
}
```

### 2. Metric Collectors

#### Rendering Performance Collector
```typescript
// src/utils/performanceMonitor/collectors/renderingCollector.ts
export class RenderingCollector implements MetricCollector {
  private frameStart: number = 0;
  private frameTimes: number[] = [];
  private droppedFrames: number = 0;
  
  constructor(private renderer: any) {}
  
  async collect(): Promise<RenderingMetrics> {
    const fps = this.calculateFPS();
    const renderTime = this.getAverageRenderTime();
    const gpuTime = await this.getGPUFrameTime();
    
    return {
      fps,
      frameTimes: [...this.frameTimes],
      droppedFrames: this.droppedFrames,
      renderTime,
      gpuTime
    };
  }
  
  onFrameStart(): void {
    this.frameStart = performance.now();
  }
  
  onFrameEnd(): void {
    const frameTime = performance.now() - this.frameStart;
    this.frameTimes.push(frameTime);
    
    // Keep only last 60 frames
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift();
    }
    
    // Detect dropped frames (>16.67ms = dropped frame at 60fps)
    if (frameTime > 16.67) {
      this.droppedFrames++;
    }
  }
  
  private calculateFPS(): number {
    if (this.frameTimes.length < 2) return 0;
    
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    return Math.min(1000 / avgFrameTime, 60);
  }
  
  private async getGPUFrameTime(): Promise<number | undefined> {
    // WebGL timer queries if available
    if (this.renderer.extensions?.get('EXT_disjoint_timer_query_webgl2')) {
      return this.measureGPUTime();
    }
    return undefined;
  }
}
```

#### Memory Collector
```typescript
// src/utils/performanceMonitor/collectors/memoryCollector.ts
export class MemoryCollector implements MetricCollector {
  constructor(private renderer: any) {}
  
  async collect(): Promise<MemoryMetrics> {
    const heap = this.getHeapUsage();
    const gpu = this.estimateGPUMemory();
    const resources = this.getResourceCounts();
    
    return {
      heap,
      gpu,
      ...resources
    };
  }
  
  private getHeapUsage(): HeapUsage {
    const memory = (performance as any).memory;
    
    if (memory) {
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      };
    }
    
    // Fallback estimation
    return this.estimateHeapUsage();
  }
  
  private estimateGPUMemory(): GPUMemoryUsage | undefined {
    if (!this.renderer) return undefined;
    
    const info = this.renderer.info;
    if (info && info.memory) {
      // Three.js renderer info
      return {
        used: info.memory.textures * 4 + info.memory.geometries * 2, // Rough estimate
        total: this.getGPUMemoryLimit()
      };
    }
    
    return undefined;
  }
  
  private getResourceCounts(): ResourceCounts {
    const info = this.renderer?.info;
    
    return {
      textures: info?.memory?.textures || 0,
      geometries: info?.memory?.geometries || 0,
      materials: info?.programs?.length || 0
    };
  }
}
```

#### Audio Performance Collector
```typescript
// src/utils/performanceMonitor/collectors/audioCollector.ts
export class AudioCollector implements MetricCollector {
  constructor(private audioContext: AudioContext) {}
  
  async collect(): Promise<AudioMetrics> {
    const latency = await this.measureLatency();
    const bufferSize = this.getBufferSize();
    const underruns = this.getBufferUnderruns();
    
    return {
      latency,
      bufferSize,
      underruns,
      contextState: this.audioContext.state,
      sampleRate: this.audioContext.sampleRate
    };
  }
  
  private async measureLatency(): Promise<number> {
    // Output latency measurement
    const outputLatency = (this.audioContext as any).outputLatency || 0;
    
    // Base latency estimation
    const baseLatency = (this.audioContext as any).baseLatency || 0;
    
    return (outputLatency + baseLatency) * 1000; // Convert to milliseconds
  }
  
  private getBufferSize(): number {
    // Estimated from sample rate and latency
    const latencySeconds = this.audioContext.baseLatency || 0.005;
    return Math.ceil(latencySeconds * this.audioContext.sampleRate);
  }
  
  private getBufferUnderruns(): number {
    // This would need integration with actual audio processing
    // For now, estimate based on context state changes
    return this.audioContext.state === 'suspended' ? 1 : 0;
  }
}
```

### 3. Performance Dashboard UI

#### Main Dashboard Component
```typescript
// src/components/PerformanceDashboard/PerformanceDashboard.tsx
export interface PerformanceDashboardProps {
  monitor: PerformanceMonitor;
  className?: string;
  compact?: boolean;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  monitor,
  className,
  compact = false
}) => {
  const [metrics, setMetrics] = useState<PerformanceSnapshot | null>(null);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const unsubscribe = monitor.subscribe((newMetrics) => {
      setMetrics(newMetrics);
      setAlerts(monitor.getActiveAlerts());
    });
    
    return unsubscribe;
  }, [monitor]);
  
  if (!isVisible) {
    return (
      <button 
        className="performance-toggle"
        onClick={() => setIsVisible(true)}
        title="Show Performance Dashboard"
      >
        📊 {metrics?.rendering.fps.toFixed(0) || '--'} FPS
      </button>
    );
  }
  
  return (
    <div className={`performance-dashboard ${className}`}>
      <div className="dashboard-header">
        <h3>Performance Monitor</h3>
        <button onClick={() => setIsVisible(false)}>✕</button>
      </div>
      
      {compact ? (
        <CompactView metrics={metrics} alerts={alerts} />
      ) : (
        <DetailedView metrics={metrics} alerts={alerts} monitor={monitor} />
      )}
    </div>
  );
};
```

#### Real-time Charts
```typescript
// src/components/PerformanceDashboard/FPSChart.tsx
export const FPSChart: React.FC<{ history: PerformanceHistory }> = ({ history }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!chartRef.current || !history.length) return;
    
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;
    
    // Simple canvas-based real-time chart
    drawFPSChart(ctx, history.map(h => h.rendering.fps));
  }, [history]);
  
  return (
    <div className="fps-chart">
      <h4>FPS ({history[history.length - 1]?.rendering.fps.toFixed(1) || '--'})</h4>
      <canvas 
        ref={chartRef} 
        width={300} 
        height={100}
        className="chart-canvas"
      />
    </div>
  );
};

// Simple chart drawing function
function drawFPSChart(ctx: CanvasRenderingContext2D, fpsData: number[]): void {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Draw grid
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  
  // Horizontal lines (FPS thresholds)
  const fpsLines = [30, 60];
  fpsLines.forEach(fps => {
    const y = height - (fps / 60) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  });
  
  // Draw FPS line
  if (fpsData.length > 1) {
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    fpsData.forEach((fps, index) => {
      const x = (index / (fpsData.length - 1)) * width;
      const y = height - (fps / 60) * height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
  }
}
```

### 4. Adaptive Quality Manager

#### Quality Management System
```typescript
// src/utils/performanceMonitor/adaptiveQuality.ts
export interface QualityProfile {
  name: string;
  renderScale: number;        // 0.5 - 2.0
  particleCount: number;      // Max particles
  effectComplexity: number;   // 1-5 complexity level
  fpsTarget: number;          // Target FPS
  audioLatency: number;       // Audio buffer size
}

export const QUALITY_PROFILES: Record<string, QualityProfile> = {
  potato: {
    name: 'Ultra Low',
    renderScale: 0.5,
    particleCount: 100,
    effectComplexity: 1,
    fpsTarget: 30,
    audioLatency: 512
  },
  low: {
    name: 'Low',
    renderScale: 0.75,
    particleCount: 500,
    effectComplexity: 2,
    fpsTarget: 45,
    audioLatency: 256
  },
  medium: {
    name: 'Medium',
    renderScale: 1.0,
    particleCount: 1000,
    effectComplexity: 3,
    fpsTarget: 60,
    audioLatency: 128
  },
  high: {
    name: 'High',
    renderScale: 1.25,
    particleCount: 2000,
    effectComplexity: 4,
    fpsTarget: 60,
    audioLatency: 64
  },
  ultra: {
    name: 'Ultra',
    renderScale: 1.5,
    particleCount: 5000,
    effectComplexity: 5,
    fpsTarget: 60,
    audioLatency: 32
  }
};

export class AdaptiveQualityManager {
  private currentProfile: QualityProfile;
  private deviceTier: DeviceTier;
  private performanceHistory: PerformanceSnapshot[] = [];
  
  constructor(
    private renderer: any,
    private audioContext: AudioContext,
    private store: any
  ) {
    this.deviceTier = this.detectDeviceTier();
    this.currentProfile = this.selectInitialProfile();
  }
  
  processMetrics(metrics: PerformanceSnapshot): void {
    this.performanceHistory.push(metrics);
    
    // Keep only last 30 seconds of data
    if (this.performanceHistory.length > 30) {
      this.performanceHistory.shift();
    }
    
    // Check if adaptation is needed
    if (this.shouldAdaptQuality(metrics)) {
      this.adaptQuality(metrics);
    }
  }
  
  private shouldAdaptQuality(metrics: PerformanceSnapshot): boolean {
    const avgFPS = this.getAverageFPS();
    const memoryPressure = this.getMemoryPressure(metrics);
    
    // Conditions for quality reduction
    if (avgFPS < this.currentProfile.fpsTarget * 0.8) return true;
    if (memoryPressure > 0.85) return true;
    if (metrics.audio.underruns > 5) return true;
    
    // Conditions for quality increase
    if (avgFPS > this.currentProfile.fpsTarget * 1.1 && memoryPressure < 0.6) {
      return true;
    }
    
    return false;
  }
  
  private adaptQuality(metrics: PerformanceSnapshot): void {
    const currentLevel = this.getProfileLevel(this.currentProfile);
    let newLevel = currentLevel;
    
    // Determine direction
    const avgFPS = this.getAverageFPS();
    const memoryPressure = this.getMemoryPressure(metrics);
    
    if (avgFPS < this.currentProfile.fpsTarget * 0.8 || memoryPressure > 0.85) {
      // Reduce quality
      newLevel = Math.max(0, currentLevel - 1);
    } else if (avgFPS > this.currentProfile.fpsTarget * 1.1 && memoryPressure < 0.6) {
      // Increase quality
      newLevel = Math.min(4, currentLevel + 1);
    }
    
    if (newLevel !== currentLevel) {
      this.applyQualityProfile(this.getProfileByLevel(newLevel));
    }
  }
  
  private applyQualityProfile(profile: QualityProfile): void {
    this.currentProfile = profile;
    
    // Apply to renderer
    if (this.renderer && this.renderer.setPixelRatio) {
      this.renderer.setPixelRatio(window.devicePixelRatio * profile.renderScale);
    }
    
    // Apply to store
    if (this.store) {
      this.store.setState({
        performanceProfile: profile,
        maxParticles: profile.particleCount,
        effectComplexity: profile.effectComplexity
      });
    }
    
    console.log(`Quality adapted to: ${profile.name}`);
  }
}
```

---

## 🔧 Integration Points

### 1. Zustand Store Integration
```typescript
// src/store/visualizerStore.ts (additions)
interface VisualizerState {
  // ... existing state
  
  // Performance monitoring
  performanceMonitor?: PerformanceMonitor;
  performanceProfile: QualityProfile;
  performanceMetrics?: PerformanceSnapshot;
  performanceAlerts: PerformanceAlert[];
  
  // Performance actions
  initializePerformanceMonitoring: () => Promise<void>;
  updatePerformanceProfile: (profile: QualityProfile) => void;
  togglePerformanceDashboard: () => void;
}
```

### 2. Main Application Integration
```typescript
// src/pages/vj-app.tsx (modifications)
export default function VJApp() {
  const { 
    initializePerformanceMonitoring,
    performanceMonitor,
    togglePerformanceDashboard 
  } = useVisualizerStore();
  
  useEffect(() => {
    // Initialize performance monitoring after other systems
    const initPerformance = async () => {
      await initializePerformanceMonitoring();
    };
    
    initPerformance();
  }, [initializePerformanceMonitoring]);
  
  return (
    <div className="vj-app">
      {/* ... existing components */}
      
      {performanceMonitor && (
        <PerformanceDashboard 
          monitor={performanceMonitor}
          className="performance-overlay"
        />
      )}
      
      {/* Performance toggle in controls */}
      <button 
        onClick={togglePerformanceDashboard}
        className="performance-toggle-btn"
        title="Toggle Performance Dashboard"
      >
        📊
      </button>
    </div>
  );
}
```

---

## 📋 Implementation Checklist

### Core Infrastructure ✅ Ready
- [ ] PerformanceMonitor core class
- [ ] MetricCollector interface and implementations
- [ ] PerformanceSnapshot data structures
- [ ] History management and storage

### Data Collection ✅ Ready  
- [ ] RenderingCollector (FPS, frame times, GPU metrics)
- [ ] MemoryCollector (heap, GPU memory, resource counts)
- [ ] AudioCollector (latency, buffer underruns)
- [ ] MobileCollector (battery, touch latency, network)

### Dashboard UI ✅ Ready
- [ ] Main PerformanceDashboard component
- [ ] Real-time charts (FPS, Memory, Audio)
- [ ] Alert management UI
- [ ] Mobile-optimized compact view

### Adaptive Quality ✅ Ready
- [ ] AdaptiveQualityManager implementation
- [ ] Quality profiles configuration
- [ ] Automatic adaptation rules
- [ ] Manual quality override controls

### Integration & Testing ✅ Ready
- [ ] Zustand store integration
- [ ] Main application integration
- [ ] Comprehensive test suite
- [ ] Performance benchmarking
- [ ] Mobile device testing

---

## 🎯 Success Validation Plan

### Automated Testing
1. **Unit Tests**: Each component tested individually
2. **Integration Tests**: End-to-end monitoring flow
3. **Performance Tests**: Verify monitoring overhead < 2ms/frame
4. **Load Tests**: Stress testing with high particle counts

### Manual Testing Scenarios
1. **Device Testing**: Test on low/mid/high-end devices
2. **Browser Testing**: Chrome, Firefox, Safari compatibility
3. **Mobile Testing**: iOS Safari, Chrome Mobile
4. **Accessibility**: Screen reader compatibility

### Success Metrics Validation
- [ ] 60 FPS sustained on mid-range devices
- [ ] <100ms audio latency consistently measured
- [ ] Battery usage improved by 30%+ (initial target, building to 50%)
- [ ] Memory usage stays under 500MB for typical sessions
- [ ] Performance monitoring overhead < 2ms per frame

---

**Design Status**: ✅ **APPROVED FOR IMPLEMENTATION**  
**Architecture**: Modular, extensible, performance-focused  
**Integration**: Seamless with existing V1Z3R systems  
**Testing**: Comprehensive validation plan defined  
**Timeline**: 4 weeks implementation, 1 week testing and refinement