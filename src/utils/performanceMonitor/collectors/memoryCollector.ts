/**
 * Memory Performance Collector
 * Monitors heap usage, GPU memory, and resource counts
 */

import { MetricCollector, MemoryMetrics, GPUMemoryInfo, PerformanceSnapshot } from '../types';

export class MemoryCollector implements MetricCollector {
  name = 'memory';
  enabled = true;

  private renderer?: any;
  private lastGCTime: number = 0;
  private memoryLeakDetectionHistory: number[] = [];

  constructor(renderer?: any) {
    this.renderer = renderer;
  }

  async initialize(): Promise<void> {
    console.log('Initializing memory performance collector...');
    
    // Set up memory leak detection
    this.setupMemoryLeakDetection();
  }

  cleanup(): void {
    // Clear detection history
    this.memoryLeakDetectionHistory = [];
  }

  async collect(): Promise<Partial<PerformanceSnapshot>> {
    const memoryMetrics = await this.collectMemoryMetrics();

    return {
      memory: memoryMetrics,
    };
  }

  /**
   * Collect comprehensive memory metrics
   */
  private async collectMemoryMetrics(): Promise<MemoryMetrics> {
    const heap = this.getHeapUsage();
    const gpu = this.estimateGPUMemory();
    const resources = this.getResourceCounts();

    // Track memory usage for leak detection
    this.trackMemoryUsage(heap.used);

    return {
      heap,
      gpu,
      ...resources,
    };
  }

