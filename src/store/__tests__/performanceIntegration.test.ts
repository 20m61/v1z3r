/**
 * Tests for Performance Monitoring Integration with Zustand Store
 */

import { renderHook, act } from '@testing-library/react';
import { useVisualizerStore } from '../visualizerStore';
import { QUALITY_PROFILES } from '@/utils/performanceMonitor/types';

// Mock the performance monitoring modules
jest.mock('@/utils/performanceMonitor/core', () => ({
  PerformanceMonitor: jest.fn().mockImplementation(() => ({
    subscribe: jest.fn((callback) => {
      // Simulate metrics update
      const mockMetrics = {
        timestamp: Date.now(),
        rendering: { fps: 60, frameTimes: [], droppedFrames: 0, renderTime: 10 },
        memory: { heap: { used: 100000000, total: 200000000, limit: 500000000 }, textures: 1, geometries: 1, materials: 1 },
        audio: { latency: 20, bufferSize: 128, underruns: 0, contextState: 'running', sampleRate: 44100 },
        ux: { inputLatency: 10, loadTime: 1000, errorCount: 0, interactionSuccess: 100 },
      };
      const mockAlerts = [];
      callback(mockMetrics, mockAlerts);
      return jest.fn(); // unsubscribe function
    }),
    addCollector: jest.fn(),
    start: jest.fn().mockResolvedValue(undefined),
    acknowledgeAlert: jest.fn(),
    resolveAlert: jest.fn(),
  })),
}));

jest.mock('@/utils/performanceMonitor/adaptiveQuality', () => ({
  AdaptiveQualityManager: jest.fn().mockImplementation(() => ({
    processMetrics: jest.fn(),
    setQualityProfile: jest.fn(),
    setEnabled: jest.fn(),
    getCurrentProfile: jest.fn(() => QUALITY_PROFILES.medium),
  })),
}));

jest.mock('@/utils/performanceMonitor/collectors/renderingCollector', () => ({
  RenderingCollector: jest.fn().mockImplementation(() => ({
    name: 'rendering',
    enabled: true,
  })),
}));

jest.mock('@/utils/performanceMonitor/collectors/memoryCollector', () => ({
  MemoryCollector: jest.fn().mockImplementation(() => ({
    name: 'memory',
    enabled: true,
  })),
}));

jest.mock('@/utils/performanceMonitor/collectors/audioCollector', () => ({
  AudioCollector: jest.fn().mockImplementation(() => ({
    name: 'audio',
    enabled: true,
  })),
}));

jest.mock('@/utils/performanceMonitor/collectors/mobileCollector', () => ({
  MobileCollector: jest.fn().mockImplementation(() => ({
    name: 'mobile',
    enabled: true,
  })),
}));

