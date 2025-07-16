/**
 * WebGPU Performance Monitoring System
 * Advanced performance tracking for GPU-accelerated rendering
 */

import React from 'react';
import { V1z3rRenderer } from './webgpuRenderer';

export interface WebGPUMetrics {
  // GPU Timing
  gpuFrameTime: number;
  computePassTime: number;
  renderPassTime: number;
  bufferUpdateTime: number;
  
  // GPU Memory
  bufferMemory: number;
  textureMemory: number;
  totalGPUMemory: number;
  
  // Particle System
  particleCount: number;
  particleComputeTime: number;
  particleBufferSize: number;
  
  // Pipeline Statistics
  vertexCount: number;
  fragmentCount: number;
  computeInvocations: number;
  
  // Frame Statistics
  fps: number;
  frameTime: number;
  cpuFrameTime: number;
  gpuUtilization: number;
}

export interface GPUPerformanceThresholds {
  maxGPUFrameTime: number; // ms
  maxComputeTime: number; // ms
  maxMemoryUsage: number; // bytes
  minFPS: number;
  maxGPUUtilization: number; // percentage
}

export class WebGPUPerformanceMonitor {
  private device: GPUDevice | null = null;
  private metrics: WebGPUMetrics;
  private thresholds: GPUPerformanceThresholds;
  private querySet: GPUQuerySet | null = null;
  private resolveBuffer: GPUBuffer | null = null;
  private resultBuffer: GPUBuffer | null = null;
  private frameCount = 0;
  private lastFrameTime = 0;
  private fpsTimer = 0;
  private history: WebGPUMetrics[] = [];
  private maxHistorySize = 300;
  
  constructor(thresholds?: Partial<GPUPerformanceThresholds>) {
    this.thresholds = {
      maxGPUFrameTime: 16.67, // 60 FPS
      maxComputeTime: 8.0, // Half frame budget for compute
      maxMemoryUsage: 2 * 1024 * 1024 * 1024, // 2GB
      minFPS: 30,
      maxGPUUtilization: 90,
      ...thresholds,
    };
    
    this.metrics = this.initializeMetrics();
  }
  
  private initializeMetrics(): WebGPUMetrics {
    return {
      gpuFrameTime: 0,
      computePassTime: 0,
      renderPassTime: 0,
      bufferUpdateTime: 0,
      bufferMemory: 0,
      textureMemory: 0,
      totalGPUMemory: 0,
      particleCount: 0,
      particleComputeTime: 0,
      particleBufferSize: 0,
      vertexCount: 0,
      fragmentCount: 0,
      computeInvocations: 0,
      fps: 0,
      frameTime: 0,
      cpuFrameTime: 0,
      gpuUtilization: 0,
    };
  }
  
  /**
   * Initialize with WebGPU device
   */
  async initialize(device: GPUDevice): Promise<void> {
    this.device = device;
    
    // Check for timestamp query support
    if (!device.features.has('timestamp-query')) {
      console.warn('Timestamp queries not supported, GPU timing will be estimated');
      return;
    }
    
    try {
      // Create query set for timing
      this.querySet = device.createQuerySet({
        type: 'timestamp',
        count: 8, // Multiple timing points
      });
      
      // Create buffers for query resolution
      const queryResolveSize = 8 * 8; // 8 timestamps * 8 bytes each
      this.resolveBuffer = device.createBuffer({
        size: queryResolveSize,
        usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
      });
      
      this.resultBuffer = device.createBuffer({
        size: queryResolveSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });
      
      console.log('[WebGPU Performance] Timestamp queries initialized');
    } catch (error) {
      console.error('[WebGPU Performance] Failed to initialize timestamp queries:', error);
    }
  }
  
  /**
   * Begin frame timing
   */
  beginFrame(commandEncoder: GPUCommandEncoder): void {
    const cpuStart = performance.now();
    
    if (this.querySet && commandEncoder) {
      commandEncoder.writeTimestamp(this.querySet, 0);
    }
    
    // Store CPU frame start time
    this.lastFrameTime = cpuStart;
  }
  
  /**
   * Mark compute pass timing
   */
  beginComputePass(computePass: GPUComputePassEncoder): void {
    // Timestamp queries on compute passes are recorded at encoder level
    // Will be handled in endFrame
  }
  
  endComputePass(computePass: GPUComputePassEncoder): void {
    // Timestamp queries on compute passes are recorded at encoder level
    // Will be handled in endFrame
  }
  
  /**
   * Mark render pass timing
   */
  beginRenderPass(renderPass: GPURenderPassEncoder): void {
    // Timestamp queries on render passes are recorded at encoder level
    // Will be handled in endFrame
  }
  
  endRenderPass(renderPass: GPURenderPassEncoder): void {
    // Timestamp queries on render passes are recorded at encoder level
    // Will be handled in endFrame
  }
  
