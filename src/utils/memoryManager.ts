/**
 * Memory Management utilities for VJ Application
 * 
 * This module provides memory management functionality for large audio data arrays,
 * WebGL resources, and other memory-intensive operations to prevent memory leaks.
 */

import { errorHandler } from './errorHandler';

// Memory usage tracking
interface MemoryInfo {
  used: number;
  total: number;
  percentage: number;
}

// Audio buffer pool for efficient memory reuse
class AudioBufferPool {
  private pools = new Map<number, Uint8Array[]>();
  private maxPoolSize = 10; // Maximum buffers per size
  private totalAllocated = 0;
  private maxTotalMemory = 50 * 1024 * 1024; // 50MB limit

  /**
   * Get a buffer from the pool or create a new one
   */
  public getBuffer(size: number): Uint8Array {
    const pool = this.pools.get(size);
    
    if (pool && pool.length > 0) {
      const buffer = pool.pop()!;
      // Clear the buffer before reuse
      buffer.fill(0);
      return buffer;
    }

    // Check memory limit before creating new buffer
    const newBufferSize = size;
    if (this.totalAllocated + newBufferSize > this.maxTotalMemory) {
      this.forceCleanup();
      if (this.totalAllocated + newBufferSize > this.maxTotalMemory) {
        throw new Error(`Memory limit exceeded. Current: ${this.totalAllocated}, Requested: ${newBufferSize}, Limit: ${this.maxTotalMemory}`);
      }
    }

    const buffer = new Uint8Array(size);
    this.totalAllocated += newBufferSize;
    
    errorHandler.debug('AudioBufferPool: Created new buffer', {
      size,
      totalAllocated: this.totalAllocated,
      totalPools: this.pools.size,
    });

    return buffer;
  }

  /**
   * Return a buffer to the pool for reuse
   */
  public returnBuffer(buffer: Uint8Array): void {
    const size = buffer.length;
    let pool = this.pools.get(size);
    
    if (!pool) {
      pool = [];
      this.pools.set(size, pool);
    }

    if (pool.length < this.maxPoolSize) {
      pool.push(buffer);
    } else {
      // Pool is full, don't store the buffer (let it be garbage collected)
      this.totalAllocated -= size;
    }
  }

  /**
   * Force cleanup of all pools
   */
  public forceCleanup(): void {
    let freedMemory = 0;
    
    for (const [size, pool] of this.pools) {
      freedMemory += size * pool.length;
      pool.length = 0; // Clear the pool
    }
    
    this.totalAllocated -= freedMemory;
    this.pools.clear();
    
    errorHandler.info('AudioBufferPool: Force cleanup completed', {
      freedMemory,
      totalAllocated: this.totalAllocated,
    });

    // Suggest garbage collection
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }
  }

  /**
   * Get memory statistics
   */
  public getStats(): {
    totalAllocated: number;
    poolCount: number;
    bufferCount: number;
    maxTotalMemory: number;
  } {
    let bufferCount = 0;
    for (const pool of this.pools.values()) {
      bufferCount += pool.length;
    }

    return {
      totalAllocated: this.totalAllocated,
      poolCount: this.pools.size,
      bufferCount,
      maxTotalMemory: this.maxTotalMemory,
    };
  }

  /**
   * Clean up buffers not used recently
   */
  public cleanup(): void {
    const threshold = this.maxTotalMemory * 0.8; // 80% threshold
    
    if (this.totalAllocated > threshold) {
      // Remove half of the buffers from each pool
      let freedMemory = 0;
      
      for (const [size, pool] of this.pools) {
        const removeCount = Math.floor(pool.length / 2);
        const removed = pool.splice(0, removeCount);
        freedMemory += size * removed.length;
      }
      
      this.totalAllocated -= freedMemory;
      
      errorHandler.info('AudioBufferPool: Cleanup completed', {
        freedMemory,
        totalAllocated: this.totalAllocated,
        threshold,
      });
    }
  }
}

// WebGL resource manager
class WebGLResourceManager {
  private contexts = new Set<WebGLRenderingContext | WebGL2RenderingContext>();
  private buffers = new Set<WebGLBuffer>();
  private textures = new Set<WebGLTexture>();
  private programs = new Set<WebGLProgram>();
  private framebuffers = new Set<WebGLFramebuffer>();

  /**
   * Register a WebGL context for management
   */
  public registerContext(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.contexts.add(gl);
  }

  /**
   * Register a WebGL buffer for tracking
   */
  public registerBuffer(buffer: WebGLBuffer): void {
    this.buffers.add(buffer);
  }

  /**
   * Register a WebGL texture for tracking
   */
  public registerTexture(texture: WebGLTexture): void {
    this.textures.add(texture);
  }

  /**
   * Register a WebGL program for tracking
   */
  public registerProgram(program: WebGLProgram): void {
    this.programs.add(program);
  }

  /**
   * Register a WebGL framebuffer for tracking
   */
  public registerFramebuffer(framebuffer: WebGLFramebuffer): void {
    this.framebuffers.add(framebuffer);
  }

  /**
   * Clean up all WebGL resources
   */
  public cleanup(): void {
    let cleanedResources = 0;

    for (const gl of this.contexts) {
      if (gl.isContextLost && gl.isContextLost()) {
        this.contexts.delete(gl);
        continue;
      }

      // Clean up buffers
      for (const buffer of this.buffers) {
        if (gl.isBuffer(buffer)) {
          gl.deleteBuffer(buffer);
          cleanedResources++;
        }
        this.buffers.delete(buffer);
      }

      // Clean up textures
      for (const texture of this.textures) {
        if (gl.isTexture(texture)) {
          gl.deleteTexture(texture);
          cleanedResources++;
        }
        this.textures.delete(texture);
      }

      // Clean up programs
      for (const program of this.programs) {
        if (gl.isProgram(program)) {
          gl.deleteProgram(program);
          cleanedResources++;
        }
        this.programs.delete(program);
      }

      // Clean up framebuffers
      for (const framebuffer of this.framebuffers) {
        if (gl.isFramebuffer(framebuffer)) {
          gl.deleteFramebuffer(framebuffer);
          cleanedResources++;
        }
        this.framebuffers.delete(framebuffer);
      }
    }

    errorHandler.info('WebGLResourceManager: Cleanup completed', {
      cleanedResources,
      contextsCount: this.contexts.size,
    });
  }