describe('Performance Monitoring Store Integration', () => {
  beforeEach(() => {
    // Reset store state before each test
    useVisualizerStore.setState({
      performanceMonitor: undefined,
      adaptiveQualityManager: undefined,
      performanceMetrics: undefined,
      performanceAlerts: [],
      performanceProfile: QUALITY_PROFILES.medium,
      performanceDashboardVisible: false,
      maxParticles: 1000,
      effectComplexity: 3,
      renderScale: 1.0,
      qualityLevel: 'Medium',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial performance state', () => {
      const { result } = renderHook(() => useVisualizerStore());
      
      expect(result.current.performanceMonitor).toBeUndefined();
      expect(result.current.adaptiveQualityManager).toBeUndefined();
      expect(result.current.performanceMetrics).toBeUndefined();
      expect(result.current.performanceAlerts).toEqual([]);
      expect(result.current.performanceProfile).toEqual(QUALITY_PROFILES.medium);
      expect(result.current.performanceDashboardVisible).toBe(false);
      expect(result.current.maxParticles).toBe(1000);
      expect(result.current.effectComplexity).toBe(3);
      expect(result.current.renderScale).toBe(1.0);
      expect(result.current.qualityLevel).toBe('Medium');
    });
  });

  describe('Performance Monitor Initialization', () => {
    it('should initialize performance monitoring system', async () => {
      const { result } = renderHook(() => useVisualizerStore());
      
      await act(async () => {
        await result.current.initializePerformanceMonitoring();
      });
      
      expect(result.current.performanceMonitor).toBeDefined();
      expect(result.current.adaptiveQualityManager).toBeDefined();
    });

    it('should initialize with renderer and audio context', async () => {
      const { result } = renderHook(() => useVisualizerStore());
      
      const mockRenderer = { info: {}, getContext: () => ({}) };
      const mockAudioContext = { state: 'running', sampleRate: 44100 };
      
      // Set audio context in store
      act(() => {
        result.current.setAudioContext(mockAudioContext as any);
      });
      
      await act(async () => {
        await result.current.initializePerformanceMonitoring(mockRenderer);
      });
      
      expect(result.current.performanceMonitor).toBeDefined();
      expect(result.current.adaptiveQualityManager).toBeDefined();
    });

    it('should handle initialization errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock PerformanceMonitor to throw during initialization
      const { PerformanceMonitor } = require('@/utils/performanceMonitor/core');
      PerformanceMonitor.mockImplementationOnce(() => {
        throw new Error('Initialization failed');
      });
      
      const { result } = renderHook(() => useVisualizerStore());
      
      await act(async () => {
        await result.current.initializePerformanceMonitoring();
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to initialize performance monitoring:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Metrics Updates', () => {
    it('should update performance metrics', () => {
      const { result } = renderHook(() => useVisualizerStore());
      
      const mockMetrics = {
        timestamp: Date.now(),
        rendering: { fps: 45, frameTimes: [], droppedFrames: 5, renderTime: 20 },
        memory: { heap: { used: 150000000, total: 250000000, limit: 500000000 }, textures: 15, geometries: 8, materials: 5 },
        audio: { latency: 30, bufferSize: 256, underruns: 2, contextState: 'running' as const, sampleRate: 44100 },
        ux: { inputLatency: 15, loadTime: 1200, errorCount: 1, interactionSuccess: 95 },
      };
      
      act(() => {
        result.current.updatePerformanceMetrics(mockMetrics);
      });
      
      expect(result.current.performanceMetrics).toEqual(mockMetrics);
    });

    it('should update performance alerts', () => {
      const { result } = renderHook(() => useVisualizerStore());
      
      const mockAlerts = [
        {
          id: 'alert-1',
          type: 'fps_drop' as const,
          severity: 'warning' as const,
          message: 'FPS dropped below 30',
          timestamp: Date.now(),
          acknowledged: false,
          resolved: false,
        },
      ];
      
      act(() => {
        result.current.updatePerformanceAlerts(mockAlerts);
      });
      
      expect(result.current.performanceAlerts).toEqual(mockAlerts);
    });
  });

  describe('Quality Profile Management', () => {
    it('should update performance profile', () => {
      const { result } = renderHook(() => useVisualizerStore());
      
      const highProfile = QUALITY_PROFILES.high;
      
      act(() => {
        result.current.updatePerformanceProfile(highProfile);
      });
      
      expect(result.current.performanceProfile).toEqual(highProfile);
      expect(result.current.maxParticles).toBe(highProfile.particleCount);
      expect(result.current.effectComplexity).toBe(highProfile.effectComplexity);
      expect(result.current.renderScale).toBe(highProfile.renderScale);
      expect(result.current.qualityLevel).toBe(highProfile.name);
    });

    it('should set quality profile by name', async () => {
      const { result } = renderHook(() => useVisualizerStore());
      
      // Initialize performance monitoring first
      await act(async () => {
        await result.current.initializePerformanceMonitoring();
      });
      
      act(() => {
        result.current.setQualityProfile('high');
      });
      
      const highProfile = QUALITY_PROFILES.high;
      expect(result.current.performanceProfile).toEqual(highProfile);
      expect(result.current.maxParticles).toBe(highProfile.particleCount);
      expect(result.current.effectComplexity).toBe(highProfile.effectComplexity);
      expect(result.current.renderScale).toBe(highProfile.renderScale);
      expect(result.current.qualityLevel).toBe(highProfile.name);
    });

    it('should handle invalid quality profile name', () => {
      const { result } = renderHook(() => useVisualizerStore());
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      act(() => {
        result.current.setQualityProfile('invalid');
      });
      
      expect(consoleSpy).toHaveBeenCalledWith('Unknown quality profile: invalid');
      consoleSpy.mockRestore();
    });

    it('should handle quality profile change without adaptive manager', () => {
      const { result } = renderHook(() => useVisualizerStore());
      
      // Should not crash when adaptive manager is not initialized
      act(() => {
        result.current.setQualityProfile('low');
      });
      
      expect(result.current.performanceProfile).toEqual(QUALITY_PROFILES.low);
    });
  });

  describe('Dashboard Management', () => {
    it('should toggle performance dashboard visibility', () => {
      const { result } = renderHook(() => useVisualizerStore());
      
      expect(result.current.performanceDashboardVisible).toBe(false);
      
      act(() => {
        result.current.togglePerformanceDashboard();
      });
      
      expect(result.current.performanceDashboardVisible).toBe(true);
      
      act(() => {
        result.current.togglePerformanceDashboard();
      });
      
      expect(result.current.performanceDashboardVisible).toBe(false);
    });
  });

  describe('Alert Management', () => {
    it('should acknowledge performance alert', async () => {
      const { result } = renderHook(() => useVisualizerStore());
      
      // Initialize performance monitoring first
      await act(async () => {
        await result.current.initializePerformanceMonitoring();
      });
      
      act(() => {
        result.current.acknowledgePerformanceAlert('alert-1');
      });
      
      // Should call the monitor's acknowledgeAlert method
      expect(result.current.performanceMonitor?.acknowledgeAlert).toHaveBeenCalledWith('alert-1');
    });

    it('should resolve performance alert', async () => {
      const { result } = renderHook(() => useVisualizerStore());
      
      // Initialize performance monitoring first
      await act(async () => {
        await result.current.initializePerformanceMonitoring();
      });
      
      act(() => {
        result.current.resolvePerformanceAlert('alert-1');
      });
      
      // Should call the monitor's resolveAlert method
      expect(result.current.performanceMonitor?.resolveAlert).toHaveBeenCalledWith('alert-1');
    });

    it('should handle alert actions without monitor', () => {
      const { result } = renderHook(() => useVisualizerStore());
      
      // Should not crash when monitor is not initialized
      act(() => {
        result.current.acknowledgePerformanceAlert('alert-1');
        result.current.resolvePerformanceAlert('alert-1');
      });
      
      // No errors should occur
      expect(result.current.performanceMonitor).toBeUndefined();
    });
  });

  describe('Adaptive Quality Management', () => {
    it('should set adaptive quality enabled', async () => {
      const { result } = renderHook(() => useVisualizerStore());
      
      // Initialize performance monitoring first
      await act(async () => {
        await result.current.initializePerformanceMonitoring();
      });
      
      act(() => {
        result.current.setAdaptiveQualityEnabled(false);
      });
      
      // Should call the quality manager's setEnabled method
      expect(result.current.adaptiveQualityManager?.setEnabled).toHaveBeenCalledWith(false);
    });

    it('should handle adaptive quality toggle without manager', () => {
      const { result } = renderHook(() => useVisualizerStore());
      
      // Should not crash when quality manager is not initialized
      act(() => {
        result.current.setAdaptiveQualityEnabled(true);
      });
      
      // No errors should occur
      expect(result.current.adaptiveQualityManager).toBeUndefined();
    });
  });

  describe('Integration with Existing Features', () => {
    it('should work alongside audio context management', async () => {
      const { result } = renderHook(() => useVisualizerStore());
      
      const mockAudioContext = { state: 'running', sampleRate: 44100 };
      
      // Set audio context
      act(() => {
        result.current.setAudioContext(mockAudioContext as any);
      });
      
      // Initialize performance monitoring
      await act(async () => {
        await result.current.initializePerformanceMonitoring();
      });
      
      expect(result.current.audioContext).toBe(mockAudioContext);
      expect(result.current.performanceMonitor).toBeDefined();
    });

    it('should integrate with MIDI functionality', async () => {
      const { result } = renderHook(() => useVisualizerStore());
      
      // Enable MIDI
      act(() => {
        result.current.setMIDIEnabled(true);
      });
      
      // Initialize performance monitoring
      await act(async () => {
        await result.current.initializePerformanceMonitoring();
      });
      
      expect(result.current.isMIDIEnabled).toBe(true);
      expect(result.current.performanceMonitor).toBeDefined();
    });

    it('should work with layer management', async () => {
      const { result } = renderHook(() => useVisualizerStore());
      
      // Add a new layer
      act(() => {
        result.current.addLayer({
          type: 'waveform',
          active: true,
          opacity: 0.8,
          colorTheme: '#ff0000',
          sensitivity: 1.2,
        });
      });
      
      // Initialize performance monitoring
      await act(async () => {
        await result.current.initializePerformanceMonitoring();
      });
      
      expect(result.current.layers).toHaveLength(2); // default + new layer
      expect(result.current.performanceMonitor).toBeDefined();
    });

    it('should maintain performance settings with preset management', () => {
      const { result } = renderHook(() => useVisualizerStore());
      
      // Change quality profile
      act(() => {
        result.current.setQualityProfile('high');
      });
      
      // Save preset
      act(() => {
        result.current.savePreset('High Quality Setup');
      });
      
      // Load preset
      const presetId = result.current.presets[0].id;
      act(() => {
        result.current.loadPreset(presetId);
      });
      
      // Performance settings should be maintained
      expect(result.current.performanceProfile).toEqual(QUALITY_PROFILES.high);
    });
  });

  describe('Memory Management', () => {
    it('should clean up subscriptions properly', async () => {
      const { result, unmount } = renderHook(() => useVisualizerStore());
      
      await act(async () => {
        await result.current.initializePerformanceMonitoring();
      });
      
      const monitor = result.current.performanceMonitor;
      const unsubscribeMock = monitor?.subscribe as jest.Mock;
      const unsubscribeFunction = unsubscribeMock.mock.results[0]?.value;
      
      // Unmount should trigger cleanup
      unmount();
      
      // Verify unsubscribe was returned and can be called
      expect(typeof unsubscribeFunction).toBe('function');
    });

    it('should handle concurrent initialization attempts', async () => {
      const { result } = renderHook(() => useVisualizerStore());
      
      // Start multiple initialization attempts concurrently
      const promises = [
        result.current.initializePerformanceMonitoring(),
        result.current.initializePerformanceMonitoring(),
        result.current.initializePerformanceMonitoring(),
      ];
      
      await act(async () => {
        await Promise.all(promises);
      });
      
      // Should handle concurrent initialization gracefully
      expect(result.current.performanceMonitor).toBeDefined();
    });
  });
});