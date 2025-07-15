/**
 * WebGPU Enhanced Three.js Renderer with WebGL Fallback
 * Advanced rendering system for v1z3r VJ application
 */

import * as THREE from 'three';
import { WebGPURenderer } from 'three/addons/renderers/webgpu/WebGPURenderer.js';
import { WebGPUDetector, WebGPUCapabilities } from './webgpuDetection';

export interface RendererConfig {
  canvas: HTMLCanvasElement;
  powerPreference: 'low-power' | 'high-performance';
  antialias: boolean;
  alpha: boolean;
  preserveDrawingBuffer: boolean;
  devicePixelRatio: number;
  enableVR: boolean;
  enableWebGPU: boolean;
  fallbackToWebGL: boolean;
  debugMode: boolean;
}

export interface RendererMetrics {
  renderTime: number;
  triangleCount: number;
  drawCalls: number;
  textureMemory: number;
  bufferMemory: number;
  fps: number;
  gpuMemoryUsage: number;
  lastFrameTime: number;
}

export interface AdvancedRenderingFeatures {
  computeShaders: boolean;
  meshShaders: boolean;
  rayTracing: boolean;
  variableRateShading: boolean;
  multiview: boolean;
  timestampQueries: boolean;
}

/**
 * Enhanced Three.js Renderer with WebGPU Support
 */
export class V1z3rRenderer {
  private renderer: THREE.WebGLRenderer | WebGPURenderer | null = null;
  private webgpuDetector: WebGPUDetector;
  private capabilities: WebGPUCapabilities | null = null;
  private config: RendererConfig;
  private metrics: RendererMetrics;
  private isWebGPU: boolean = false;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fpsTimer: number = 0;

  // Performance monitoring
  private renderStartTime: number = 0;
  private triangleCounter: number = 0;
  private drawCallCounter: number = 0;
  private querySet: GPUQuerySet | null = null;
  private timestampBuffer: GPUBuffer | null = null;

  constructor(config: Partial<RendererConfig> = {}) {
    this.config = {
      canvas: document.createElement('canvas'),
      powerPreference: 'high-performance',
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: false,
      devicePixelRatio: Math.min(window.devicePixelRatio, 2),
      enableVR: false,
      enableWebGPU: true,
      fallbackToWebGL: true,
      debugMode: process.env.NODE_ENV === 'development',
      ...config,
    };

    this.webgpuDetector = new WebGPUDetector();
    this.metrics = this.initializeMetrics();
  }

  /**
   * Initialize the renderer with optimal configuration
   */
  async initialize(): Promise<{ renderer: THREE.WebGLRenderer | WebGPURenderer; isWebGPU: boolean }> {
    console.log('[V1z3rRenderer] Initializing renderer...');

    // Detect WebGPU capabilities
    if (this.config.enableWebGPU) {
      this.capabilities = await this.webgpuDetector.detectCapabilities();
      
      if (this.capabilities.isSupported && !this.capabilities.fallbackRequired) {
        try {
          this.renderer = await this.createWebGPURenderer();
          this.isWebGPU = true;
          console.log('[V1z3rRenderer] WebGPU renderer initialized successfully');
        } catch (error) {
          console.warn('[V1z3rRenderer] WebGPU initialization failed, falling back to WebGL:', error);
          this.renderer = this.createWebGLRenderer();
          this.isWebGPU = false;
        }
      } else {
        console.log('[V1z3rRenderer] WebGPU not supported, using WebGL renderer');
        this.renderer = this.createWebGLRenderer();
        this.isWebGPU = false;
      }
    } else {
      this.renderer = this.createWebGLRenderer();
      this.isWebGPU = false;
    }

    // Configure renderer
    await this.configureRenderer();

    // Setup performance monitoring
    this.setupPerformanceMonitoring();

    console.log(`[V1z3rRenderer] Renderer initialized: ${this.isWebGPU ? 'WebGPU' : 'WebGL'}`);
    
    return {
      renderer: this.renderer,
      isWebGPU: this.isWebGPU,
    };
  }

  /**
   * Create WebGPU renderer
   */
  private async createWebGPURenderer(): Promise<WebGPURenderer> {
    if (!this.capabilities) {
      throw new Error('WebGPU capabilities not detected');
    }

    const renderer = new WebGPURenderer({
      canvas: this.config.canvas,
      powerPreference: this.config.powerPreference,
      antialias: this.config.antialias,
      alpha: this.config.alpha,
      preserveDrawingBuffer: this.config.preserveDrawingBuffer,
      forceWebGL: false,
    });

    // Set device pixel ratio
    renderer.setPixelRatio(this.config.devicePixelRatio);

    // Enable advanced features if available
    if (this.capabilities.computeShaderSupport) {
      console.log('[V1z3rRenderer] Compute shaders enabled');
    }

    // Setup timestamp queries for performance monitoring
    if (this.capabilities.features?.has('timestamp-query')) {
      await this.setupTimestampQueries(renderer);
    }

    return renderer;
  }

