/**
 * Comprehensive Test Setup Utilities
 * Provides centralized test configuration and mocking utilities
 */

import { setupWebGPUMocks, createWebGPUScenario, resetWebGPUMocks } from './webgpuMocks';
import { setupPerformanceMonitorMocks, createPerformanceScenario } from './performanceMonitorMocks';

// Global test configuration
export interface TestConfig {
  webgpu?: string; // WebGPU scenario
  performance?: string; // Performance scenario
  timeout?: number;
  skipAsyncChecks?: boolean;
}

/**
 * Configure test environment for specific scenarios
 */
export function configureTestEnvironment(config: TestConfig = {}) {
  // Set up WebGPU mocks
  if (config.webgpu) {
    const webgpuConfig = createWebGPUScenario(config.webgpu);
    setupWebGPUMocks(webgpuConfig);
  }

  // Set up performance monitoring mocks
  if (config.performance) {
    const performanceConfig = createPerformanceScenario(config.performance);
    setupPerformanceMonitorMocks(performanceConfig);
  }

  // Configure Jest timeout
  if (config.timeout) {
    jest.setTimeout(config.timeout);
  }
}

/**
 * Clean up test environment
 */
export function cleanupTestEnvironment() {
  resetWebGPUMocks();
  
  // Reset performance.memory to stable values
  if ((global.performance as any).memory) {
    Object.defineProperty(global.performance, 'memory', {
      value: {
        usedJSHeapSize: 52428800, // 50MB
        totalJSHeapSize: 104857600, // 100MB
        jsHeapSizeLimit: 1073741824, // 1GB
      },
      configurable: true,
      writable: true,
    });
  }

  // Clear all timers
  jest.clearAllTimers();
  jest.clearAllMocks();
}

/**
 * Advanced mock for async operations with proper cleanup
 */
export function createAsyncMock<T>(
  mockFn: jest.MockedFunction<(...args: any[]) => Promise<T>>,
  result: T,
  delay: number = 0
): jest.MockedFunction<(...args: any[]) => Promise<T>> {
  return mockFn.mockImplementation((...args) => {
    if (delay > 0) {
      return new Promise((resolve) => {
        setTimeout(() => resolve(result), delay);
      });
    }
    return Promise.resolve(result);
  });
}

/**
 * Mock implementation for dynamic imports in test environment
 */
export function mockDynamicImport<T>(modulePath: string, mockExports: T): void {
  jest.doMock(modulePath, () => mockExports, { virtual: true });
}

/**
 * Create stable performance monitor mock for integration tests
 */
export function createStablePerformanceMonitor() {
  return {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    isRunning: jest.fn().mockReturnValue(true),
    getMetrics: jest.fn().mockReturnValue({
      timestamp: Date.now(),
      rendering: { fps: 60, frameTimes: [16.67], droppedFrames: 0, renderTime: 10 },
      memory: { heap: { used: 52428800, total: 104857600, limit: 1073741824 }, textures: 10, geometries: 5, materials: 3 },
      audio: { latency: 20, bufferSize: 128, underruns: 0, contextState: 'running', sampleRate: 48000 },
      ux: { inputLatency: 5, loadTime: 1000, errorCount: 0, interactionSuccess: 95 }
    }),
    getHistory: jest.fn().mockReturnValue({
      entries: [],
      maxLength: 100,
      timeRange: 100000
    }),
    getActiveAlerts: jest.fn().mockReturnValue([]),
    subscribe: jest.fn().mockReturnValue(() => {}),
    addAlert: jest.fn(),
    acknowledgeAlert: jest.fn(),
    resolveAlert: jest.fn(),
    addCollector: jest.fn(),
    removeCollector: jest.fn(),
    integrateWithStore: jest.fn()
  };
}

/**
 * Mock WebGPU modules for dynamic import tests
 */
