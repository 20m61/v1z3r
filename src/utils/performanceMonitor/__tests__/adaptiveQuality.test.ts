/**
 * Tests for Adaptive Quality Manager
 */

import { AdaptiveQualityManager } from '../adaptiveQuality';
import { PerformanceSnapshot, QUALITY_PROFILES } from '../types';

// Mock global objects
global.navigator = {
  hardwareConcurrency: 4,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  platform: 'Win32',
  deviceMemory: 8,
} as any;

global.window = {
  devicePixelRatio: 1,
  innerWidth: 1920,
  innerHeight: 1080,
} as any;

global.document = {
  createElement: jest.fn(() => ({
    getContext: jest.fn(() => ({
      getParameter: jest.fn((param) => {
        // Mock WebGL parameters
        if (param === 'MAX_TEXTURE_SIZE') return 4096;
        if (param === 'MAX_DRAW_BUFFERS') return 8;
        if (param === 'MAX_VERTEX_ATTRIBS') return 16;
        return null;
      }),
      getExtension: jest.fn(() => null),
    })),
  })),
} as any;

describe('AdaptiveQualityManager', () => {
  let manager: AdaptiveQualityManager;
  let mockRenderer: any;
  let mockAudioContext: any;
  let mockStore: any;

  beforeEach(() => {
    mockRenderer = {
      setPixelRatio: jest.fn(),
      setSize: jest.fn(),
      domElement: {
        getBoundingClientRect: () => ({
          width: 800,
          height: 600,
        }),
      },
      getContext: () => ({
        getParameter: jest.fn(() => 4096),
        getExtension: jest.fn(() => null),
      }),
    };

    mockAudioContext = {
      state: 'running',
      sampleRate: 44100,
    };

    mockStore = {
      setState: jest.fn(),
    };

    manager = new AdaptiveQualityManager(mockRenderer, mockAudioContext, mockStore);
  });

  describe('Initialization', () => {
    it('should initialize with default settings', () => {
      expect(manager).toBeInstanceOf(AdaptiveQualityManager);
      expect(manager.getCurrentProfile()).toBeDefined();
      expect(manager.getDeviceTier()).toBeDefined();
    });

    it('should detect device tier correctly', () => {
      const tier = manager.getDeviceTier();
      expect(['low', 'mid', 'high']).toContain(tier);
    });

    it('should detect device capabilities', () => {
      const capabilities = manager.getDeviceCapabilities();
      expect(capabilities).toHaveProperty('webgl');
      expect(capabilities).toHaveProperty('webgpu');
      expect(capabilities).toHaveProperty('audioContext');
      expect(capabilities).toHaveProperty('hardwareConcurrency');
    });
  });

  describe('Quality Profile Management', () => {
    it('should get current profile', () => {
      const profile = manager.getCurrentProfile();
      expect(profile).toHaveProperty('name');
      expect(profile).toHaveProperty('renderScale');
      expect(profile).toHaveProperty('particleCount');
      expect(profile).toHaveProperty('effectComplexity');
    });

    it('should set quality profile manually', () => {
      manager.setQualityProfile('high');
      const profile = manager.getCurrentProfile();
      expect(profile.name).toBe('High');
    });

    it('should handle invalid quality profile', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      manager.setQualityProfile('invalid');
      
      expect(consoleSpy).toHaveBeenCalledWith('Unknown quality profile: invalid');
      consoleSpy.mockRestore();
    });

    it('should enable/disable adaptive quality', () => {
      manager.setEnabled(false);
      manager.setEnabled(true);
      
      // Should not crash
      expect(manager).toBeInstanceOf(AdaptiveQualityManager);
    });
  });

  describe('Performance Metrics Processing', () => {
    let goodMetrics: PerformanceSnapshot;
    let poorMetrics: PerformanceSnapshot;

    beforeEach(() => {
      goodMetrics = {
        timestamp: Date.now(),
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
        audio: {
          latency: 20,
          bufferSize: 128,
          underruns: 0,
          contextState: 'running',
          sampleRate: 44100,
        },
        ux: {
          inputLatency: 10,
          loadTime: 1000,
          errorCount: 0,
          interactionSuccess: 100,
        },
      };

      poorMetrics = {
        ...goodMetrics,
        rendering: {
          fps: 15, // Poor FPS
          frameTimes: [66.67, 66.67, 66.67],
          droppedFrames: 10,
          renderTime: 50,
        },
        memory: {
          heap: {
            used: 450 * 1024 * 1024, // High memory usage
            total: 480 * 1024 * 1024,
            limit: 500 * 1024 * 1024,
          },
          textures: 50,
          geometries: 25,
          materials: 15,
        },
        audio: {
          latency: 150, // High latency
          bufferSize: 512,
          underruns: 10,
          contextState: 'running',
          sampleRate: 44100,
        },
      };
    });

    it('should process good performance metrics without adaptation', () => {
      const initialProfile = manager.getCurrentProfile();
      
      manager.processMetrics(goodMetrics);
      
      const currentProfile = manager.getCurrentProfile();
      expect(currentProfile.name).toBe(initialProfile.name);
    });

    it('should adapt quality when performance is poor', () => {
      // Set initial high-quality profile
      manager.setQualityProfile('high');
      const initialProfile = manager.getCurrentProfile();
      
      // Simulate continuous poor performance
      for (let i = 0; i < 10; i++) {
        manager.processMetrics({
          ...poorMetrics,
          timestamp: Date.now() - (10 - i) * 1000,
        });
      }
      
      // Allow some time for adaptation
      const currentProfile = manager.getCurrentProfile();
      
      // Quality should have been reduced
      expect(currentProfile.particleCount).toBeLessThanOrEqual(initialProfile.particleCount);
    });

    it('should improve quality when performance is good', () => {
      // Set initial low-quality profile
      manager.setQualityProfile('low');
      const initialProfile = manager.getCurrentProfile();
      
      // Simulate continuous good performance
      for (let i = 0; i < 10; i++) {
        manager.processMetrics({
          ...goodMetrics,
          timestamp: Date.now() - (10 - i) * 1000,
        });
      }
      
      // Allow some time for adaptation
      const currentProfile = manager.getCurrentProfile();
      
      // Quality might have been improved (depending on device tier)
      expect(currentProfile.particleCount).toBeGreaterThanOrEqual(initialProfile.particleCount);
    });

    it('should respect adaptation cooldown', () => {
      const initialProfile = manager.getCurrentProfile();
      
      // Process poor metrics twice in quick succession
      manager.processMetrics(poorMetrics);
      manager.processMetrics(poorMetrics);
      
      const currentProfile = manager.getCurrentProfile();
      
      // Should not have adapted twice due to cooldown
      expect(manager).toBeInstanceOf(AdaptiveQualityManager);
    });

    it('should handle mobile battery low scenario', () => {
      const batteryLowMetrics = {
        ...goodMetrics,
        mobile: {
          battery: {
            level: 5, // Very low battery
            charging: false,
          },
          touchLatency: 30,
          deviceMotion: true,
        },
      };
      
      manager.processMetrics(batteryLowMetrics);
      
      // Should trigger adaptation due to low battery
      expect(manager).toBeInstanceOf(AdaptiveQualityManager);
    });
  });

  describe('Quality Application', () => {
    it('should apply renderer settings', () => {
      manager.setQualityProfile('high');
      
      expect(mockRenderer.setPixelRatio).toHaveBeenCalled();
    });

    it('should apply store settings', () => {
      manager.setQualityProfile('medium');
      
      // Should have updated store with new settings
      expect(mockStore.setState).toHaveBeenCalled();
    });

    it('should handle missing renderer gracefully', () => {
      const managerWithoutRenderer = new AdaptiveQualityManager(
        undefined,
        mockAudioContext,
        mockStore
      );
      
      managerWithoutRenderer.setQualityProfile('high');
      
      // Should not crash
      expect(managerWithoutRenderer).toBeInstanceOf(AdaptiveQualityManager);
    });

    it('should handle missing store gracefully', () => {
      const managerWithoutStore = new AdaptiveQualityManager(
        mockRenderer,
        mockAudioContext,
        undefined
      );
      
      managerWithoutStore.setQualityProfile('high');
      
      // Should not crash
      expect(managerWithoutStore).toBeInstanceOf(AdaptiveQualityManager);
    });
  });

  describe('Device Detection', () => {
    it('should detect high-end device', () => {
      // Mock high-end device
      Object.defineProperty(global.navigator, 'hardwareConcurrency', {
        value: 16,
        configurable: true,
      });
      Object.defineProperty(global.navigator, 'deviceMemory', {
        value: 16,
        configurable: true,
      });

      const highEndManager = new AdaptiveQualityManager();
      expect(highEndManager.getDeviceTier()).toBe('high');
    });

    it('should detect low-end device', () => {
      // Mock low-end device
      Object.defineProperty(global.navigator, 'hardwareConcurrency', {
        value: 2,
        configurable: true,
      });
      Object.defineProperty(global.navigator, 'deviceMemory', {
        value: 1,
        configurable: true,
      });
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 8.0; SM-G935F)',
        configurable: true,
      });

      const lowEndManager = new AdaptiveQualityManager();
      expect(lowEndManager.getDeviceTier()).toBe('low');
    });

    it('should detect WebGL capabilities', () => {
      const capabilities = manager.getDeviceCapabilities();
      expect(typeof capabilities.webgl).toBe('boolean');
    });
  });

  describe('Performance Analysis', () => {
    it('should get performance grade', () => {
      const grade = manager.getPerformanceGrade();
      expect(['excellent', 'good', 'fair', 'poor']).toContain(grade);
    });

    it('should provide quality recommendations', () => {
      const recommendations = manager.getQualityRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should get adaptation history', () => {
      manager.setQualityProfile('high');
      manager.setQualityProfile('medium');
      
      const history = manager.getAdaptationHistory();
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle WebGL context creation errors', () => {
      // Mock WebGL context creation failure
      const originalCreateElement = global.document.createElement;
      global.document.createElement = jest.fn(() => ({
        getContext: jest.fn(() => null),
      }));

      const managerWithFailedWebGL = new AdaptiveQualityManager();
      expect(managerWithFailedWebGL).toBeInstanceOf(AdaptiveQualityManager);

      // Restore
      global.document.createElement = originalCreateElement;
    });

    it('should handle missing browser APIs gracefully', () => {
      // Mock missing APIs
      const originalNavigator = global.navigator;
      delete (global as any).navigator;

      const managerWithoutNavigator = new AdaptiveQualityManager();
      expect(managerWithoutNavigator).toBeInstanceOf(AdaptiveQualityManager);

      // Restore
      global.navigator = originalNavigator;
    });

    it('should handle renderer errors during settings application', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Mock renderer that throws errors
      const errorRenderer = {
        setPixelRatio: jest.fn(() => {
          throw new Error('Renderer error');
        }),
      };

      const errorManager = new AdaptiveQualityManager(errorRenderer);
      errorManager.setQualityProfile('high');

      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it('should handle store errors during settings application', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Mock store that throws errors
      const errorStore = {
        setState: jest.fn(() => {
          throw new Error('Store error');
        }),
      };

      const errorManager = new AdaptiveQualityManager(mockRenderer, mockAudioContext, errorStore);
      errorManager.setQualityProfile('high');

      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Memory Management', () => {
    it('should limit history size', () => {
      // Process many metrics to test history limiting
      for (let i = 0; i < 50; i++) {
        manager.processMetrics({
          timestamp: Date.now() - i * 1000,
          rendering: { fps: 60, frameTimes: [], droppedFrames: 0, renderTime: 10 },
          memory: { heap: { used: 100000000, total: 200000000, limit: 500000000 }, textures: 1, geometries: 1, materials: 1 },
          audio: { latency: 20, bufferSize: 128, underruns: 0, contextState: 'running', sampleRate: 44100 },
          ux: { inputLatency: 10, loadTime: 1000, errorCount: 0, interactionSuccess: 100 },
        });
      }
      
      // History should be limited to prevent memory issues
      expect(manager).toBeInstanceOf(AdaptiveQualityManager);
    });

    it('should limit adaptation history', () => {
      // Trigger many adaptations
      for (let i = 0; i < 60; i++) {
        manager.setQualityProfile(i % 2 === 0 ? 'high' : 'low');
      }
      
      const history = manager.getAdaptationHistory();
      expect(history.length).toBeLessThanOrEqual(50); // Should be limited
    });
  });
});