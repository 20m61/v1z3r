/**
 * Performance Monitoring System - Scenario Tests
 * 
 * These tests validate real-world usage scenarios to ensure the system
 * performs correctly under realistic conditions.
 */

import { PerformanceMonitor } from '../core';
import { AdaptiveQualityManager } from '../adaptiveQuality';
import { RenderingCollector } from '../collectors/renderingCollector';
import { MemoryCollector } from '../collectors/memoryCollector';
import { AudioCollector } from '../collectors/audioCollector';
import { MobileCollector } from '../collectors/mobileCollector';
import { QUALITY_PROFILES } from '../types';

// Mock Three.js renderer
const mockRenderer = {
  setPixelRatio: jest.fn(),
  setSize: jest.fn(),
  shadowMap: { enabled: false },
  capabilities: { maxTextures: 8 }
};

// Mock AudioContext
const mockAudioContext = {
  state: 'running',
  sampleRate: 48000,
  baseLatency: 0.01,
  createAnalyser: jest.fn(() => ({
    frequencyBinCount: 1024,
    getByteFrequencyData: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn()
  }))
};

// Mock store
const mockStore = {
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

describe('Performance Monitoring Scenarios', () => {
  jest.setTimeout(12000); // 12 seconds - allows for metrics collection cycles
  let monitor: PerformanceMonitor;
  let qualityManager: AdaptiveQualityManager;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    monitor = new PerformanceMonitor({
      updateInterval: 100, // Faster for testing
      historyLength: 100,
      enableAutoOptimization: true
    });
    
    qualityManager = new AdaptiveQualityManager(
      mockRenderer,
      mockAudioContext,
      mockStore
    );
  });

  afterEach(() => {
    monitor.stop();
    jest.useRealTimers();
  });

  describe('Scenario 1: VJ Performance Session', () => {
    it('should monitor and adapt during a typical VJ performance', async () => {
      // Setup collectors
      const renderingCollector = new RenderingCollector(mockRenderer);
      const memoryCollector = new MemoryCollector();
      const audioCollector = new AudioCollector(mockAudioContext);
      
      monitor.addCollector(renderingCollector);
      monitor.addCollector(memoryCollector);
      monitor.addCollector(audioCollector);
      
      // Connect quality manager
      monitor.subscribe((metrics) => {
        qualityManager.processMetrics(metrics);
      });
      
      await monitor.start();

      // Simulate performance session phases
      
      // Phase 1: Performance starts (good performance)
      for (let i = 0; i < 10; i++) {
        renderingCollector.onFrameStart();
        jest.advanceTimersByTime(16); // 60 FPS simulation
        renderingCollector.onFrameEnd();
        jest.advanceTimersByTime(84); // Complete 100ms cycle
      }
      
      let metrics = monitor.getMetrics();
      expect(metrics?.rendering.fps).toBeGreaterThan(50);
      expect(qualityManager.getCurrentProfile().name).toBe('Medium');

      // Phase 2: Performance drops (complex visuals)
      for (let i = 0; i < 20; i++) {
        renderingCollector.onFrameStart();
        jest.advanceTimersByTime(33); // 30 FPS simulation
        renderingCollector.onFrameEnd();
        jest.advanceTimersByTime(67); // Complete 100ms cycle
      }
      
      jest.advanceTimersByTime(5000); // Wait for adaptation cooldown
      metrics = monitor.getMetrics();
      expect(metrics?.rendering.fps).toBeLessThan(40);
      
      // Phase 3: System should adapt quality down
      const currentProfile = qualityManager.getCurrentProfile();
      expect(currentProfile.rendering.particleCount).toBeLessThan(10000);
      
      // Phase 4: Performance recovers
      for (let i = 0; i < 30; i++) {
        renderingCollector.onFrameStart();
        jest.advanceTimersByTime(16); // Back to 60 FPS
        renderingCollector.onFrameEnd();
        jest.advanceTimersByTime(84); // Complete 100ms cycle
      }
      
      // Check alerts were generated
      const alerts = monitor.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.some(a => a.type === 'fps_drop')).toBe(true);
    });
  });

  describe('Scenario 2: Mobile Device Performance', () => {
    it('should detect mobile constraints and adapt accordingly', async () => {
      // Mock mobile environment
      Object.defineProperty(navigator, 'userAgent', {
        value: 'iPhone',
        writable: true
      });
      
      const mobileCollector = new MobileCollector();
      monitor.addCollector(mobileCollector);
      
      // Force mobile detection
      const mobileQualityManager = new AdaptiveQualityManager(
        mockRenderer,
        mockAudioContext,
        mockStore
      );
      
      await monitor.start();
      
      // Simulate mobile-specific issues
      
      // Battery low scenario
      const batteryEvent = new Event('levelchange');
      Object.defineProperty(navigator, 'getBattery', {
        value: () => Promise.resolve({
          level: 0.15,
          charging: false,
          addEventListener: jest.fn()
        })
      });
      
      jest.advanceTimersByTime(1000);
      
      const metrics = monitor.getMetrics();
      expect(metrics?.mobile).toBeDefined();
      
      // Quality should be conservative on mobile
      const profile = mobileQualityManager.getCurrentProfile();
      expect(profile.renderScale).toBeLessThanOrEqual(1.0);
      expect(profile.particleCount).toBeLessThan(5000);
    });
  });

  describe('Scenario 3: Memory Pressure Handling', () => {
    it('should detect and respond to memory pressure', async () => {
      const memoryCollector = new MemoryCollector();
      monitor.addCollector(memoryCollector);
      
      monitor.subscribe((metrics) => {
        qualityManager.processMetrics(metrics);
      });
      
      await monitor.start();
      
      // Simulate memory pressure
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 900 * 1024 * 1024, // 900MB
          totalJSHeapSize: 1000 * 1024 * 1024, // 1GB
          jsHeapSizeLimit: 1000 * 1024 * 1024
        },
        configurable: true,
        writable: true
      });
      
      // Let system detect high memory usage
      jest.advanceTimersByTime(5000);
      
      const metrics = monitor.getMetrics();
      expect(metrics?.memory.heap.used).toBeGreaterThan(800 * 1024 * 1024);
      
      // Check for memory alerts
      const alerts = monitor.getActiveAlerts();
      expect(alerts.some(a => a.type === 'memory_leak')).toBe(true);
      
      // Quality should be reduced
      const profile = qualityManager.getCurrentProfile();
      expect(profile.name).toBe('Low');
    });
  });

  describe('Scenario 4: Audio Latency Issues', () => {
    it('should monitor audio performance and adjust buffer sizes', async () => {
      const audioCollector = new AudioCollector(mockAudioContext);
      monitor.addCollector(audioCollector);
      
      monitor.subscribe((metrics) => {
        qualityManager.processMetrics(metrics);
      });
      
      await monitor.start();
      
      // Simulate audio underruns
      const mockAnalyser = {
        frequencyBinCount: 1024,
        getByteFrequencyData: jest.fn((array) => {
          // Simulate gaps in audio
          for (let i = 0; i < array.length; i++) {
            array[i] = i % 100 === 0 ? 0 : 128;
          }
        }),
        connect: jest.fn(),
        disconnect: jest.fn()
      };
      
      (mockAudioContext.createAnalyser as jest.Mock).mockReturnValue(mockAnalyser);
      
      // Process several audio frames
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(100);
      }
      
      const metrics = monitor.getMetrics();
      expect(metrics?.audio).toBeDefined();
      expect(metrics?.audio.underruns).toBeGreaterThan(0);
      
      // Check audio settings were adjusted
      const profile = qualityManager.getCurrentProfile();
      expect(profile.audioLatency).toBeGreaterThanOrEqual(256);
    });
  });

  describe('Scenario 5: Multi-Alert Handling', () => {
    it('should handle multiple concurrent performance issues', async () => {
      // Add all collectors
      monitor.addCollector(new RenderingCollector(mockRenderer));
      monitor.addCollector(new MemoryCollector());
      monitor.addCollector(new AudioCollector(mockAudioContext));
      
      let alertsReceived: any[] = [];
      monitor.subscribe((metrics, alerts) => {
        alertsReceived = alerts;
        qualityManager.processMetrics(metrics);
      });
      
      await monitor.start();
      
      // Create multiple issues simultaneously
      
      // 1. Low FPS
      const renderingCollector = new RenderingCollector(mockRenderer);
      for (let i = 0; i < 5; i++) {
        renderingCollector.onFrameStart();
        jest.advanceTimersByTime(50); // 20 FPS
        renderingCollector.onFrameEnd();
      }
      
      // 2. High memory
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 950 * 1024 * 1024,
          totalJSHeapSize: 1000 * 1024 * 1024,
          jsHeapSizeLimit: 1000 * 1024 * 1024
        }
      });
      
      jest.advanceTimersByTime(2000);
      
      // Should have multiple alerts
      expect(alertsReceived.length).toBeGreaterThanOrEqual(2);
      expect(alertsReceived.some(a => a.type === 'fps_drop')).toBe(true);
      expect(alertsReceived.some(a => a.type === 'memory_leak')).toBe(true);
      
      // Quality should be at lowest
      const profile = qualityManager.getCurrentProfile();
      expect(profile.name).toBe('Low');
    });
  });

  describe('Scenario 6: Dashboard Auto-Show', () => {
    it('should automatically show dashboard on critical alerts', async () => {
      monitor.addCollector(new RenderingCollector(mockRenderer));
      monitor.integrateWithStore(mockStore);
      
      await monitor.start();
      
      // Create critical performance issue
      const collector = new RenderingCollector(mockRenderer);
      for (let i = 0; i < 10; i++) {
        collector.onFrameStart();
        jest.advanceTimersByTime(100); // 10 FPS
        collector.onFrameEnd();
      }
      
      jest.advanceTimersByTime(2000);
      
      // Check dashboard was shown
      expect(mockStore.setState).toHaveBeenCalledWith(
        expect.objectContaining({
          showPerformanceDashboard: true
        })
      );
    });
  });

  describe('Scenario 7: Recovery and Quality Restoration', () => {
    it('should restore quality when performance improves', async () => {
      const renderingCollector = new RenderingCollector(mockRenderer);
      monitor.addCollector(renderingCollector);
      
      monitor.subscribe((metrics) => {
        qualityManager.processMetrics(metrics);
      });
      
      await monitor.start();
      
      // Start with poor performance
      qualityManager.setQualityProfile('low');
      
      // Simulate sustained good performance
      for (let i = 0; i < 50; i++) {
        renderingCollector.onFrameStart();
        jest.advanceTimersByTime(16); // 60 FPS
        renderingCollector.onFrameEnd();
        jest.advanceTimersByTime(84); // Complete 100ms cycle
      }
      
      // Wait for quality restoration
      jest.advanceTimersByTime(10000);
      
      // Quality should improve
      const profile = qualityManager.getCurrentProfile();
      expect(profile.name).not.toBe('Low');
      expect(profile.rendering.particleCount).toBeGreaterThan(5000);
    });
  });

  describe('Scenario 8: Store Integration', () => {
    it('should properly sync with Zustand store', async () => {
      monitor.integrateWithStore(mockStore);
      monitor.addCollector(new RenderingCollector(mockRenderer));
      monitor.addCollector(new MemoryCollector());
      
      await monitor.start();
      
      jest.advanceTimersByTime(1000);
      
      // Verify store updates
      expect(mockStore.setState).toHaveBeenCalled();
      const lastCall = mockStore.setState.mock.calls[mockStore.setState.mock.calls.length - 1][0];
      
      expect(lastCall).toHaveProperty('performanceMetrics');
      expect(lastCall).toHaveProperty('performanceAlerts');
      expect(lastCall.performanceMetrics).toHaveProperty('timestamp');
      expect(lastCall.performanceMetrics).toHaveProperty('rendering');
      expect(lastCall.performanceMetrics).toHaveProperty('memory');
    });
  });
});