  /**
   * Get resource statistics
   */
  public getStats(): {
    contexts: number;
    buffers: number;
    textures: number;
    programs: number;
    framebuffers: number;
  } {
    return {
      contexts: this.contexts.size,
      buffers: this.buffers.size,
      textures: this.textures.size,
      programs: this.programs.size,
      framebuffers: this.framebuffers.size,
    };
  }
}

// Main memory manager
class MemoryManager {
  private audioBufferPool = new AudioBufferPool();
  private webglResourceManager = new WebGLResourceManager();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private memoryPressureThreshold = 0.85; // 85% memory usage

  constructor() {
    this.startPeriodicCleanup();
    this.setupMemoryPressureHandler();
  }

  /**
   * Get a reusable audio buffer
   */
  public getAudioBuffer(size: number): Uint8Array {
    return this.audioBufferPool.getBuffer(size);
  }

  /**
   * Return an audio buffer for reuse
   */
  public returnAudioBuffer(buffer: Uint8Array): void {
    this.audioBufferPool.returnBuffer(buffer);
  }

  /**
   * Register WebGL resources for management
   */
  public registerWebGLContext(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.webglResourceManager.registerContext(gl);
  }

  public registerWebGLBuffer(buffer: WebGLBuffer): void {
    this.webglResourceManager.registerBuffer(buffer);
  }

  public registerWebGLTexture(texture: WebGLTexture): void {
    this.webglResourceManager.registerTexture(texture);
  }

  public registerWebGLProgram(program: WebGLProgram): void {
    this.webglResourceManager.registerProgram(program);
  }

  public registerWebGLFramebuffer(framebuffer: WebGLFramebuffer): void {
    this.webglResourceManager.registerFramebuffer(framebuffer);
  }

  /**
   * Get current memory usage information
   */
  public getMemoryInfo(): MemoryInfo | null {
    if (typeof window === 'undefined' || !window.performance || !(window.performance as any).memory) {
      return null;
    }

    const memory = (window.performance as any).memory;
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
    };
  }

  /**
   * Check if memory pressure is high
   */
  public isMemoryPressureHigh(): boolean {
    const memoryInfo = this.getMemoryInfo();
    if (!memoryInfo) return false;
    
    return memoryInfo.percentage > this.memoryPressureThreshold * 100;
  }

  /**
   * Force memory cleanup
   */
  public forceCleanup(): void {
    errorHandler.info('MemoryManager: Starting force cleanup');
    
    this.audioBufferPool.forceCleanup();
    this.webglResourceManager.cleanup();
    
    // Suggest garbage collection
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }
    
    errorHandler.info('MemoryManager: Force cleanup completed');
  }

  /**
   * Start periodic cleanup
   */
  private startPeriodicCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const memoryInfo = this.getMemoryInfo();
      
      if (memoryInfo && memoryInfo.percentage > 70) { // 70% threshold for regular cleanup
        this.audioBufferPool.cleanup();
        
        errorHandler.debug('MemoryManager: Periodic cleanup', {
          memoryUsagePercentage: memoryInfo.percentage,
        });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Setup memory pressure event handler
   */
  private setupMemoryPressureHandler(): void {
    if (typeof window === 'undefined') return;

    // Listen for memory pressure events (if supported)
    if ('memory' in window.performance && 'addEventListener' in window) {
      window.addEventListener('memorypressure' as any, () => {
        errorHandler.warn('Memory pressure detected, forcing cleanup');
        this.forceCleanup();
      });
    }

    // Monitor memory usage periodically
    setInterval(() => {
      if (this.isMemoryPressureHigh()) {
        errorHandler.warn('High memory usage detected', undefined, {
          memoryInfo: this.getMemoryInfo(),
        });
        this.forceCleanup();
      }
    }, 5000); // Every 5 seconds
  }

  /**
   * Get comprehensive memory statistics
   */
  public getStats(): {
    memoryInfo: MemoryInfo | null;
    audioBufferPool: ReturnType<AudioBufferPool['getStats']>;
    webglResources: ReturnType<WebGLResourceManager['getStats']>;
    isHighPressure: boolean;
  } {
    return {
      memoryInfo: this.getMemoryInfo(),
      audioBufferPool: this.audioBufferPool.getStats(),
      webglResources: this.webglResourceManager.getStats(),
      isHighPressure: this.isMemoryPressureHigh(),
    };
  }

  /**
   * Destroy the memory manager and cleanup resources
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.forceCleanup();
  }
}

// Global memory manager instance
export const memoryManager = new MemoryManager();

// Utility functions for easy access
export function getReusableAudioBuffer(size: number): Uint8Array {
  return memoryManager.getAudioBuffer(size);
}

export function returnAudioBuffer(buffer: Uint8Array): void {
  memoryManager.returnAudioBuffer(buffer);
}

export function forceMemoryCleanup(): void {
  memoryManager.forceCleanup();
}

export function getMemoryStats(): ReturnType<MemoryManager['getStats']> {
  return memoryManager.getStats();
}

// Export classes for testing
export { AudioBufferPool, WebGLResourceManager, MemoryManager };