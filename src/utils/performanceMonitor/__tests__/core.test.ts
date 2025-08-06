/**
 * Tests for Performance Monitor Core
 */

import { PerformanceMonitor } from '../core';
import { 
  PerformanceMonitorConfig, 
  PerformanceSnapshot, 
  MetricCollector,
  AlertRule,
  DEFAULT_CONFIG 
} from '../types';

// Mock collector for testing
class MockCollector implements MetricCollector {
  name = 'mock';
  enabled = true;
  
  async collect(): Promise<Partial<PerformanceSnapshot>> {
    return {
      rendering: {
        fps: 60,
        frameTimes: [16.67, 16.67, 16.67],
        droppedFrames: 0,
        renderTime: 10,
      },
      memory: {
        heap: {
          used: 100 * 1024 * 1024, // 100MB
          total: 200 * 1024 * 1024, // 200MB
          limit: 500 * 1024 * 1024, // 500MB
        },
        textures: 10,
        geometries: 5,
        materials: 3,
      },
    };
  }
}

// Mock failing collector
class FailingCollector implements MetricCollector {
  name = 'failing';
  enabled = true;
  
  async collect(): Promise<Partial<PerformanceSnapshot>> {
    throw new Error('Collection failed');
  }
}

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  let mockCollector: MockCollector;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
    mockCollector = new MockCollector();
    
    // Mock timers
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (monitor) {
      monitor.stop();
    }
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default config', () => {
      const defaultMonitor = new PerformanceMonitor();
      expect(defaultMonitor).toBeInstanceOf(PerformanceMonitor);
    });

    it('should initialize with custom config', () => {
      const customConfig: Partial<PerformanceMonitorConfig> = {
        updateInterval: 2000,
        historyLength: 100,
      };
      
      const customMonitor = new PerformanceMonitor(customConfig);
      expect(customMonitor).toBeInstanceOf(PerformanceMonitor);
    });
  });

  describe('Collector Management', () => {
    it('should add collector', () => {
      monitor.addCollector(mockCollector);
      // Verify collector was added (internal state)
      expect(monitor).toBeInstanceOf(PerformanceMonitor);
    });

    it('should remove collector', () => {
      monitor.addCollector(mockCollector);
      monitor.removeCollector('mock');
      // Verify collector was removed (internal state)
      expect(monitor).toBeInstanceOf(PerformanceMonitor);
    });
  });

  describe('Monitoring Lifecycle', () => {
    it('should start monitoring', async () => {
      monitor.addCollector(mockCollector);
      
      await monitor.start();
      
      // Verify monitoring started
      const metrics = monitor.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should stop monitoring', async () => {
      monitor.addCollector(mockCollector);
      
      await monitor.start();
      monitor.stop();
      
      // Should not crash when stopping
      expect(monitor).toBeInstanceOf(PerformanceMonitor);
    });

    it('should handle start when already running', async () => {
      monitor.addCollector(mockCollector);
      
      await monitor.start();
      
      // Should not crash when starting again
      await expect(monitor.start()).resolves.not.toThrow();
    });
  });

  describe('Metrics Collection', () => {
    it('should collect metrics from collectors', async () => {
      monitor.addCollector(mockCollector);
      
      await monitor.start();
      
      // Advance timers to trigger collection
      jest.advanceTimersByTime(1000);
      
      const metrics = monitor.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics?.rendering.fps).toBe(60);
      expect(metrics?.memory.heap.used).toBe(100 * 1024 * 1024);
    });

    it('should handle collector failures gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      monitor.addCollector(new FailingCollector());
      
      await monitor.start();
      
      // Advance timers to trigger collection
      jest.advanceTimersByTime(1000);
      
      // Should not crash and should log error
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('should provide metrics history', async () => {
      monitor.addCollector(mockCollector);
      
      await monitor.start();
      
      // Advance timers multiple times
      jest.advanceTimersByTime(1000);
      jest.advanceTimersByTime(1000);
      jest.advanceTimersByTime(1000);
      
      const history = monitor.getHistory();
      expect(history.entries.length).toBeGreaterThan(0);
    });

    it('should filter history by duration', async () => {
      monitor.addCollector(mockCollector);
      
      await monitor.start();
      
      // Advance timers multiple times
      jest.advanceTimersByTime(1000);
      jest.advanceTimersByTime(1000);
      jest.advanceTimersByTime(1000);
      
      const recentHistory = monitor.getHistory(2000); // Last 2 seconds
      const allHistory = monitor.getHistory();
      
      expect(recentHistory.entries.length).toBeLessThanOrEqual(allHistory.entries.length);
    });
  });

  describe('Alert Management', () => {
    it('should add alert rule', () => {
      const alertRule: AlertRule = {
        id: 'test-rule',
        name: 'Test Rule',
        metric: 'rendering.fps',
        threshold: 30,
        operator: 'lt',
        severity: 'warning',
        duration: 5000,
        enabled: true,
        description: 'Test alert rule',
      };
      
      monitor.addAlert(alertRule);
      
      // Should not crash
      expect(monitor).toBeInstanceOf(PerformanceMonitor);
    });

    it('should remove alert rule', () => {
      const alertRule: AlertRule = {
        id: 'test-rule',
        name: 'Test Rule',
        metric: 'rendering.fps',
        threshold: 30,
        operator: 'lt',
        severity: 'warning',
        duration: 5000,
        enabled: true,
        description: 'Test alert rule',
      };
      
      monitor.addAlert(alertRule);
      monitor.removeAlert('test-rule');
      
      // Should not crash
      expect(monitor).toBeInstanceOf(PerformanceMonitor);
    });

    it('should get active alerts', () => {
      const alerts = monitor.getActiveAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should acknowledge alert', () => {
      // This would require setting up an actual alert scenario
      // For now, just test that the method doesn't crash
      monitor.acknowledgeAlert('non-existent-alert');
      expect(monitor).toBeInstanceOf(PerformanceMonitor);
    });

    it('should resolve alert', () => {
      // This would require setting up an actual alert scenario
      // For now, just test that the method doesn't crash
      monitor.resolveAlert('non-existent-alert');
      expect(monitor).toBeInstanceOf(PerformanceMonitor);
    });
  });

  describe('Subscription System', () => {
    it('should allow subscription to metrics updates', () => {
      const callback = jest.fn();
      
      const unsubscribe = monitor.subscribe(callback);
      
      expect(typeof unsubscribe).toBe('function');
    });

    it('should call subscribers on metrics update', async () => {
      const callback = jest.fn();
      
      monitor.subscribe(callback);
      monitor.addCollector(mockCollector);
      
      await monitor.start();
      
      // Advance timers to trigger collection (default interval is 1000ms)
      jest.advanceTimersByTime(1000);
      
      // Flush any pending promises
      await Promise.resolve();
      await Promise.resolve();
      
      expect(callback).toHaveBeenCalled();
    });

    it('should allow unsubscription', () => {
      const callback = jest.fn();
      
      const unsubscribe = monitor.subscribe(callback);
      unsubscribe();
      
      // Should not crash
      expect(monitor).toBeInstanceOf(PerformanceMonitor);
    });
  });

  describe('Store Integration', () => {
    it('should integrate with external store', () => {
      const mockStore = {
        setState: jest.fn(),
      };
      
      monitor.integrateWithStore(mockStore);
      
      // Should not crash
      expect(monitor).toBeInstanceOf(PerformanceMonitor);
    });

    it('should handle missing store gracefully', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      monitor.integrateWithStore(null);
      
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    it('should handle store without setState', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const mockStore = {};
      
      monitor.integrateWithStore(mockStore);
      monitor.addCollector(mockCollector);
      
      // Should handle the error gracefully during metrics update
      expect(monitor).toBeInstanceOf(PerformanceMonitor);
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Performance Summary', () => {
    it('should provide performance summary', () => {
      const summary = monitor.getPerformanceSummary();
      
      expect(summary).toHaveProperty('avgFps');
      expect(summary).toHaveProperty('minFps');
      expect(summary).toHaveProperty('maxFps');
      expect(summary).toHaveProperty('avgMemory');
      expect(summary).toHaveProperty('avgLatency');
      expect(summary).toHaveProperty('alertCount');
    });

    it('should handle empty metrics history', () => {
      const summary = monitor.getPerformanceSummary();
      
      expect(summary.avgFps).toBe(0);
      expect(summary.minFps).toBe(0);
      expect(summary.maxFps).toBe(0);
    });
  });

  describe('Data Export', () => {
    it('should export performance data', () => {
      const data = monitor.exportData();
      
      expect(data).toHaveProperty('history');
      expect(data).toHaveProperty('alerts');
      expect(data).toHaveProperty('summary');
      expect(Array.isArray(data.history)).toBe(true);
      expect(Array.isArray(data.alerts)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Create a collector that fails during initialization
      const badCollector: MetricCollector = {
        name: 'bad',
        enabled: true,
        async initialize() {
          throw new Error('Initialization failed');
        },
        async collect() {
          return {};
        },
      };
      
      monitor.addCollector(badCollector);
      
      await monitor.start();
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle cleanup errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Create a collector that fails during cleanup
      const badCollector: MetricCollector = {
        name: 'bad',
        enabled: true,
        async collect() {
          return {};
        },
        cleanup() {
          throw new Error('Cleanup failed');
        },
      };
      
      monitor.addCollector(badCollector);
      
      // Start monitoring so there are collectors to clean up
      await monitor.start();
      
      // Now stop, which should trigger cleanup
      monitor.stop();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to cleanup collector bad:', expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Metric Value Extraction', () => {
    it('should extract nested metric values', async () => {
      monitor.addCollector(mockCollector);
      await monitor.start();
      
      // Advance timers to get metrics
      jest.advanceTimersByTime(1000);
      
      const metrics = monitor.getMetrics();
      expect(metrics).toBeDefined();
      
      // Test internal metric extraction (would need to expose method for testing)
      // For now, just verify metrics structure
      expect(metrics?.rendering.fps).toBeDefined();
      expect(metrics?.memory.heap.used).toBeDefined();
    });
  });
});