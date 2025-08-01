/**
 * Tests for Performance Monitor Collectors
 */

import { RenderingCollector } from '../collectors/renderingCollector';
import { MemoryCollector } from '../collectors/memoryCollector';
import { AudioCollector } from '../collectors/audioCollector';
import { MobileCollector } from '../collectors/mobileCollector';

// Mock global objects
global.performance = {
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 100 * 1024 * 1024,
    totalJSHeapSize: 200 * 1024 * 1024,
    jsHeapSizeLimit: 500 * 1024 * 1024,
  },
} as any;

global.navigator = {
  hardwareConcurrency: 4,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  platform: 'Win32',
  maxTouchPoints: 0,
} as any;

global.window = {
  devicePixelRatio: 1,
  innerWidth: 1920,
  innerHeight: 1080,
} as any;

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((callback) => {
  setTimeout(callback, 16);
  return 1;
});

global.cancelAnimationFrame = jest.fn();

describe('Performance Collectors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('RenderingCollector', () => {
    let collector: RenderingCollector;
    let mockRenderer: any;

    beforeEach(() => {
      mockRenderer = {
        info: {
          render: {
            calls: 100,
            triangles: 5000,
          },
          memory: {
            textures: 10,
            geometries: 5,
          },
          programs: [1, 2, 3],
        },
        getContext: () => ({
          getExtension: () => null,
        }),
      };

      collector = new RenderingCollector(mockRenderer);
    });

    afterEach(() => {
      collector.cleanup();
    });

    it('should initialize correctly', async () => {
      await collector.initialize();
      expect(collector.name).toBe('rendering');
      expect(collector.enabled).toBe(true);
    });

    it('should collect rendering metrics', async () => {
      await collector.initialize();
      
      // Simulate some frame measurements
      collector.onFrameStart();
      await new Promise(resolve => setTimeout(resolve, 16));
      collector.onFrameEnd();
      
      const metrics = await collector.collect();
      
      expect(metrics.rendering).toBeDefined();
      expect(metrics.rendering?.fps).toBeGreaterThanOrEqual(0);
      expect(metrics.rendering?.frameTimes).toBeInstanceOf(Array);
      expect(metrics.rendering?.droppedFrames).toBeGreaterThanOrEqual(0);
      expect(metrics.rendering?.renderTime).toBeGreaterThanOrEqual(0);
    });

    it('should track frame times', async () => {
      await collector.initialize();
      
      // Simulate multiple frames
      for (let i = 0; i < 5; i++) {
        collector.onFrameStart();
        await new Promise(resolve => setTimeout(resolve, 16));
        collector.onFrameEnd();
      }
      
      const metrics = await collector.collect();
      expect(metrics.rendering?.frameTimes.length).toBeGreaterThan(0);
    });

    it('should detect dropped frames', async () => {
      await collector.initialize();
      
      // Simulate a slow frame
      collector.onFrameStart();
      await new Promise(resolve => setTimeout(resolve, 50)); // 50ms > 16.67ms
      collector.onFrameEnd();
      
      const metrics = await collector.collect();
      expect(metrics.rendering?.droppedFrames).toBeGreaterThan(0);
    });

    it('should get draw calls from renderer', async () => {
      const metrics = await collector.collect();
      expect(metrics.rendering?.drawCalls).toBe(100);
      expect(metrics.rendering?.triangles).toBe(5000);
    });

    it('should handle missing renderer info', async () => {
      const collectorWithoutRenderer = new RenderingCollector();
      const metrics = await collectorWithoutRenderer.collect();
      
      expect(metrics.rendering?.drawCalls).toBeUndefined();
      expect(metrics.rendering?.triangles).toBeUndefined();
    });

    it('should calculate performance grade', () => {
      expect(collector.getPerformanceGrade()).toBeDefined();
    });

    it('should detect performance degradation', () => {
      const isDegraded = collector.isPerformanceDegraded();
      expect(typeof isDegraded).toBe('boolean');
    });

    it('should get frame time statistics', () => {
      const stats = collector.getFrameTimeStats();
      expect(stats).toHaveProperty('min');
      expect(stats).toHaveProperty('max');
      expect(stats).toHaveProperty('avg');
      expect(stats).toHaveProperty('p95');
    });
  });

  describe('MemoryCollector', () => {
    let collector: MemoryCollector;
    let mockRenderer: any;

    beforeEach(() => {
      mockRenderer = {
        info: {
          memory: {
            textures: 10,
            geometries: 5,
          },
          programs: [1, 2, 3],
        },
      };

      collector = new MemoryCollector(mockRenderer);
    });

    it('should initialize correctly', async () => {
      await collector.initialize();
      expect(collector.name).toBe('memory');
      expect(collector.enabled).toBe(true);
    });

    it('should collect memory metrics', async () => {
      const metrics = await collector.collect();
      
      expect(metrics.memory).toBeDefined();
      expect(metrics.memory?.heap).toBeDefined();
      expect(metrics.memory?.heap.used).toBeGreaterThan(0);
      expect(metrics.memory?.heap.total).toBeGreaterThan(0);
      expect(metrics.memory?.heap.limit).toBeGreaterThan(0);
    });

    it('should get heap usage from performance.memory', () => {
      const metrics = collector.collect();
      expect(metrics).resolves.toHaveProperty('memory.heap');
    });

    it('should estimate GPU memory usage', async () => {
      const metrics = await collector.collect();
      expect(metrics.memory?.gpu).toBeDefined();
    });

    it('should get resource counts', async () => {
      const metrics = await collector.collect();
      expect(metrics.memory?.textures).toBe(10);
      expect(metrics.memory?.geometries).toBe(5);
      expect(metrics.memory?.materials).toBe(3);
    });

    it('should detect memory leaks', () => {
      // Simulate memory usage tracking
      for (let i = 0; i < 10; i++) {
        collector.collect();
      }
      
      const leakDetection = collector.detectMemoryLeaks();
      expect(leakDetection).toHaveProperty('hasLeak');
      expect(leakDetection).toHaveProperty('trend');
      expect(leakDetection).toHaveProperty('rateOfIncrease');
    });

    it('should get memory pressure level', () => {
      const pressure = collector.getMemoryPressure();
      expect(['low', 'medium', 'high', 'critical']).toContain(pressure);
    });

    it('should calculate memory efficiency score', () => {
      const score = collector.getMemoryEfficiencyScore();
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should provide optimization recommendations', () => {
      const recommendations = collector.getOptimizationRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should handle missing performance.memory', async () => {
      // Temporarily remove performance.memory
      const originalMemory = (global.performance as any).memory;
      delete (global.performance as any).memory;
      
      const metrics = await collector.collect();
      expect(metrics.memory?.heap).toBeDefined();
      
      // Restore
      (global.performance as any).memory = originalMemory;
    });
  });

  describe('AudioCollector', () => {
    let collector: AudioCollector;
    let mockAudioContext: any;

    beforeEach(() => {
      mockAudioContext = {
        state: 'running',
        sampleRate: 44100,
        currentTime: 1.0,
        baseLatency: 0.005,
        outputLatency: 0.010,
        addEventListener: jest.fn(),
      };

      collector = new AudioCollector(mockAudioContext);
    });

    it('should initialize correctly', async () => {
      await collector.initialize();
      expect(collector.name).toBe('audio');
      expect(collector.enabled).toBe(true);
    });

    it('should collect audio metrics', async () => {
      const metrics = await collector.collect();
      
      expect(metrics.audio).toBeDefined();
      expect(metrics.audio?.latency).toBeGreaterThanOrEqual(0);
      expect(metrics.audio?.contextState).toBe('running');
      expect(metrics.audio?.sampleRate).toBe(44100);
    });

    it('should measure audio latency', async () => {
      const metrics = await collector.collect();
      expect(metrics.audio?.latency).toBeGreaterThan(0);
    });

    it('should handle missing audio context', async () => {
      const collectorWithoutContext = new AudioCollector();
      const metrics = await collectorWithoutContext.collect();
      
      expect(metrics.audio?.contextState).toBe('suspended');
      expect(metrics.audio?.latency).toBe(0);
    });

    it('should get audio performance statistics', () => {
      const stats = collector.getAudioPerformanceStats();
      expect(stats).toHaveProperty('averageLatency');
      expect(stats).toHaveProperty('contextStability');
      expect(stats).toHaveProperty('processingEfficiency');
    });

    it('should check if performance is acceptable', () => {
      const isAcceptable = collector.isPerformanceAcceptable();
      expect(typeof isAcceptable).toBe('boolean');
    });

    it('should provide optimization recommendations', () => {
      const recommendations = collector.getOptimizationRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should test audio latency', async () => {
      const latency = await collector.testAudioLatency();
      expect(latency).toBeGreaterThanOrEqual(0);
    });

    it('should handle audio context state changes', async () => {
      await collector.initialize();
      
      // Simulate state change
      mockAudioContext.state = 'suspended';
      
      const metrics = await collector.collect();
      expect(metrics.audio?.contextState).toBe('suspended');
    });
  });

  describe('MobileCollector', () => {
    let collector: MobileCollector;

    beforeEach(() => {
      // Mock mobile environment
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        configurable: true,
      });

      Object.defineProperty(global.navigator, 'maxTouchPoints', {
        value: 5,
        configurable: true,
      });

      Object.defineProperty(global.window, 'innerWidth', {
        value: 375,
        configurable: true,
      });

      collector = new MobileCollector();
    });

    afterEach(() => {
      collector.cleanup();
    });

    it('should detect mobile device', () => {
      expect(collector.enabled).toBe(true);
    });

    it('should initialize correctly on mobile', async () => {
      if (collector.enabled) {
        await collector.initialize();
        expect(collector.name).toBe('mobile');
      }
    });

    it('should collect mobile metrics', async () => {
      if (collector.enabled) {
        const metrics = await collector.collect();
        
        expect(metrics.mobile).toBeDefined();
        expect(metrics.mobile?.touchLatency).toBeGreaterThanOrEqual(0);
        expect(typeof metrics.mobile?.deviceMotion).toBe('boolean');
      }
    });

    it('should get mobile performance statistics', () => {
      const stats = collector.getMobilePerformanceStats();
      expect(stats).toHaveProperty('batteryEfficiency');
      expect(stats).toHaveProperty('touchResponsiveness');
      expect(stats).toHaveProperty('networkQuality');
      expect(stats).toHaveProperty('deviceStability');
    });

    it('should provide optimization recommendations', () => {
      const recommendations = collector.getOptimizationRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should detect power saving mode', () => {
      const isPowerSaving = collector.isPowerSavingMode();
      expect(typeof isPowerSaving).toBe('boolean');
    });

    it('should estimate thermal state', () => {
      const thermalState = collector.estimateThermalState();
      expect(['normal', 'warm', 'hot', 'critical']).toContain(thermalState);
    });

    it('should get device capabilities', () => {
      const capabilities = collector.getDeviceCapabilities();
      expect(capabilities).toHaveProperty('touchPoints');
      expect(capabilities).toHaveProperty('orientationSupport');
      expect(capabilities).toHaveProperty('motionSupport');
    });

    it('should handle non-mobile environment', () => {
      // Mock desktop environment
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        configurable: true,
      });

      Object.defineProperty(global.navigator, 'maxTouchPoints', {
        value: 0,
        configurable: true,
      });

      Object.defineProperty(global.window, 'innerWidth', {
        value: 1920,
        configurable: true,
      });

      const desktopCollector = new MobileCollector();
      expect(desktopCollector.enabled).toBe(false);
    });

    it('should test touch responsiveness', async () => {
      if (typeof document !== 'undefined') {
        const responseTime = await collector.testTouchResponsiveness();
        expect(responseTime).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Collector Error Handling', () => {
    it('should handle rendering collector errors', async () => {
      const collector = new RenderingCollector();
      
      // Should not crash even without renderer
      const metrics = await collector.collect();
      expect(metrics.rendering).toBeDefined();
    });

    it('should handle memory collector errors', async () => {
      const collector = new MemoryCollector();
      
      // Should not crash even without renderer
      const metrics = await collector.collect();
      expect(metrics.memory).toBeDefined();
    });

    it('should handle audio collector errors', async () => {
      const collector = new AudioCollector();
      
      // Should not crash even without audio context
      const metrics = await collector.collect();
      expect(metrics.audio).toBeDefined();
    });

    it('should handle mobile collector on non-mobile', async () => {
      // Create collector in non-mobile environment
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        configurable: true,
      });

      const collector = new MobileCollector();
      
      if (!collector.enabled) {
        const metrics = await collector.collect();
        expect(metrics).toEqual({});
      }
    });
  });
});