  /**
   * End frame timing and resolve queries
   */
  async endFrame(commandEncoder: GPUCommandEncoder): Promise<void> {
    if (!this.device) return;
    
    const cpuEnd = performance.now();
    this.metrics.cpuFrameTime = cpuEnd - this.lastFrameTime;
    
    if (this.querySet && this.resolveBuffer && this.resultBuffer && commandEncoder) {
      // Write final timestamp
      commandEncoder.writeTimestamp(this.querySet, 5);
      
      // Resolve timestamp queries
      commandEncoder.resolveQuerySet(
        this.querySet,
        0, // First query
        6, // Number of queries
        this.resolveBuffer,
        0  // Destination offset
      );
      
      // Copy to readable buffer
      commandEncoder.copyBufferToBuffer(
        this.resolveBuffer,
        0,
        this.resultBuffer,
        0,
        this.resolveBuffer.size
      );
    }
    
    // Update FPS
    this.frameCount++;
    const elapsed = cpuEnd - this.fpsTimer;
    if (elapsed >= 1000) {
      this.metrics.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.fpsTimer = cpuEnd;
    }
    
    // Read GPU timing results
    if (this.resultBuffer) {
      await this.readTimingResults();
    }
    
    // Calculate GPU utilization
    this.metrics.gpuUtilization = Math.min(
      100,
      (this.metrics.gpuFrameTime / this.metrics.frameTime) * 100
    );
    
    // Update history
    this.updateHistory();
  }
  
  /**
   * Read timestamp query results
   */
  private async readTimingResults(): Promise<void> {
    if (!this.resultBuffer || !this.device) return;
    
    try {
      await this.resultBuffer.mapAsync(GPUMapMode.READ);
      const arrayBuffer = this.resultBuffer.getMappedRange();
      const timestamps = new BigUint64Array(arrayBuffer);
      
      // Convert nanoseconds to milliseconds
      const nsToMs = 1e-6;
      
      if (timestamps.length >= 6) {
        const frameStart = Number(timestamps[0]);
        const computeStart = Number(timestamps[1]);
        const computeEnd = Number(timestamps[2]);
        const renderStart = Number(timestamps[3]);
        const renderEnd = Number(timestamps[4]);
        const frameEnd = Number(timestamps[5]);
        
        this.metrics.gpuFrameTime = (frameEnd - frameStart) * nsToMs;
        this.metrics.computePassTime = (computeEnd - computeStart) * nsToMs;
        this.metrics.renderPassTime = (renderEnd - renderStart) * nsToMs;
      }
      
      this.resultBuffer.unmap();
    } catch (error) {
      console.warn('[WebGPU Performance] Failed to read timing results:', error);
    }
  }
  
  /**
   * Update particle system metrics
   */
  updateParticleMetrics(count: number, bufferSize: number, computeTime?: number): void {
    this.metrics.particleCount = count;
    this.metrics.particleBufferSize = bufferSize;
    if (computeTime !== undefined) {
      this.metrics.particleComputeTime = computeTime;
    }
  }
  
  /**
   * Update memory metrics
   */
  updateMemoryMetrics(bufferMemory: number, textureMemory: number): void {
    this.metrics.bufferMemory = bufferMemory;
    this.metrics.textureMemory = textureMemory;
    this.metrics.totalGPUMemory = bufferMemory + textureMemory;
  }
  
  /**
   * Update pipeline statistics
   */
  updatePipelineStats(vertexCount: number, fragmentCount: number, computeInvocations: number): void {
    this.metrics.vertexCount = vertexCount;
    this.metrics.fragmentCount = fragmentCount;
    this.metrics.computeInvocations = computeInvocations;
  }
  
  /**
   * Check performance thresholds
   */
  checkThresholds(): { violations: string[]; warnings: string[] } {
    const violations: string[] = [];
    const warnings: string[] = [];
    
    // Critical violations
    if (this.metrics.fps < this.thresholds.minFPS) {
      violations.push(`FPS below threshold: ${this.metrics.fps} < ${this.thresholds.minFPS}`);
    }
    
    if (this.metrics.gpuFrameTime > this.thresholds.maxGPUFrameTime) {
      violations.push(`GPU frame time too high: ${this.metrics.gpuFrameTime.toFixed(2)}ms`);
    }
    
    if (this.metrics.totalGPUMemory > this.thresholds.maxMemoryUsage) {
      violations.push(`GPU memory usage too high: ${(this.metrics.totalGPUMemory / 1024 / 1024).toFixed(1)}MB`);
    }
    
    // Warnings
    if (this.metrics.computePassTime > this.thresholds.maxComputeTime) {
      warnings.push(`Compute pass time high: ${this.metrics.computePassTime.toFixed(2)}ms`);
    }
    
    if (this.metrics.gpuUtilization > this.thresholds.maxGPUUtilization) {
      warnings.push(`GPU utilization high: ${this.metrics.gpuUtilization.toFixed(1)}%`);
    }
    
    return { violations, warnings };
  }
  
