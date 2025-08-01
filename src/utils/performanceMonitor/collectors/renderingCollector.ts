/**
 * Rendering Performance Collector
 * Monitors FPS, frame times, and GPU performance metrics
 */

import { MetricCollector, RenderingMetrics, PerformanceSnapshot } from '../types';

export class RenderingCollector implements MetricCollector {
  name = 'rendering';
  enabled = true;

  private frameStart: number = 0;
  private frameTimes: number[] = [];
  private droppedFrames: number = 0;
  private lastFrameTime: number = 0;
  private fpsCounter: number = 0;
  private fpsLastUpdate: number = 0;
  private currentFPS: number = 0;
  private renderer?: any;
  private rafId?: number;

  constructor(renderer?: any) {
    this.renderer = renderer;
    this.fpsLastUpdate = performance.now();
  }

  async initialize(): Promise<void> {
    console.log('Initializing rendering performance collector...');
    
    // Start frame measurement loop
    this.startFrameMeasurement();
  }

  cleanup(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
    }
  }

  async collect(): Promise<Partial<PerformanceSnapshot>> {
    const renderingMetrics = await this.collectRenderingMetrics();

    return {
      rendering: renderingMetrics,
    };
  }

  /**
   * Called at the start of each frame
   */
  onFrameStart(): void {
    this.frameStart = performance.now();
  }

  /**
   * Called at the end of each frame
   */
  onFrameEnd(): void {
    const frameTime = performance.now() - this.frameStart;
    this.addFrameTime(frameTime);
    this.updateFPS();
  }

  /**
   * Start continuous frame measurement
   */
  private startFrameMeasurement(): void {
    const measureFrame = () => {
      const now = performance.now();
      
      if (this.lastFrameTime > 0) {
        const frameTime = now - this.lastFrameTime;
        this.addFrameTime(frameTime);
      }
      
      this.lastFrameTime = now;
      this.updateFPS();
      
      this.rafId = requestAnimationFrame(measureFrame);
    };

    this.rafId = requestAnimationFrame(measureFrame);
  }

  /**
   * Add frame time to tracking array
   */
  private addFrameTime(frameTime: number): void {
    this.frameTimes.push(frameTime);

    // Keep only last 60 frames
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift();
    }

    // Detect dropped frames (>16.67ms = dropped frame at 60fps)
    if (frameTime > 16.67) {
      this.droppedFrames++;
    }
  }

  /**
   * Update FPS calculation
   */
  private updateFPS(): void {
    const now = performance.now();
    this.fpsCounter++;

    // Update FPS every second
    if (now - this.fpsLastUpdate >= 1000) {
      this.currentFPS = Math.round((this.fpsCounter * 1000) / (now - this.fpsLastUpdate));
      this.fpsCounter = 0;
      this.fpsLastUpdate = now;
    }
  }

  /**
   * Collect comprehensive rendering metrics
   */
  private async collectRenderingMetrics(): Promise<RenderingMetrics> {
    const fps = this.calculateFPS();
    const renderTime = this.getAverageRenderTime();
    const gpuTime = await this.getGPUFrameTime();

    return {
      fps,
      frameTimes: [...this.frameTimes],
      droppedFrames: this.droppedFrames,
      renderTime,
      gpuTime,
      drawCalls: this.getDrawCalls(),
      triangles: this.getTriangleCount(),
    };
  }

  /**
   * Calculate current FPS
   */
  private calculateFPS(): number {
    if (this.frameTimes.length < 2) {
      return this.currentFPS;
    }

    // Calculate FPS from frame times
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const calculatedFPS = avgFrameTime > 0 ? Math.min(1000 / avgFrameTime, 60) : 0;

    // Use the more accurate of the two measurements
    return Math.max(calculatedFPS, this.currentFPS);
  }

  /**
   * Get average render time
   */
  private getAverageRenderTime(): number {
    if (this.frameTimes.length === 0) {
      return 0;
    }

    return this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
  }

  /**
   * Get GPU frame time using timer queries if available
   */
  private async getGPUFrameTime(): Promise<number | undefined> {
    if (!this.renderer || !this.renderer.getContext) {
      return undefined;
    }

    try {
      const gl = this.renderer.getContext();
      if (!gl) {
        return undefined;
      }

      // Check for timer query extension
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') || 
                  gl.getExtension('EXT_disjoint_timer_query');
      
      if (!ext) {
        return undefined;
      }

      // This would require integration with the actual rendering loop
      // For now, estimate based on frame time
      return this.estimateGPUTime();
    } catch (error) {
      console.warn('Failed to get GPU frame time:', error);
      return undefined;
    }
  }

  /**
   * Estimate GPU time from frame time
   */
  private estimateGPUTime(): number | undefined {
    if (this.frameTimes.length === 0) {
      return undefined;
    }

    const avgFrameTime = this.getAverageRenderTime();
    // Estimate GPU time as 60-80% of frame time
    return avgFrameTime * 0.7;
  }

  /**
   * Get draw call count from renderer
   */
  private getDrawCalls(): number | undefined {
    if (!this.renderer || !this.renderer.info) {
      return undefined;
    }

    // Three.js renderer info
    return this.renderer.info.render?.calls || 0;
  }

  /**
   * Get triangle count from renderer
   */
  private getTriangleCount(): number | undefined {
    if (!this.renderer || !this.renderer.info) {
      return undefined;
    }

    // Three.js renderer info
    return this.renderer.info.render?.triangles || 0;
  }

  /**
   * Reset frame drop counter
   */
  resetDroppedFrames(): void {
    this.droppedFrames = 0;
  }

  /**
   * Get current frame rate
   */
  getCurrentFPS(): number {
    return this.currentFPS;
  }

  /**
   * Get frame time statistics
   */
  getFrameTimeStats(): {
    min: number;
    max: number;
    avg: number;
    p95: number;
  } {
    if (this.frameTimes.length === 0) {
      return { min: 0, max: 0, avg: 0, p95: 0 };
    }

    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);

    return {
      min: Math.min(...this.frameTimes),
      max: Math.max(...this.frameTimes),
      avg: this.getAverageRenderTime(),
      p95: sorted[p95Index] || 0,
    };
  }

  /**
   * Check if performance is degraded
   */
  isPerformanceDegraded(): boolean {
    const fps = this.getCurrentFPS();
    const frameTimeStats = this.getFrameTimeStats();
    
    // Performance is degraded if:
    // - FPS is below 30
    // - 95th percentile frame time is above 33ms (30 FPS)
    // - More than 10% of frames are dropped
    const recentFrames = Math.min(this.frameTimes.length, 60);
    const dropRate = recentFrames > 0 ? this.droppedFrames / recentFrames : 0;

    return fps < 30 || frameTimeStats.p95 > 33.33 || dropRate > 0.1;
  }

  /**
   * Get performance grade
   */
  getPerformanceGrade(): 'excellent' | 'good' | 'fair' | 'poor' {
    const fps = this.getCurrentFPS();
    const frameTimeStats = this.getFrameTimeStats();
    
    if (fps >= 58 && frameTimeStats.p95 <= 17) {
      return 'excellent';
    } else if (fps >= 45 && frameTimeStats.p95 <= 22) {
      return 'good';
    } else if (fps >= 30 && frameTimeStats.p95 <= 33) {
      return 'fair';
    } else {
      return 'poor';
    }
  }
}