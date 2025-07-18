/**
 * Tests for performance optimization utilities
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { render } from '@testing-library/react';
import {
  useDebounce,
  useThrottle,
  useMemoWithComparison,
  AudioDataOptimizer,
  WebGLOptimizer,
  MemoryOptimizer,
  withPerformanceOptimization,
} from '../performanceOptimizations';

describe('Performance Optimizations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('useDebounce', () => {
    it('should debounce function calls', () => {
      const mockCallback = jest.fn();
      const { result } = renderHook(() => useDebounce(mockCallback, 500));
      
      // Call multiple times quickly
      act(() => {
        result.current('arg1');
        result.current('arg2');
        result.current('arg3');
      });
      
      // Should not call immediately
      expect(mockCallback).not.toHaveBeenCalled();
      
      // Fast forward time
      act(() => {
        jest.advanceTimersByTime(500);
      });
      
      // Should call only once with last arguments
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith('arg3');
    });

    it('should cancel previous timeout on new call', () => {
      const mockCallback = jest.fn();
      const { result } = renderHook(() => useDebounce(mockCallback, 500));
      
      act(() => {
        result.current('first');
      });
      
      act(() => {
        jest.advanceTimersByTime(300);
      });
      
      act(() => {
        result.current('second');
      });
      
      act(() => {
        jest.advanceTimersByTime(500);
      });
      
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith('second');
    });

    it('should cleanup timeout on unmount', () => {
      const mockCallback = jest.fn();
      const { result, unmount } = renderHook(() => useDebounce(mockCallback, 500));
      
      act(() => {
        result.current('test');
      });
      
      unmount();
      
      act(() => {
        jest.advanceTimersByTime(500);
      });
      
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('useThrottle', () => {
    it('should throttle function calls', () => {
      const mockCallback = jest.fn();
      const { result } = renderHook(() => useThrottle(mockCallback, 500));
      
      // First call should execute immediately
      act(() => {
        result.current('first');
      });
      
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith('first');
      
      // Subsequent calls within delay should be throttled
      act(() => {
        result.current('second');
        result.current('third');
      });
      
      expect(mockCallback).toHaveBeenCalledTimes(1);
      
      // After delay, last call should execute
      act(() => {
        jest.advanceTimersByTime(500);
      });
      
      expect(mockCallback).toHaveBeenCalledTimes(2);
      expect(mockCallback).toHaveBeenLastCalledWith('third');
    });

    it('should cleanup timeout on unmount', () => {
      const mockCallback = jest.fn();
      const { result, unmount } = renderHook(() => useThrottle(mockCallback, 500));
      
      act(() => {
        result.current('first');
        result.current('second');
      });
      
      unmount();
      
      act(() => {
        jest.advanceTimersByTime(500);
      });
      
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('useMemoWithComparison', () => {
    it('should memoize values with custom comparison', () => {
      const factory = jest.fn(() => ({ value: 'test' }));
      const compare = jest.fn((prev, next) => 
        prev.length === next.length && prev[0] === next[0]
      );
      
      const { result, rerender } = renderHook(
        ({ deps }) => useMemoWithComparison(factory, deps, compare),
        { initialProps: { deps: [1, 2] } }
      );
      
      const firstResult = result.current;
      expect(factory).toHaveBeenCalledTimes(1);
      
      // Rerender with different deps that compare as equal
      rerender({ deps: [1, 3] });
      
      expect(result.current).toBe(firstResult);
      expect(factory).toHaveBeenCalledTimes(1);
      expect(compare).toHaveBeenCalled();
      
      // Rerender with deps that compare as different
      rerender({ deps: [2, 3] });
      
      expect(result.current).not.toBe(firstResult);
      expect(factory).toHaveBeenCalledTimes(2);
    });

    it('should work without custom comparison', () => {
      const factory = jest.fn(() => ({ value: 'test' }));
      
      const { result, rerender } = renderHook(
        ({ deps }) => useMemoWithComparison(factory, deps),
        { initialProps: { deps: [1, 2] } }
      );
      
      expect(factory).toHaveBeenCalledTimes(1);
      
      // Rerender with same deps
      rerender({ deps: [1, 2] });
      expect(factory).toHaveBeenCalledTimes(1);
      
      // Rerender with different deps
      rerender({ deps: [1, 3] });
      expect(factory).toHaveBeenCalledTimes(2);
    });
  });

  describe('AudioDataOptimizer', () => {
    let optimizer: AudioDataOptimizer;

    beforeEach(() => {
      optimizer = AudioDataOptimizer.getInstance();
    });

    it('should be singleton', () => {
      const instance1 = AudioDataOptimizer.getInstance();
      const instance2 = AudioDataOptimizer.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new buffer when pool is empty', () => {
      const buffer = optimizer.getBuffer(1024);
      expect(buffer).toBeInstanceOf(Uint8Array);
      expect(buffer.length).toBe(1024);
    });

    it('should reuse buffer from pool', () => {
      const buffer1 = optimizer.getBuffer(1024);
      optimizer.returnBuffer(buffer1);
      
      const buffer2 = optimizer.getBuffer(1024);
      expect(buffer2).toBe(buffer1);
      expect(buffer2.every(val => val === 0)).toBe(true); // Should be cleared
    });

    it('should not add to pool when max size reached', () => {
      // Fill pool to max
      for (let i = 0; i < 10; i++) {
        const buffer = new Uint8Array(1024);
        optimizer.returnBuffer(buffer);
      }
      
      // Try to add one more
      const extraBuffer = new Uint8Array(1024);
      optimizer.returnBuffer(extraBuffer);
      
      // Should still be able to get buffers
      const newBuffer = optimizer.getBuffer(1024);
      expect(newBuffer).toBeInstanceOf(Uint8Array);
    });

    it('should downsample audio data', () => {
      const inputData = new Uint8Array([100, 150, 200, 250, 50, 75, 125, 175]);
      const result = optimizer.downsample(inputData, 4);
      
      expect(result.length).toBe(4);
      // Each sample should be average of 2 input samples
      expect(result[0]).toBe(125); // (100 + 150) / 2
      expect(result[1]).toBe(225); // (200 + 250) / 2
      expect(result[2]).toBe(62);  // (50 + 75) / 2
      expect(result[3]).toBe(150); // (125 + 175) / 2
    });

    it('should return original data if target size is larger', () => {
      const inputData = new Uint8Array([1, 2, 3, 4]);
      const result = optimizer.downsample(inputData, 8);
      
      expect(result).toBe(inputData);
    });
  });

  describe('WebGLOptimizer', () => {
    beforeEach(() => {
      // Reset static counters before each test
      (WebGLOptimizer as any).frameSkipCounter = 0;
    });

    afterEach(() => {
      // Reset static counters after each test
      (WebGLOptimizer as any).frameSkipCounter = 0;
    });

    it('should skip frames according to threshold', () => {
      // Reset counter first
      (WebGLOptimizer as any).frameSkipCounter = 0;
      
      expect(WebGLOptimizer.shouldSkipFrame()).toBe(true);   // counter = 1
      expect(WebGLOptimizer.shouldSkipFrame()).toBe(false);  // counter = 2 (threshold reached), resets to 0
      expect(WebGLOptimizer.shouldSkipFrame()).toBe(true);   // counter = 1
    });

    it('should optimize canvas', () => {
      const mockCanvas = {
        getContext: jest.fn(() => ({})),
        getBoundingClientRect: jest.fn(() => ({
          width: 800,
          height: 600,
        })),
        style: {},
      } as any;

      Object.defineProperty(window, 'devicePixelRatio', {
        value: 2,
        writable: true,
      });

      WebGLOptimizer.optimizeCanvas(mockCanvas);

      expect(mockCanvas.width).toBe(1600); // 800 * 2
      expect(mockCanvas.height).toBe(1200); // 600 * 2
      expect(mockCanvas.style.width).toBe('800px');
      expect(mockCanvas.style.height).toBe('600px');
    });
  });

  describe('MemoryOptimizer', () => {
    beforeEach(() => {
      // Clear static state
      (MemoryOptimizer as any).cleanupCallbacks = [];
    });

    it('should register and execute cleanup callbacks', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      MemoryOptimizer.registerCleanup(callback1);
      MemoryOptimizer.registerCleanup(callback2);
      
      MemoryOptimizer.cleanup();
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should handle failing cleanup callbacks', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const failingCallback = jest.fn(() => {
        throw new Error('Cleanup failed');
      });
      const goodCallback = jest.fn();
      
      MemoryOptimizer.registerCleanup(failingCallback);
      MemoryOptimizer.registerCleanup(goodCallback);
      
      MemoryOptimizer.cleanup();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Cleanup callback failed:',
        expect.any(Error)
      );
      expect(goodCallback).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    it('should clear callbacks after cleanup', () => {
      const callback = jest.fn();
      MemoryOptimizer.registerCleanup(callback);
      
      MemoryOptimizer.cleanup();
      MemoryOptimizer.cleanup();
      
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not call gc in non-development environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const mockGc = jest.fn();
      (global as any).gc = mockGc;
      
      MemoryOptimizer.forceGC();
      
      expect(mockGc).not.toHaveBeenCalled();
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should call gc in development environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const mockGc = jest.fn();
      (global as any).gc = mockGc;
      
      MemoryOptimizer.forceGC();
      
      expect(mockGc).toHaveBeenCalled();
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('withPerformanceOptimization', () => {
    it('should memoize component', () => {
      const TestComponent = jest.fn(({ value }: { value: string }) => (
        <div>{value}</div>
      ));
      
      const OptimizedComponent = withPerformanceOptimization(TestComponent);
      
      const { rerender } = render(<OptimizedComponent value="test" />);
      expect(TestComponent).toHaveBeenCalledTimes(1);
      
      // Rerender with same props
      rerender(<OptimizedComponent value="test" />);
      expect(TestComponent).toHaveBeenCalledTimes(1);
      
      // Rerender with different props
      rerender(<OptimizedComponent value="different" />);
      expect(TestComponent).toHaveBeenCalledTimes(2);
    });

    it('should set display name', () => {
      const TestComponent = () => <div>Test</div>;
      TestComponent.displayName = 'TestComponent';
      
      const OptimizedComponent = withPerformanceOptimization(TestComponent);
      
      expect(OptimizedComponent.displayName).toBe('withPerformanceOptimization(TestComponent)');
    });

    it('should use component name if no display name', () => {
      function TestComponent() {
        return <div>Test</div>;
      }
      
      const OptimizedComponent = withPerformanceOptimization(TestComponent);
      
      expect(OptimizedComponent.displayName).toBe('withPerformanceOptimization(TestComponent)');
    });

    it('should compare props using JSON.stringify', () => {
      const TestComponent = jest.fn(() => <div>Test</div>);
      const OptimizedComponent = withPerformanceOptimization(TestComponent);
      
      const complexProps = { 
        data: { nested: { value: 'test' } },
        array: [1, 2, 3]
      };
      
      const { rerender } = render(<OptimizedComponent {...complexProps} />);
      expect(TestComponent).toHaveBeenCalledTimes(1);
      
      // Rerender with equivalent but different object
      rerender(<OptimizedComponent data={{ nested: { value: 'test' } }} array={[1, 2, 3]} />);
      expect(TestComponent).toHaveBeenCalledTimes(1);
      
      // Rerender with different data
      rerender(<OptimizedComponent data={{ nested: { value: 'different' } }} array={[1, 2, 3]} />);
      expect(TestComponent).toHaveBeenCalledTimes(2);
    });
  });
});