export function setupDynamicImportMocks() {
  // Mock WebGPU modules
  jest.doMock('@/utils/webgpuRenderer', () => ({
    V1z3rRenderer: jest.fn()
  }));

  jest.doMock('@/utils/webgpuDetection', () => ({
    WebGPUDetector: jest.fn()
  }));

  jest.doMock('@/utils/webgpuPerformanceMonitor', () => ({
    getWebGPUPerformanceMonitor: jest.fn()
  }));

  // Mock TensorFlow
  jest.doMock('@tensorflow/tfjs', () => ({
    version: '4.0.0',
    ready: jest.fn().mockResolvedValue(undefined),
    setBackend: jest.fn().mockResolvedValue(true)
  }));

  // Mock critical components
  jest.doMock('@/components/AudioAnalyzer', () => ({
    default: jest.fn(() => null)
  }));

  jest.doMock('@/components/VisualEffects', () => ({
    default: jest.fn(() => null)
  }));

  jest.doMock('@/utils/performanceMonitor', () => ({
    default: createStablePerformanceMonitor()
  }));
}

/**
 * Wait for all pending promises to resolve
 */
export async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

/**
 * Advanced timer control for async testing
 */
export class TestTimer {
  private usingFakeTimers = false;

  useFakeTimers(): void {
    if (!this.usingFakeTimers) {
      jest.useFakeTimers();
      this.usingFakeTimers = true;
    }
  }

  useRealTimers(): void {
    if (this.usingFakeTimers) {
      jest.useRealTimers();
      this.usingFakeTimers = false;
    }
  }

  async advanceTimersAndFlush(ms: number): Promise<void> {
    if (!this.usingFakeTimers) {
      throw new Error('Must call useFakeTimers() first');
    }
    
    jest.advanceTimersByTime(ms);
    await flushPromises();
  }

  cleanup(): void {
    if (this.usingFakeTimers) {
      jest.useRealTimers();
      this.usingFakeTimers = false;
    }
  }
}

/**
 * Utility for testing component lifecycle
 */
export class ComponentTestHelper {
  private cleanupFunctions: Array<() => void> = [];

  addCleanup(cleanup: () => void): void {
    this.cleanupFunctions.push(cleanup);
  }

  cleanup(): void {
    this.cleanupFunctions.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.warn('Cleanup function failed:', error);
      }
    });
    this.cleanupFunctions = [];
  }
}

/**
 * Error boundary test helper
 */
export function createErrorBoundaryTest(
  component: React.ComponentType,
  errorToThrow: Error
) {
  const ErrorThrowingComponent = () => {
    throw errorToThrow;
  };

  return {
    ErrorThrowingComponent,
    expectedError: errorToThrow
  };
}

/**
 * Console mock utilities
 */
export class ConsoleMock {
  private originalWarn: typeof console.warn;
  private originalError: typeof console.error;
  private originalLog: typeof console.log;
  
  public warnSpy: jest.SpyInstance;
  public errorSpy: jest.SpyInstance;
  public logSpy: jest.SpyInstance;

  constructor() {
    this.originalWarn = console.warn;
    this.originalError = console.error;
    this.originalLog = console.log;
    
    this.warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    this.errorSpy = jest.spyOn(console, 'error').mockImplementation();
    this.logSpy = jest.spyOn(console, 'log').mockImplementation();
  }

  restore(): void {
    this.warnSpy.mockRestore();
    this.errorSpy.mockRestore();
    this.logSpy.mockRestore();
    
    console.warn = this.originalWarn;
    console.error = this.originalError;
    console.log = this.originalLog;
  }

  expectNoErrors(): void {
    expect(this.errorSpy).not.toHaveBeenCalled();
  }

  expectWarning(message: string): void {
    expect(this.warnSpy).toHaveBeenCalledWith(expect.stringContaining(message));
  }

  expectError(message: string): void {
    expect(this.errorSpy).toHaveBeenCalledWith(expect.stringContaining(message));
  }
}