  /**
   * Get JavaScript heap usage
   */
  private getHeapUsage(): { used: number; total: number; limit: number } {
    // Use performance.memory if available (Chrome)
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
      };
    }

    // Fallback estimation for other browsers
    return this.estimateHeapUsage();
  }

  /**
   * Estimate heap usage for browsers without performance.memory
   */
  private estimateHeapUsage(): { used: number; total: number; limit: number } {
    // Rough estimation based on typical browser limits
    const estimatedLimit = 2 * 1024 * 1024 * 1024; // 2GB typical limit
    const estimatedUsed = this.calculateEstimatedUsage();
    
    return {
      used: estimatedUsed,
      total: Math.min(estimatedUsed * 1.5, estimatedLimit * 0.8),
      limit: estimatedLimit,
    };
  }

  /**
   * Calculate estimated memory usage
   */
  private calculateEstimatedUsage(): number {
    // Base estimation: 50MB for typical web app
    let estimated = 50 * 1024 * 1024;

    // Add estimation based on renderer resources
    if (this.renderer && this.renderer.info) {
      const info = this.renderer.info;
      // Rough estimation: textures + geometries + programs
      estimated += (info.memory?.textures || 0) * 1024 * 1024; // 1MB per texture avg
      estimated += (info.memory?.geometries || 0) * 512 * 1024; // 512KB per geometry avg
      estimated += (info.programs?.length || 0) * 100 * 1024; // 100KB per program avg
    }

    return estimated;
  }

  /**
   * Estimate GPU memory usage
   */
  private estimateGPUMemory(): GPUMemoryInfo | undefined {
    if (!this.renderer) {
      return undefined;
    }

    try {
      const info = this.renderer.info;
      if (!info || !info.memory) {
        return this.estimateGPUMemoryFallback();
      }

      // Three.js renderer info
      const textureMemory = this.estimateTextureMemory(info.memory.textures);
      const bufferMemory = this.estimateBufferMemory(info.memory.geometries);
      const used = textureMemory + bufferMemory;

      return {
        used,
        total: this.getGPUMemoryLimit(),
        available: this.getGPUMemoryLimit() - used,
        textureMemory,
        bufferMemory,
      };
    } catch (error) {
      console.warn('Failed to estimate GPU memory:', error);
      return undefined;
    }
  }

  /**
   * Fallback GPU memory estimation
   */
  private estimateGPUMemoryFallback(): GPUMemoryInfo {
    // Very rough estimation for unknown GPU
    const estimatedUsed = 128 * 1024 * 1024; // 128MB baseline
    const estimatedTotal = 2 * 1024 * 1024 * 1024; // 2GB typical

    return {
      used: estimatedUsed,
      total: estimatedTotal,
      available: estimatedTotal - estimatedUsed,
      textureMemory: estimatedUsed * 0.7,
      bufferMemory: estimatedUsed * 0.3,
    };
  }

  /**
   * Estimate texture memory usage
   */
  private estimateTextureMemory(textureCount: number): number {
    if (!textureCount) return 0;

    // Rough estimation: average texture size
    // Assume mix of different sizes: 512x512 RGBA = 1MB, 1024x1024 = 4MB, etc.
    const avgTextureSize = 2 * 1024 * 1024; // 2MB average
    return textureCount * avgTextureSize;
  }

  /**
   * Estimate buffer memory usage
   */
  private estimateBufferMemory(geometryCount: number): number {
    if (!geometryCount) return 0;

    // Rough estimation: average geometry buffer size
    // Typical geometry: vertices + normals + UVs + indices
    const avgGeometrySize = 1024 * 1024; // 1MB average
    return geometryCount * avgGeometrySize;
  }

  /**
   * Get GPU memory limit estimation
   */
  private getGPUMemoryLimit(): number {
    // Try to get from WebGL context
    if (this.renderer && this.renderer.getContext) {
      const gl = this.renderer.getContext();
      if (gl) {
        // Check for memory info extension
        const memoryInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (memoryInfo) {
          // This is a rough heuristic - actual GPU memory detection is limited in WebGL
          const renderer = gl.getParameter(memoryInfo.UNMASKED_RENDERER_WEBGL);
          if (renderer && typeof renderer === 'string') {
            return this.estimateGPUMemoryFromRenderer(renderer);
          }
        }
      }
    }

    // Fallback: typical integrated GPU memory
    return 2 * 1024 * 1024 * 1024; // 2GB
  }

  /**
   * Estimate GPU memory from renderer string
   */
  private estimateGPUMemoryFromRenderer(rendererString: string): number {
    const renderer = rendererString.toLowerCase();
    
    // Common GPU patterns and their typical memory
    if (renderer.includes('rtx 4090')) return 24 * 1024 * 1024 * 1024;
    if (renderer.includes('rtx 4080')) return 16 * 1024 * 1024 * 1024;
    if (renderer.includes('rtx 4070')) return 12 * 1024 * 1024 * 1024;
    if (renderer.includes('rtx 3080')) return 10 * 1024 * 1024 * 1024;
    if (renderer.includes('rtx 3070')) return 8 * 1024 * 1024 * 1024;
    if (renderer.includes('gtx 1660')) return 6 * 1024 * 1024 * 1024;
    if (renderer.includes('intel') && renderer.includes('iris')) return 1 * 1024 * 1024 * 1024;
    if (renderer.includes('intel')) return 512 * 1024 * 1024;
    if (renderer.includes('amd') && renderer.includes('radeon')) return 4 * 1024 * 1024 * 1024;
    
    // Default estimation
    return 2 * 1024 * 1024 * 1024;
  }

  /**
   * Get resource counts from renderer
   */
  private getResourceCounts(): {
    textures: number;
    geometries: number;
    materials: number;
  } {
    if (!this.renderer || !this.renderer.info) {
      return {
        textures: 0,
        geometries: 0,
        materials: 0,
      };
    }

    const info = this.renderer.info;
    return {
      textures: info.memory?.textures || 0,
      geometries: info.memory?.geometries || 0,
      materials: info.programs?.length || 0,
    };
  }

  /**
   * Setup memory leak detection
   */
  private setupMemoryLeakDetection(): void {
    // Clear history on setup
    this.memoryLeakDetectionHistory = [];
  }

  /**
   * Track memory usage for leak detection
   */
  private trackMemoryUsage(memoryUsage: number): void {
    this.memoryLeakDetectionHistory.push(memoryUsage);

    // Keep only last 60 measurements (about 1 minute at 1-second intervals)
    if (this.memoryLeakDetectionHistory.length > 60) {
      this.memoryLeakDetectionHistory.shift();
    }
  }

  /**
   * Detect potential memory leaks
   */
  detectMemoryLeaks(): {
    hasLeak: boolean;
    trend: 'increasing' | 'stable' | 'decreasing';
    rateOfIncrease: number; // bytes per measurement
  } {
    const history = this.memoryLeakDetectionHistory;
    
    if (history.length < 10) {
      return {
        hasLeak: false,
        trend: 'stable',
        rateOfIncrease: 0,
      };
    }

    // Calculate trend using linear regression
    const n = history.length;
    const xSum = (n * (n - 1)) / 2;
    const ySum = history.reduce((sum, val) => sum + val, 0);
    const xySum = history.reduce((sum, val, index) => sum + val * index, 0);
    const xSquareSum = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * xySum - xSum * ySum) / (n * xSquareSum - xSum * xSum);
    
    // Memory leak indicators
    const avgIncrease = slope;
    const isIncreasing = slope > 0;
    const significantIncrease = Math.abs(slope) > 1024 * 1024; // 1MB per measurement
    
    let trend: 'increasing' | 'stable' | 'decreasing';
    if (Math.abs(slope) < 1024 * 100) { // 100KB threshold
      trend = 'stable';
    } else if (slope > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    return {
      hasLeak: isIncreasing && significantIncrease,
      trend,
      rateOfIncrease: avgIncrease,
    };
  }

  /**
   * Force garbage collection if available (development only)
   */
  forceGarbageCollection(): boolean {
    if (process.env.NODE_ENV === 'development') {
      try {
        // Only available in development with specific flags
        if (typeof global !== 'undefined' && (global as any).gc) {
          (global as any).gc();
          this.lastGCTime = Date.now();
          return true;
        }
      } catch (error) {
        console.warn('Garbage collection not available:', error);
      }
    }
    return false;
  }

  /**
   * Get memory pressure level
   */
  getMemoryPressure(): 'low' | 'medium' | 'high' | 'critical' {
    const heap = this.getHeapUsage();
    const usagePercent = (heap.used / heap.limit) * 100;

    if (usagePercent < 50) return 'low';
    if (usagePercent < 75) return 'medium';
    if (usagePercent < 90) return 'high';
    return 'critical';
  }

  /**
   * Get memory efficiency score (0-100)
   */
  getMemoryEfficiencyScore(): number {
    const heap = this.getHeapUsage();
    const gpu = this.estimateGPUMemory();
    const resources = this.getResourceCounts();
    
    let score = 100;
    
    // Deduct points for high heap usage
    const heapUsagePercent = (heap.used / heap.limit) * 100;
    if (heapUsagePercent > 75) score -= 30;
    else if (heapUsagePercent > 50) score -= 15;
    
    // Deduct points for GPU memory usage
    if (gpu) {
      const gpuUsagePercent = (gpu.used / gpu.total) * 100;
      if (gpuUsagePercent > 80) score -= 20;
      else if (gpuUsagePercent > 60) score -= 10;
    }
    
    // Deduct points for excessive resources
    if (resources.textures > 100) score -= 10;
    if (resources.geometries > 50) score -= 10;
    if (resources.materials > 25) score -= 10;
    
    // Check for memory leak
    const leakDetection = this.detectMemoryLeaks();
    if (leakDetection.hasLeak) score -= 25;
    
    return Math.max(0, score);
  }

  /**
   * Get memory optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const heap = this.getHeapUsage();
    const gpu = this.estimateGPUMemory();
    const resources = this.getResourceCounts();
    const leak = this.detectMemoryLeaks();
    
    if ((heap.used / heap.limit) > 0.8) {
      recommendations.push('High heap usage detected - consider reducing object creation');
    }
    
    if (gpu && (gpu.used / gpu.total) > 0.8) {
      recommendations.push('High GPU memory usage - consider reducing texture quality or count');
    }
    
    if (resources.textures > 100) {
      recommendations.push('High texture count - implement texture atlasing or disposal');
    }
    
    if (resources.geometries > 50) {
      recommendations.push('High geometry count - consider instancing or LOD system');
    }
    
    if (leak.hasLeak) {
      recommendations.push('Memory leak detected - check for unreleased resources');
    }
    
    if (leak.trend === 'increasing' && leak.rateOfIncrease > 512 * 1024) {
      recommendations.push('Steady memory increase detected - review resource cleanup');
    }
    
    return recommendations;
  }
}