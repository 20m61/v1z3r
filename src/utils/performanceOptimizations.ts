/**
 * Performance optimizations utility functions
 * Provides memoization, debouncing, and other optimization techniques
 */

import { useCallback, useMemo, useRef } from 'react';

/**
 * Debounce hook for expensive operations
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]) as T;
}

/**
 * Throttle hook for high-frequency events
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastRunRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastRunRef.current >= delay) {
      lastRunRef.current = now;
      callback(...args);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        lastRunRef.current = Date.now();
        callback(...args);
      }, delay - (now - lastRunRef.current));
    }
  }, [callback, delay]) as T;
}

/**
 * Memoize expensive computations with custom comparison
 */
export function useMemoWithComparison<T>(
  factory: () => T,
  deps: React.DependencyList,
  compare?: (prev: React.DependencyList, next: React.DependencyList) => boolean
): T {
  const memoizedValue = useMemo(factory, deps);
  
  if (compare) {
    const prevDepsRef = useRef<React.DependencyList>(deps);
    const memoizedRef = useRef<T>(memoizedValue);
    
    if (!compare(prevDepsRef.current, deps)) {
      memoizedRef.current = factory();
      prevDepsRef.current = deps;
    }
    
    return memoizedRef.current;
  }
  
  return memoizedValue;
}

/**
 * Audio data optimization utilities
 */
export class AudioDataOptimizer {
  private static instance: AudioDataOptimizer;
  private bufferPool: Uint8Array[] = [];
  private readonly maxPoolSize = 10;

  static getInstance(): AudioDataOptimizer {
    if (!AudioDataOptimizer.instance) {
      AudioDataOptimizer.instance = new AudioDataOptimizer();
    }
    return AudioDataOptimizer.instance;
  }

  /**
   * Get optimized audio buffer from pool
   */
  getBuffer(size: number): Uint8Array {
    const buffer = this.bufferPool.find(buf => buf.length === size);
    if (buffer) {
      this.bufferPool = this.bufferPool.filter(buf => buf !== buffer);
      buffer.fill(0); // Clear previous data
      return buffer;
    }
    return new Uint8Array(size);
  }

  /**
   * Return buffer to pool for reuse
   */
  returnBuffer(buffer: Uint8Array): void {
    if (this.bufferPool.length < this.maxPoolSize) {
      this.bufferPool.push(buffer);
    }
  }

  /**
   * Downsample audio data for visualization
   */
  downsample(data: Uint8Array, targetSize: number): Uint8Array {
    if (data.length <= targetSize) {
      return data;
    }

    const result = this.getBuffer(targetSize);
    const step = data.length / targetSize;
    
    for (let i = 0; i < targetSize; i++) {
      const startIndex = Math.floor(i * step);
      const endIndex = Math.floor((i + 1) * step);
      
      let sum = 0;
      for (let j = startIndex; j < endIndex; j++) {
        sum += data[j];
      }
      
      result[i] = Math.floor(sum / (endIndex - startIndex));
    }
    
    return result;
  }
}

/**
 * WebGL performance optimizations
 */
export class WebGLOptimizer {
  private static frameSkipCounter = 0;
  private static readonly frameSkipThreshold = 2;

  /**
   * Skip frames when performance is low
   */
  static shouldSkipFrame(): boolean {
    this.frameSkipCounter++;
    if (this.frameSkipCounter >= this.frameSkipThreshold) {
      this.frameSkipCounter = 0;
      return false;
    }
    return true;
  }

  /**
   * Optimize canvas rendering
   */
  static optimizeCanvas(canvas: HTMLCanvasElement): void {
    // Enable hardware acceleration hints
    const context = canvas.getContext('2d');
    if (context) {
      // @ts-ignore - willReadFrequently is a newer property
      context.willReadFrequently = false;
    }

    // Set canvas size attributes for better performance
    const devicePixelRatio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
  }
}

/**
 * Memory management utilities
 */
export class MemoryOptimizer {
  private static cleanupCallbacks: (() => void)[] = [];

  /**
   * Register cleanup callback
   */
  static registerCleanup(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Force garbage collection (development only)
   */
  static forceGC(): void {
    if (process.env.NODE_ENV === 'development') {
      // @ts-ignore - gc is only available in development
      if (global.gc) {
        global.gc();
      }
    }
  }

  /**
   * Clean up registered resources
   */
  static cleanup(): void {
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn('Cleanup callback failed:', error);
      }
    });
    this.cleanupCallbacks = [];
  }
}

/**
 * React component performance optimization HOC
 */
export function withPerformanceOptimization<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  const OptimizedComponent = React.memo(Component, (prevProps, nextProps) => {
    // Custom comparison logic for complex props
    return JSON.stringify(prevProps) === JSON.stringify(nextProps);
  });

  OptimizedComponent.displayName = `withPerformanceOptimization(${Component.displayName || Component.name})`;
  
  return OptimizedComponent;
}