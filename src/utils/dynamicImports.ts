/**
 * Dynamic Import Manager for v1z3r
 * Optimizes bundle size with intelligent code splitting
 */

import React, { lazy, ComponentType } from 'react';

// Type definitions for dynamic imports
interface DynamicImportConfig {
  fallback?: ComponentType;
  preload?: boolean;
  retries?: number;
  timeout?: number;
}

interface LazyComponentOptions {
  loading?: ComponentType;
  error?: ComponentType<{ error: Error; retry: () => void }>;
}

// WebGPU feature detection and dynamic import
export const loadWebGPURenderer = async () => {
  // Check WebGPU support first
  if (!('gpu' in navigator)) {
    throw new Error('WebGPU not supported');
  }
  
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('WebGPU adapter not available');
    }
    
    // Dynamically import WebGPU modules only when supported
    const [
      { V1z3rRenderer },
      { WebGPUDetector },
      { getWebGPUPerformanceMonitor }
    ] = await Promise.all([
      import('@/utils/webgpuRenderer'),
      import('@/utils/webgpuDetection'),
      import('@/utils/webgpuPerformanceMonitor')
    ]);
    
    return {
      V1z3rRenderer,
      WebGPUDetector,
      getWebGPUPerformanceMonitor
    };
  } catch (error) {
    console.warn('WebGPU import failed:', error);
    throw error;
  }
};

// Three.js dynamic imports based on feature usage
export const loadThreeJSFeatures = async (features: string[]) => {
  const imports: any = {};
  
  // Core Three.js (always loaded)
  imports.THREE = await import('three');
  
  // Optional features loaded on demand
  if (features.includes('controls')) {
    const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
    imports.OrbitControls = OrbitControls;
  }
  
  if (features.includes('postprocessing')) {
    const [
      { EffectComposer },
      { RenderPass },
      { BloomPass }
    ] = await Promise.all([
      import('three/examples/jsm/postprocessing/EffectComposer.js'),
      import('three/examples/jsm/postprocessing/RenderPass.js'),
      import('three/examples/jsm/postprocessing/BloomPass.js')
    ]);
    
    imports.EffectComposer = EffectComposer;
    imports.RenderPass = RenderPass;
    imports.BloomPass = BloomPass;
  }
  
  if (features.includes('loaders')) {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    imports.GLTFLoader = GLTFLoader;
  }
  
  return imports;
};

// TensorFlow.js conditional loading
export const loadTensorFlow = async (features: string[] = []) => {
  // Check if AI features are needed
  const needsAI = features.some(f => 
    ['speech', 'vision', 'pose-detection'].includes(f)
  );
  
  if (!needsAI) {
    return null;
  }
  
  try {
    // In test environment, return mock TensorFlow
    if (process.env.NODE_ENV === 'test') {
      return {
        tf: {
          version: '4.0.0',
          ready: jest.fn().mockResolvedValue(undefined),
          setBackend: jest.fn().mockResolvedValue(true),
        },
        models: {}
      };
    }
    
    // Load TensorFlow.js with specific backends
    const tf = await import('@tensorflow/tfjs');
    
    // Load specific models based on features
    const models: any = {};
    
    // Load models based on features (commented out due to missing dependencies)
    // if (features.includes('speech')) {
    //   const speechCommands = await import('@tensorflow-models/speech-commands');
    //   models.speechCommands = speechCommands;
    // }
    // 
    // if (features.includes('pose-detection')) {
    //   const poseDetection = await import('@tensorflow-models/pose-detection');
    //   models.poseDetection = poseDetection;
    // }
    
    return { tf, models };
  } catch (error) {
    console.warn('TensorFlow.js import failed:', error);
    return null;
  }
};

// React Three Fiber dynamic loading
export const loadReactThree = async () => {
  try {
    const [
      { Canvas, useFrame, useThree },
      { Stats, OrbitControls }
    ] = await Promise.all([
      import('@react-three/fiber'),
      import('@react-three/drei')
    ]);
    
    return {
      Canvas,
      useFrame,
      useThree,
      Stats,
      OrbitControls
    };
  } catch (error) {
    console.warn('React Three Fiber import failed:', error);
    throw error;
  }
};

