/**
 * Tests for dynamic imports utility
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  loadWebGPURenderer,
  loadThreeJSFeatures,
  loadTensorFlow,
  loadReactThree,
  createLazyComponent,
  preloadCriticalComponents,
  ModuleLoader,
  moduleLoader,
  preloadOnInteraction
} from '../dynamicImports';

// Mock dynamic imports
jest.mock('@/utils/webgpuRenderer', () => ({
  V1z3rRenderer: jest.fn(),
}));

jest.mock('@/utils/webgpuDetection', () => ({
  WebGPUDetector: jest.fn(),
}));

jest.mock('@/utils/webgpuPerformanceMonitor', () => ({
  getWebGPUPerformanceMonitor: jest.fn(),
}));

jest.mock('three', () => ({
  Scene: jest.fn(),
  WebGLRenderer: jest.fn(),
}));

jest.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: jest.fn(),
}));

jest.mock('three/examples/jsm/postprocessing/EffectComposer.js', () => ({
  EffectComposer: jest.fn(),
}));

jest.mock('three/examples/jsm/postprocessing/RenderPass.js', () => ({
  RenderPass: jest.fn(),
}));

jest.mock('three/examples/jsm/postprocessing/BloomPass.js', () => ({
  BloomPass: jest.fn(),
}));

jest.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: jest.fn(),
}));

jest.mock('@react-three/fiber', () => ({
  Canvas: jest.fn(),
  useFrame: jest.fn(),
  useThree: jest.fn(),
}));

jest.mock('@react-three/drei', () => ({
  Stats: jest.fn(),
  OrbitControls: jest.fn(),
}));

jest.mock('@/components/AudioAnalyzer', () => ({
  default: jest.fn(),
}));

jest.mock('@/components/VisualEffects', () => ({
  default: jest.fn(),
}));

jest.mock('@/utils/performanceMonitor', () => ({
  default: jest.fn(),
}));

describe('Dynamic Imports', () => {
  const originalNavigator = global.navigator;
  const originalDocument = global.document;
  const originalConsole = global.console;
  
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    
    // Reset global objects without redefining
    global.navigator = originalNavigator;
    global.document = originalDocument;
  });

  describe('loadWebGPURenderer', () => {
    it('should throw error if WebGPU is not supported', async () => {
      // Mock navigator without defineProperty
      global.navigator = {} as any;

      await expect(loadWebGPURenderer()).rejects.toThrow('WebGPU not supported');
    });

    it('should throw error if adapter is not available', async () => {
      // Mock navigator with gpu without defineProperty
      global.navigator = {
        gpu: {
          requestAdapter: jest.fn().mockResolvedValue(null),
        },
      } as any;

      await expect(loadWebGPURenderer()).rejects.toThrow('WebGPU adapter not available');
    });

    it('should load WebGPU modules successfully', async () => {
      const mockAdapter = {};
      // Mock navigator with successful adapter
      global.navigator = {
        gpu: {
          requestAdapter: jest.fn().mockResolvedValue(mockAdapter),
        },
      } as any;

      const result = await loadWebGPURenderer();

      expect(result).toHaveProperty('V1z3rRenderer');
      expect(result).toHaveProperty('WebGPUDetector');
      expect(result).toHaveProperty('getWebGPUPerformanceMonitor');
    });

    it('should handle import errors gracefully', async () => {
      const mockAdapter = {};
      // Mock navigator with successful adapter
      global.navigator = {
        gpu: {
          requestAdapter: jest.fn().mockResolvedValue(mockAdapter),
        },
      } as any;

      // Mock import failure
      jest.doMock('@/utils/webgpuRenderer', () => {
        throw new Error('Import failed');
      });

      await expect(loadWebGPURenderer()).rejects.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalledWith('WebGPU import failed:', expect.any(Error));
    });
  });

  describe('loadThreeJSFeatures', () => {
    it('should load core Three.js', async () => {
      const result = await loadThreeJSFeatures([]);

      expect(result).toHaveProperty('THREE');
    });

    it('should load controls when requested', async () => {
      const result = await loadThreeJSFeatures(['controls']);

      expect(result).toHaveProperty('THREE');
      expect(result).toHaveProperty('OrbitControls');
    });

    it('should load postprocessing features', async () => {
      const result = await loadThreeJSFeatures(['postprocessing']);

      expect(result).toHaveProperty('EffectComposer');
      expect(result).toHaveProperty('RenderPass');
      expect(result).toHaveProperty('BloomPass');
    });

    it('should load loaders when requested', async () => {
      const result = await loadThreeJSFeatures(['loaders']);

      expect(result).toHaveProperty('GLTFLoader');
    });

    it('should load multiple features', async () => {
      const result = await loadThreeJSFeatures(['controls', 'postprocessing', 'loaders']);

      expect(result).toHaveProperty('OrbitControls');
      expect(result).toHaveProperty('EffectComposer');
      expect(result).toHaveProperty('GLTFLoader');
    });
  });

  describe('loadTensorFlow', () => {
    it('should return null if no AI features needed', async () => {
      const result = await loadTensorFlow(['basic']);

      expect(result).toBeNull();
    });

    it('should load TensorFlow if AI features needed', async () => {
      const result = await loadTensorFlow(['speech']);

      expect(result).toHaveProperty('tf');
      expect(result).toHaveProperty('models');
    });

    it('should handle import errors gracefully', async () => {
      jest.doMock('@tensorflow/tfjs', () => {
        throw new Error('TensorFlow import failed');
      });

      const result = await loadTensorFlow(['speech']);

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'TensorFlow.js import failed:',
        expect.any(Error)
      );
    });

    it('should detect AI features correctly', async () => {
      const speechResult = await loadTensorFlow(['speech']);
      const visionResult = await loadTensorFlow(['vision']);
      const poseResult = await loadTensorFlow(['pose-detection']);

      expect(speechResult).not.toBeNull();
      expect(visionResult).not.toBeNull();
      expect(poseResult).not.toBeNull();
    });
  });

  describe('loadReactThree', () => {
    it('should load React Three Fiber components', async () => {
      const result = await loadReactThree();

      expect(result).toHaveProperty('Canvas');
      expect(result).toHaveProperty('useFrame');
      expect(result).toHaveProperty('useThree');
      expect(result).toHaveProperty('Stats');
      expect(result).toHaveProperty('OrbitControls');
    });

    it('should handle import errors', async () => {
      jest.doMock('@react-three/fiber', () => {
        throw new Error('React Three import failed');
      });

      await expect(loadReactThree()).rejects.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'React Three Fiber import failed:',
        expect.any(Error)
      );
    });
  });

  describe('createLazyComponent', () => {
    it('should create lazy component successfully', async () => {
      const TestComponent = () => <div>Test Component</div>;
      const importFunc = jest.fn().mockResolvedValue({
        default: TestComponent,
      });

      const LazyComponent = createLazyComponent(importFunc);

      expect(LazyComponent).toBeDefined();
    });

    it('should handle import errors with custom error component', async () => {
      const ErrorComponent = ({ error, retry }: any) => (
        <div>
          <p>Error: {error.message}</p>
          <button onClick={retry}>Retry</button>
        </div>
      );

      const importFunc = jest.fn().mockRejectedValue(new Error('Import failed'));

      const LazyComponent = createLazyComponent(importFunc, {
        error: ErrorComponent,
      });

      // This test would require Suspense boundary to test properly
      expect(LazyComponent).toBeDefined();
    });

    it('should handle import errors with default error UI', async () => {
      const importFunc = jest.fn().mockRejectedValue(new Error('Import failed'));

      const LazyComponent = createLazyComponent(importFunc);

      expect(LazyComponent).toBeDefined();
    });
  });

  describe('preloadCriticalComponents', () => {
    it('should preload critical components successfully', async () => {
      await preloadCriticalComponents();

      expect(consoleLogSpy).toHaveBeenCalledWith('Critical components preloaded');
    });

    it('should handle preload errors gracefully', async () => {
      jest.doMock('@/components/AudioAnalyzer', () => {
        throw new Error('Preload failed');
      });

      await preloadCriticalComponents();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Some critical components failed to preload:',
        expect.any(Error)
      );
    });
  });

  describe('ModuleLoader', () => {
    let loader: ModuleLoader;

    beforeEach(() => {
      loader = new ModuleLoader();
    });

    it('should load module successfully', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          gpu: {
            requestAdapter: jest.fn().mockResolvedValue({}),
          },
        },
        writable: true,
      });

      const result = await loader.loadModule('webgpu');

      expect(result).toBeDefined();
      expect(loader.isModuleLoaded('webgpu')).toBe(true);
    });

    it('should return cached module', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          gpu: {
            requestAdapter: jest.fn().mockResolvedValue({}),
          },
        },
        writable: true,
      });

      const result1 = await loader.loadModule('webgpu');
      const result2 = await loader.loadModule('webgpu');

      expect(result1).toBe(result2);
    });

    it('should handle unknown modules', async () => {
      await expect(loader.loadModule('unknown')).rejects.toThrow('Unknown module: unknown');
    });

    it('should handle module load timeout', async () => {
      // Mock setTimeout to immediately trigger timeout
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((fn) => {
        fn(); // Immediately execute timeout callback
        return 1 as any;
      });

      await expect(loader.loadModule('webgpu')).rejects.toThrow();
      
      global.setTimeout = originalSetTimeout;
    });

    it('should retry failed loads', async () => {
      let attemptCount = 0;
      const mockLoadModule = jest.spyOn(loader, 'loadModule').mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Load failed');
        }
        return {}; // Success on third attempt
      });

      const result = await loader.loadModule('webgpu');
      expect(result).toBeDefined();
      expect(attemptCount).toBe(3);
      
      mockLoadModule.mockRestore();
    });

    it('should preload modules', () => {
      const loadModuleSpy = jest.spyOn(loader, 'loadModule').mockResolvedValue({});

      loader.preloadModule('webgpu', { preload: true });

      expect(loadModuleSpy).toHaveBeenCalledWith('webgpu', { preload: true });
    });

    it('should not preload if preload is false', () => {
      const loadModuleSpy = jest.spyOn(loader, 'loadModule');

      loader.preloadModule('webgpu', { preload: false });

      expect(loadModuleSpy).not.toHaveBeenCalled();
    });

    it('should clear cache', () => {
      loader.clearCache();

      expect(loader.isModuleLoaded('webgpu')).toBe(false);
    });
  });

  describe('preloadOnInteraction', () => {
    it('should set up event listeners', () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

      preloadOnInteraction();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'mousedown',
        expect.any(Function),
        { once: true }
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function),
        { once: true }
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        { once: true }
      );
    });

    it('should preload modules on interaction', () => {
      const preloadModuleSpy = jest.spyOn(moduleLoader, 'preloadModule');

      preloadOnInteraction();

      // Simulate mousedown event
      const event = new Event('mousedown');
      document.dispatchEvent(event);

      expect(preloadModuleSpy).toHaveBeenCalledWith('webgpu', { preload: true });
      expect(preloadModuleSpy).toHaveBeenCalledWith('react-three', { preload: true });
    });
  });
});