  /**
   * Get current metrics
   */
  getMetrics(): WebGPUMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Get average metrics
   */
  getAverageMetrics(seconds: number = 5): WebGPUMetrics {
    const samplesToAverage = Math.min(
      Math.floor(seconds * this.metrics.fps),
      this.history.length
    );
    
    if (samplesToAverage === 0) {
      return this.getMetrics();
    }
    
    const relevantHistory = this.history.slice(-samplesToAverage);
    const avgMetrics = this.initializeMetrics();
    
    // Calculate averages
    for (const sample of relevantHistory) {
      Object.keys(avgMetrics).forEach(key => {
        const k = key as keyof WebGPUMetrics;
        avgMetrics[k] += sample[k];
      });
    }
    
    // Divide by sample count
    Object.keys(avgMetrics).forEach(key => {
      const k = key as keyof WebGPUMetrics;
      avgMetrics[k] /= relevantHistory.length;
    });
    
    return avgMetrics;
  }
  
  /**
   * Generate performance report
   */
  generateReport(): string {
    const current = this.getMetrics();
    const average = this.getAverageMetrics(5);
    const { violations, warnings } = this.checkThresholds();
    
    return `
WebGPU Performance Report
========================
Current Performance:
  FPS: ${current.fps}
  Frame Time: ${current.frameTime.toFixed(2)}ms (CPU: ${current.cpuFrameTime.toFixed(2)}ms)
  GPU Frame Time: ${current.gpuFrameTime.toFixed(2)}ms
  GPU Utilization: ${current.gpuUtilization.toFixed(1)}%
  
GPU Timing:
  Compute Pass: ${current.computePassTime.toFixed(2)}ms
  Render Pass: ${current.renderPassTime.toFixed(2)}ms
  Buffer Updates: ${current.bufferUpdateTime.toFixed(2)}ms
  
Particle System:
  Particle Count: ${current.particleCount.toLocaleString()}
  Compute Time: ${current.particleComputeTime.toFixed(2)}ms
  Buffer Size: ${(current.particleBufferSize / 1024 / 1024).toFixed(1)}MB
  
Memory Usage:
  Buffer Memory: ${(current.bufferMemory / 1024 / 1024).toFixed(1)}MB
  Texture Memory: ${(current.textureMemory / 1024 / 1024).toFixed(1)}MB
  Total GPU Memory: ${(current.totalGPUMemory / 1024 / 1024).toFixed(1)}MB
  
Pipeline Statistics:
  Vertices: ${current.vertexCount.toLocaleString()}
  Fragments: ${current.fragmentCount.toLocaleString()}
  Compute Invocations: ${current.computeInvocations.toLocaleString()}
  
5-Second Average:
  FPS: ${average.fps}
  GPU Frame Time: ${average.gpuFrameTime.toFixed(2)}ms
  GPU Utilization: ${average.gpuUtilization.toFixed(1)}%
  
Status:
  Violations: ${violations.length > 0 ? violations.join(', ') : 'None'}
  Warnings: ${warnings.length > 0 ? warnings.join(', ') : 'None'}
`;
  }
  
  /**
   * Update metrics history
   */
  private updateHistory(): void {
    this.history.push({ ...this.metrics });
    
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }
  
  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.querySet) {
      this.querySet.destroy();
      this.querySet = null;
    }
    
    if (this.resolveBuffer) {
      this.resolveBuffer.destroy();
      this.resolveBuffer = null;
    }
    
    if (this.resultBuffer) {
      this.resultBuffer.destroy();
      this.resultBuffer = null;
    }
    
    this.history = [];
    this.device = null;
  }
}

// Singleton instance
let gpuMonitorInstance: WebGPUPerformanceMonitor | null = null;

/**
 * Get or create WebGPU performance monitor
 */
export function getWebGPUPerformanceMonitor(thresholds?: Partial<GPUPerformanceThresholds>): WebGPUPerformanceMonitor {
  if (!gpuMonitorInstance) {
    gpuMonitorInstance = new WebGPUPerformanceMonitor(thresholds);
  }
  return gpuMonitorInstance;
}

/**
 * React hook for WebGPU performance monitoring
 */
export function useWebGPUPerformanceMonitor() {
  const [metrics, setMetrics] = React.useState<WebGPUMetrics | null>(null);
  const [status, setStatus] = React.useState<{ violations: string[]; warnings: string[] }>({
    violations: [],
    warnings: [],
  });
  
  React.useEffect(() => {
    const monitor = getWebGPUPerformanceMonitor();
    
    const updateMetrics = () => {
      setMetrics(monitor.getMetrics());
      setStatus(monitor.checkThresholds());
    };
    
    // Update every second
    const interval = setInterval(updateMetrics, 1000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);
  
  return { metrics, status };
}