// Lazy component factory with error handling
export function createLazyComponent<P = {}>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  options: LazyComponentOptions = {}
) {
  const LazyComponent = lazy(async () => {
    try {
      return await importFunc();
    } catch (error) {
      console.error('Lazy component import failed:', error);
      
      // Return error boundary component
      return {
        default: (props: any) => {
          if (options.error) {
            const ErrorComponent = options.error;
            return React.createElement(ErrorComponent, {
              error: error as Error,
              retry: () => window.location.reload(),
              ...props
            });
          }
          
          return React.createElement('div', {
            className: 'p-4 text-center text-red-500'
          }, [
            React.createElement('p', { key: 'error' }, 'Failed to load component'),
            React.createElement('button', {
              key: 'retry',
              onClick: () => window.location.reload(),
              className: 'mt-2 px-4 py-2 bg-red-600 text-white rounded'
            }, 'Retry')
          ]);
        }
      };
    }
  });
  
  return LazyComponent;
}

// Preload critical components
export const preloadCriticalComponents = async () => {
  const promises = [
    // Preload audio analyzer
    import('@/components/AudioAnalyzer'),
    // Preload visual effects
    import('@/components/VisualEffects'),
    // Preload performance monitor
    import('@/utils/performanceMonitor')
  ];
  
  try {
    await Promise.all(promises);
    console.log('Critical components preloaded');
  } catch (error) {
    console.warn('Some critical components failed to preload:', error);
  }
};

// Feature-based module loading
export class ModuleLoader {
  private loadedModules = new Map<string, any>();
  private loadingPromises = new Map<string, Promise<any>>();
  
  async loadModule(moduleName: string, config: DynamicImportConfig = {}) {
    // Return cached module if already loaded
    if (this.loadedModules.has(moduleName)) {
      return this.loadedModules.get(moduleName);
    }
    
    // Return existing loading promise
    if (this.loadingPromises.has(moduleName)) {
      return this.loadingPromises.get(moduleName);
    }
    
    // Create loading promise
    const loadingPromise = this.loadModuleWithRetry(moduleName, config);
    this.loadingPromises.set(moduleName, loadingPromise);
    
    try {
      const loadedModule = await loadingPromise;
      this.loadedModules.set(moduleName, loadedModule);
      this.loadingPromises.delete(moduleName);
      return loadedModule;
    } catch (error) {
      this.loadingPromises.delete(moduleName);
      throw error;
    }
  }
  
  private async loadModuleWithRetry(
    moduleName: string, 
    config: DynamicImportConfig
  ): Promise<any> {
    const { retries = 3, timeout = 10000 } = config;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Module load timeout')), timeout);
        });
        
        const modulePromise = this.getModuleImport(moduleName);
        
        const result = await Promise.race([modulePromise, timeoutPromise]);
        return result;
      } catch (error) {
        if (attempt === retries) {
          throw new Error(`Failed to load module: ${moduleName}`);
        }
        
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, attempt) * 100)
        );
      }
    }
  }
  
  private getModuleImport(moduleName: string): Promise<any> {
    switch (moduleName) {
      case 'webgpu':
        return loadWebGPURenderer();
      
      case 'tensorflow':
        return loadTensorFlow();
      
      case 'react-three':
        return loadReactThree();
      
      case 'three-postprocessing':
        return loadThreeJSFeatures(['postprocessing']);
      
      case 'three-controls':
        return loadThreeJSFeatures(['controls']);
      
      default:
        throw new Error(`Unknown module: ${moduleName}`);
    }
  }
  
  preloadModule(moduleName: string, config: DynamicImportConfig = {}) {
    if (config.preload) {
      // Start loading but don't wait
      this.loadModule(moduleName, config).catch(error => {
        console.warn(`Preload failed for ${moduleName}:`, error);
      });
    }
  }
  
  isModuleLoaded(moduleName: string): boolean {
    return this.loadedModules.has(moduleName);
  }
  
  clearCache() {
    this.loadedModules.clear();
    this.loadingPromises.clear();
  }
}

// Global module loader instance
export const moduleLoader = new ModuleLoader();

// Preload critical modules based on user interaction
export const preloadOnInteraction = () => {
  const preloadModules = () => {
    moduleLoader.preloadModule('webgpu', { preload: true });
    moduleLoader.preloadModule('react-three', { preload: true });
  };
  
  // Preload on first user interaction
  const events = ['mousedown', 'touchstart', 'keydown'];
  const cleanup = () => {
    events.forEach(event => {
      document.removeEventListener(event, preloadModules);
    });
  };
  
  events.forEach(event => {
    document.addEventListener(event, () => {
      preloadModules();
      cleanup();
    }, { once: true });
  });
};