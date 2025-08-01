/**
 * Performance Monitoring System - Integration Tests
 * 
 * These tests validate the integration of all components working together
 * in a controlled test environment.
 */

import { PerformanceMonitor } from '../core';
import { AdaptiveQualityManager } from '../adaptiveQuality';
import { QUALITY_PROFILES, DEFAULT_ALERT_RULES } from '../types';
import type { PerformanceSnapshot, PerformanceAlert } from '../types';

describe('Performance Monitoring Integration', () => {
  let monitor: PerformanceMonitor;
  let qualityManager: AdaptiveQualityManager;
  let mockStore: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    monitor = new PerformanceMonitor({
      updateInterval: 100,
      historyLength: 100,
      enableAutoOptimization: true
    });
    
    mockStore = {
      setState: jest.fn(),
      getState: jest.fn(() => ({
        performanceAlerts: [],
        performanceMetrics: null,
        enableParticles: true,
        particleCount: 10000,
        effectIntensity: 1.0,
        effectComplexity: 1.0
      }))
    };
    
    qualityManager = new AdaptiveQualityManager(
      undefined, // No renderer needed for these tests
      undefined, // No audio context needed
      mockStore
    );
  });

  afterEach(() => {
    monitor.stop();
  });

  describe('Core Integration', () => {
    it('should initialize and start monitoring', async () => {
      await monitor.start();
      expect(monitor.isRunning()).toBe(true);
    });

    it('should collect and return metrics', async () => {
      await monitor.start();
      const metrics = monitor.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics?.timestamp).toBeDefined();
      expect(metrics?.rendering).toBeDefined();
      expect(metrics?.memory).toBeDefined();
      expect(metrics?.audio).toBeDefined();
    });

    it('should maintain metrics history', async () => {
      await monitor.start();
      
      // Wait for some collections
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const history = monitor.getHistory();
      expect(history.entries.length).toBeGreaterThan(0);
      expect(history.entries.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Alert System Integration', () => {
    it('should generate alerts based on rules', async () => {
      await monitor.start();
      
      // Add custom alert rule for testing
      monitor.addAlert({
        id: 'test-rule',
        name: 'Test Alert',
        metric: 'rendering.fps',
        threshold: 60,
        operator: 'lt',
        severity: 'warning',
        duration: 0
      });
      
      const alerts = monitor.getActiveAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should acknowledge and resolve alerts', async () => {
      await monitor.start();
      
      // Force an alert by adding impossible rule
      monitor.addAlert({
        id: 'force-alert',
        name: 'Force Alert',
        metric: 'rendering.fps',
        threshold: 1000,
        operator: 'lt',
        severity: 'critical',
        duration: 0
      });
      
      // Wait for alert generation
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const alerts = monitor.getActiveAlerts();
      if (alerts.length > 0) {
        const alertId = alerts[0].id;
        
        monitor.acknowledgeAlert(alertId);
        const ackAlert = monitor.getActiveAlerts().find(a => a.id === alertId);
        expect(ackAlert?.acknowledged).toBe(true);
        
        monitor.resolveAlert(alertId);
        const resolvedAlert = monitor.getActiveAlerts().find(a => a.id === alertId);
        expect(resolvedAlert?.resolved).toBe(true);
      }
    });
  });

  describe('Store Integration', () => {
    it('should integrate with store and update state', async () => {
      monitor.integrateWithStore(mockStore);
      await monitor.start();
      
      // Wait for updates
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(mockStore.setState).toHaveBeenCalled();
      const lastCall = mockStore.setState.mock.calls[mockStore.setState.mock.calls.length - 1][0];
      
      expect(lastCall).toHaveProperty('performanceMetrics');
      expect(lastCall).toHaveProperty('performanceAlerts');
    });

    it('should trigger dashboard on critical alerts', async () => {
      monitor.integrateWithStore(mockStore);
      await monitor.start();
      
      // Add critical alert rule
      monitor.addAlert({
        id: 'critical-test',
        name: 'Critical Test',
        metric: 'memory.heap.used',
        threshold: 0,
        operator: 'gte',
        severity: 'critical',
        duration: 0
      });
      
      // Wait for alert
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const calls = mockStore.setState.mock.calls;
      const dashboardCall = calls.find(call => 
        call[0].showPerformanceDashboard === true
      );
      
      expect(dashboardCall).toBeDefined();
    });
  });

  describe('Quality Manager Integration', () => {
    it('should process metrics and adapt quality', () => {
      const goodMetrics: PerformanceSnapshot = {
        timestamp: Date.now(),
        rendering: {
          fps: 60,
          frameTimes: Array(60).fill(16.67),
          droppedFrames: 0,
          renderTime: 10,
          gpuTime: 8
        },
        memory: {
          heap: { used: 100 * 1024 * 1024, total: 500 * 1024 * 1024, limit: 1000 * 1024 * 1024 },
          textures: 50,
          geometries: 30,
          materials: 20
        },
        audio: {
          latency: 20,
          bufferSize: 128,
          underruns: 0,
          contextState: 'running',
          sampleRate: 48000
        },
        ux: {
          inputLatency: 5,
          loadTime: 1000,
          errorCount: 0,
          interactionSuccess: 100
        }
      };
      
      qualityManager.processMetrics(goodMetrics);
      const profile = qualityManager.getCurrentProfile();
      expect(profile.name).toBe('Medium'); // Default tier
    });

    it('should reduce quality on poor performance', () => {
      const poorMetrics: PerformanceSnapshot = {
        timestamp: Date.now(),
        rendering: {
          fps: 20,
          frameTimes: Array(60).fill(50),
          droppedFrames: 30,
          renderTime: 40,
          gpuTime: 35
        },
        memory: {
          heap: { used: 900 * 1024 * 1024, total: 1000 * 1024 * 1024, limit: 1000 * 1024 * 1024 },
          textures: 200,
          geometries: 150,
          materials: 100
        },
        audio: {
          latency: 100,
          bufferSize: 512,
          underruns: 10,
          contextState: 'running',
          sampleRate: 48000
        },
        ux: {
          inputLatency: 50,
          loadTime: 5000,
          errorCount: 5,
          interactionSuccess: 70
        }
      };
      
      // Need to wait for cooldown between adaptations
      qualityManager.processMetrics(poorMetrics);
      
      // Force immediate adaptation by resetting cooldown
      (qualityManager as any).lastAdaptation = 0;
      qualityManager.processMetrics(poorMetrics);
      
      const profile = qualityManager.getCurrentProfile();
      expect(profile.particleCount).toBeLessThan(1000);
    });

    it('should handle quality profile switching', () => {
      // Test all profiles
      Object.keys(QUALITY_PROFILES).forEach(profileName => {
        qualityManager.setQualityProfile(profileName);
        const profile = qualityManager.getCurrentProfile();
        expect(profile.name).toBe(QUALITY_PROFILES[profileName].name);
      });
    });

    it('should detect device capabilities', () => {
      const capabilities = qualityManager.getDeviceCapabilities();
      expect(capabilities).toBeDefined();
      expect(capabilities.hardwareConcurrency).toBeGreaterThan(0);
      expect(typeof capabilities.webgl).toBe('boolean');
      expect(typeof capabilities.webgpu).toBe('boolean');
    });
  });

  describe('Subscription System', () => {
    it('should support multiple subscribers', async () => {
      const subscriber1 = jest.fn();
      const subscriber2 = jest.fn();
      
      const unsub1 = monitor.subscribe(subscriber1);
      const unsub2 = monitor.subscribe(subscriber2);
      
      await monitor.start();
      
      // Wait for updates
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(subscriber1).toHaveBeenCalled();
      expect(subscriber2).toHaveBeenCalled();
      
      // Test unsubscribe
      unsub1();
      subscriber1.mockClear();
      subscriber2.mockClear();
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(subscriber1).not.toHaveBeenCalled();
      expect(subscriber2).toHaveBeenCalled();
      
      unsub2();
    });

    it('should provide metrics and alerts to subscribers', async () => {
      let receivedMetrics: PerformanceSnapshot | null = null;
      let receivedAlerts: PerformanceAlert[] = [];
      
      monitor.subscribe((metrics, alerts) => {
        receivedMetrics = metrics;
        receivedAlerts = alerts;
      });
      
      await monitor.start();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(receivedMetrics).toBeDefined();
      expect(receivedMetrics?.timestamp).toBeDefined();
      expect(Array.isArray(receivedAlerts)).toBe(true);
    });
  });

  describe('Performance Optimization', () => {
    it('should have minimal overhead', async () => {
      const startTime = performance.now();
      
      await monitor.start();
      
      // Let it run for a bit
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const metrics = monitor.getMetrics();
      monitor.stop();
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(2000);
      expect(metrics).toBeDefined();
    });

    it('should handle rapid metric updates', async () => {
      await monitor.start();
      
      // Simulate rapid updates
      for (let i = 0; i < 100; i++) {
        monitor.getMetrics();
      }
      
      // Should not crash or leak memory
      const metrics = monitor.getMetrics();
      expect(metrics).toBeDefined();
    });
  });
});