  /**
   * Create WebGL renderer with optimizations
   */
  private createWebGLRenderer(): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      canvas: this.config.canvas,
      powerPreference: this.config.powerPreference,
      antialias: this.config.antialias,
      alpha: this.config.alpha,
      preserveDrawingBuffer: this.config.preserveDrawingBuffer,
      stencil: false,
      depth: true,
      logarithmicDepthBuffer: false,
    });

    // Set device pixel ratio
    renderer.setPixelRatio(this.config.devicePixelRatio);

    // Enable extensions for better performance
    const gl = renderer.getContext();
    
    // Enable useful WebGL extensions
    const extensions = [
      'EXT_color_buffer_float',
      'EXT_texture_filter_anisotropic',
      'WEBGL_depth_texture',
      'OES_texture_float',
      'OES_texture_float_linear',
      'WEBGL_compressed_texture_s3tc',
      'WEBGL_compressed_texture_etc',
      'WEBGL_compressed_texture_astc',
    ];

    extensions.forEach(ext => {
      const extension = gl.getExtension(ext);
      if (extension) {
        console.log(`[V1z3rRenderer] Enabled extension: ${ext}`);
      }
    });

    return renderer;
  }

  /**
   * Configure renderer settings
   */
  private async configureRenderer(): Promise<void> {
    if (!this.renderer) return;

    // Common renderer settings
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // WebGPU-specific optimizations
    if (this.isWebGPU) {
      const webgpuRenderer = this.renderer as WebGPURenderer;
      
      // Enable advanced features if available
      if (this.capabilities?.computeShaderSupport) {
        // Setup compute pipeline for particle systems
        await this.setupComputePipeline(webgpuRenderer);
      }
    } else {
      const webglRenderer = this.renderer as THREE.WebGLRenderer;
      
      // WebGL-specific optimizations
      webglRenderer.capabilities.logarithmicDepthBuffer = false;
      webglRenderer.capabilities.precision = 'highp';
      webglRenderer.capabilities.vertexTextures = true;
      
      // Enable anisotropic filtering
      const maxAnisotropy = webglRenderer.capabilities.getMaxAnisotropy();
      if (maxAnisotropy > 1) {
        console.log(`[V1z3rRenderer] Max anisotropy: ${maxAnisotropy}`);
      }
    }
  }

  /**
   * Setup timestamp queries for performance monitoring
   */
  private async setupTimestampQueries(renderer: WebGPURenderer): Promise<void> {
    try {
      // Get the WebGPU device from the renderer
      const device = (renderer as any)._device as GPUDevice;
      
      if (!device) {
        console.warn('[V1z3rRenderer] WebGPU device not available for timestamp queries');
        return;
      }

      // Create query set for timestamp queries
      this.querySet = device.createQuerySet({
        type: 'timestamp',
        count: 2, // Start and end timestamps
      });

      // Create buffer to read query results
      this.timestampBuffer = device.createBuffer({
        size: 16, // 2 timestamps * 8 bytes each
        usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
      });

      console.log('[V1z3rRenderer] Timestamp queries initialized');
    } catch (error) {
      console.warn('[V1z3rRenderer] Failed to setup timestamp queries:', error);
    }
  }

  /**
   * Setup compute pipeline for particle systems
   */
  private async setupComputePipeline(renderer: WebGPURenderer): Promise<void> {
    try {
      console.log('[V1z3rRenderer] Setting up compute pipeline for particle systems');
      
      // This will be expanded in the particle system implementation
      // For now, just log that compute shaders are available
      console.log('[V1z3rRenderer] Compute shaders ready for particle systems');
      
    } catch (error) {
      console.warn('[V1z3rRenderer] Failed to setup compute pipeline:', error);
    }
  }

  /**
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    // FPS monitoring
    setInterval(() => {
      this.metrics.fps = this.frameCount;
      this.frameCount = 0;
    }, 1000);

    // Memory monitoring (if available)
    if ((performance as any).memory) {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.metrics.gpuMemoryUsage = memory.usedJSHeapSize;
      }, 5000);
    }
  }

  /**
   * Render a frame with performance monitoring
   */
  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (!this.renderer) return;

    // Start performance monitoring
    this.renderStartTime = performance.now();
    
    // Reset counters
    this.triangleCounter = 0;
    this.drawCallCounter = 0;

    // Record timestamp (WebGPU only)
    if (this.isWebGPU && this.querySet) {
      this.startTimestampQuery();
    }

    // Render the scene
    this.renderer.render(scene, camera);

    // End timestamp query
    if (this.isWebGPU && this.querySet) {
      this.endTimestampQuery();
    }

    // Update metrics
    this.updateMetrics();

    // Increment frame counter
    this.frameCount++;
  }

  /**
   * Start timestamp query for GPU timing
   */
  private startTimestampQuery(): void {
    // This would need access to the command encoder
    // Implementation depends on Three.js WebGPU renderer internals
  }

  /**
   * End timestamp query for GPU timing
   */
  private endTimestampQuery(): void {
    // This would need access to the command encoder
    // Implementation depends on Three.js WebGPU renderer internals
  }

  /**
   * Update rendering metrics
   */
  private updateMetrics(): void {
    const currentTime = performance.now();
    this.metrics.renderTime = currentTime - this.renderStartTime;
    this.metrics.lastFrameTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    if (this.renderer) {
      const info = this.renderer.info;
      this.metrics.triangleCount = info.render.triangles;
      this.metrics.drawCalls = info.render.calls;
      
      // Estimate memory usage
      this.metrics.textureMemory = info.memory.textures * 1024 * 1024; // Rough estimate
      this.metrics.bufferMemory = info.memory.geometries * 1024 * 1024; // Rough estimate
    }
  }

  /**
   * Get advanced rendering features available
   */
  getAdvancedFeatures(): AdvancedRenderingFeatures {
    const features: AdvancedRenderingFeatures = {
      computeShaders: false,
      meshShaders: false,
      rayTracing: false,
      variableRateShading: false,
      multiview: false,
      timestampQueries: false,
    };

    if (this.isWebGPU && this.capabilities) {
      features.computeShaders = this.capabilities.computeShaderSupport;
      features.timestampQueries = this.capabilities.features?.has('timestamp-query') || false;
      
      // Check for other advanced features
      features.meshShaders = this.capabilities.features?.has('indirect-first-instance') || false;
      features.multiview = this.capabilities.features?.has('multiview') || false;
    }

    return features;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): RendererMetrics {
    return { ...this.metrics };
  }

  /**
   * Get renderer capabilities
   */
  getCapabilities(): WebGPUCapabilities | null {
    return this.capabilities;
  }

  /**
   * Check if using WebGPU
   */
  isUsingWebGPU(): boolean {
    return this.isWebGPU;
  }

  /**
   * Resize renderer
   */
  setSize(width: number, height: number): void {
    if (this.renderer) {
      this.renderer.setSize(width, height);
    }
  }

  /**
   * Set pixel ratio
   */
  setPixelRatio(ratio: number): void {
    if (this.renderer) {
      this.renderer.setPixelRatio(Math.min(ratio, 2)); // Cap at 2x for performance
    }
  }

  /**
   * Get the underlying Three.js renderer
   */
  getThreeRenderer(): THREE.WebGLRenderer | WebGPURenderer | null {
    return this.renderer;
  }

  /**
   * Initialize default metrics
   */
  private initializeMetrics(): RendererMetrics {
    return {
      renderTime: 0,
      triangleCount: 0,
      drawCalls: 0,
      textureMemory: 0,
      bufferMemory: 0,
      fps: 0,
      gpuMemoryUsage: 0,
      lastFrameTime: 0,
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    if (this.querySet) {
      this.querySet = null;
    }

    if (this.timestampBuffer) {
      this.timestampBuffer.destroy();
      this.timestampBuffer = null;
    }

    this.webgpuDetector.dispose();
  }
}

/**
 * Factory function to create optimized renderer
 */
export async function createV1z3rRenderer(config?: Partial<RendererConfig>): Promise<V1z3rRenderer> {
  const renderer = new V1z3rRenderer(config);
  await renderer.initialize();
  return renderer;
}

/**
 * Check WebGPU support without full initialization
 */
export async function checkWebGPUSupport(): Promise<boolean> {
  try {
    const detector = new WebGPUDetector();
    const capabilities = await detector.detectCapabilities();
    detector.dispose();
    return capabilities.isSupported && !capabilities.fallbackRequired;
  } catch {
    return false;
  }
}