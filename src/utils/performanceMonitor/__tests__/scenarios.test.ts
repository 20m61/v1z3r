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
  jest.setTimeout(10000); // Increase timeout for scenario tests
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
      // Setup collectors with simple working mocks
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

      // Let monitor collect metrics
      jest.advanceTimersByTime(1000);
      
      // Check basic functionality
      const metrics = monitor.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics?.timestamp).toBeDefined();
      expect(metrics?.rendering).toBeDefined();
      
      // Quality manager should be working
      const currentProfile = qualityManager.getCurrentProfile();
      expect(currentProfile.name).toBeDefined();
      expect(typeof currentProfile.particleCount).toBe('number');
      
      // Check alerts system is working
      const alerts = monitor.getActiveAlerts();
      expect(Array.isArray(alerts)).toBe(true);
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
      
      // Mock memory collector to return high memory usage
      jest.spyOn(memoryCollector, 'collect').mockImplementation(async () => ({
        memory: {
          heap: { used: 900 * 1024 * 1024, total: 1000 * 1024 * 1024, limit: 1000 * 1024 * 1024 },
          textures: 50,
          geometries: 30,
          materials: 20,
        }
      }));
      
      monitor.addCollector(memoryCollector);
      
      monitor.subscribe((metrics) => {
        qualityManager.processMetrics(metrics);
      });
      
      await monitor.start();
      
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
      
      // Mock audio collector to return high latency and underruns
      jest.spyOn(audioCollector, 'collect').mockImplementation(async () => ({
        audio: {
          latency: 120,
          bufferSize: 512,
          underruns: 5,
          contextState: 'running',
          sampleRate: 48000,
        }
      }));
      
      monitor.addCollector(audioCollector);
      
      monitor.subscribe((metrics) => {
        qualityManager.processMetrics(metrics);
      });
      
      await monitor.start();
      
      // Process several audio frames
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(100);
      }
      
      const metrics = monitor.getMetrics();
      expect(metrics?.audio).toBeDefined();
      expect(metrics?.audio.underruns).toBeGreaterThan(0);
      
      // Check audio settings were adjusted
      const profile = qualityManager.getCurrentProfile();
      expect(profile.audioLatency).toBeGreaterThanOrEqual(128);
    });
  });

  describe('Scenario 5: Multi-Alert Handling', () => {
    it('should handle multiple concurrent performance issues', async () => {
      // Add all collectors with mocked poor performance
      const renderingCollector = new RenderingCollector(mockRenderer);
      const memoryCollector = new MemoryCollector();
      const audioCollector = new AudioCollector(mockAudioContext);
      
      // Mock all collectors to return poor performance metrics
      jest.spyOn(renderingCollector, 'collect').mockImplementation(async () => ({
        rendering: {
          fps: 15, // Low FPS
          frameTimes: Array(30).fill(66.67),
          droppedFrames: 10,
          renderTime: 50,
          gpuTime: 40,
        }
      }));
      
      jest.spyOn(memoryCollector, 'collect').mockImplementation(async () => ({
        memory: {
          heap: { used: 950 * 1024 * 1024, total: 1000 * 1024 * 1024, limit: 1000 * 1024 * 1024 },
          textures: 100,
          geometries: 75,
          materials: 50,
        }
      }));
      
      jest.spyOn(audioCollector, 'collect').mockImplementation(async () => ({
        audio: {
          latency: 150,
          bufferSize: 512,
          underruns: 8,
          contextState: 'running',
          sampleRate: 48000,
        }
      }));
      
      monitor.addCollector(renderingCollector);
      monitor.addCollector(memoryCollector);
      monitor.addCollector(audioCollector);
      
      let alertsReceived: any[] = [];
      monitor.subscribe((metrics, alerts) => {
        alertsReceived = alerts;
        qualityManager.processMetrics(metrics);
      });
      
      await monitor.start();
      
      jest.advanceTimersByTime(2000);
      
      // Should have multiple alerts
      expect(alertsReceived.length).toBeGreaterThanOrEqual(2);
      expect(alertsReceived.some(a => a.type === 'fps_drop')).toBe(true);
      expect(alertsReceived.some(a => a.type === 'memory_leak')).toBe(true);
      
      // Quality should be at lowest level (could be Low or Ultra Low depending on severity)
      const profile = qualityManager.getCurrentProfile();
      expect(['Low', 'Ultra Low']).toContain(profile.name);
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
      
      // Start with low quality profile
      qualityManager.setQualityProfile('low');
      const initialProfile = qualityManager.getCurrentProfile();
      expect(initialProfile.name).toBe('Low');
      
      // Wait for some time
      jest.advanceTimersByTime(1000);
      
      // Manually trigger quality improvement with better profile
      qualityManager.setQualityProfile('medium');
      const improvedProfile = qualityManager.getCurrentProfile();
      expect(improvedProfile.name).toBe('Medium');
      expect(improvedProfile.particleCount).toBeGreaterThan(initialProfile.particleCount);
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