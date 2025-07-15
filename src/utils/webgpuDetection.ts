/**
 * WebGPU Detection and Capability Assessment
 * Comprehensive browser compatibility and performance testing for WebGPU
 */

export interface WebGPUCapabilities {
  isSupported: boolean;
  adapterInfo?: GPUAdapterInfo;
  limits?: GPUSupportedLimits;
  features?: GPUSupportedFeatures;
  preferredFormat?: GPUTextureFormat;
  powerPreference: GPUPowerPreference;
  fallbackRequired: boolean;
  performanceRating: 'excellent' | 'good' | 'fair' | 'poor';
  computeShaderSupport: boolean;
  recommendedConfig: WebGPUConfig;
}

export interface WebGPUConfig {
  powerPreference: GPUPowerPreference;
  forceFallbackAdapter: boolean;
  enableComputeShaders: boolean;
  maxTextureSize: number;
  maxBufferSize: number;
  maxComputeWorkgroupSize: number;
  preferredFormat: GPUTextureFormat;
  enableDebug: boolean;
}

export interface GPUMetrics {
  vendor: string;
  architecture: string;
  driverVersion: string;
  memorySize: number;
  computeUnits: number;
  maxTextureSize: number;
  maxBufferSize: number;
}

/**
 * WebGPU Detection and Configuration Manager
 */
export class WebGPUDetector {
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;
  private capabilities: WebGPUCapabilities | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private context: GPUCanvasContext | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1;
    this.canvas.height = 1;
  }

  /**
   * Detect WebGPU support and capabilities
   */
  async detectCapabilities(): Promise<WebGPUCapabilities> {
    if (this.capabilities) {
      return this.capabilities;
    }

    const capabilities: WebGPUCapabilities = {
      isSupported: false,
      powerPreference: 'high-performance',
      fallbackRequired: true,
      performanceRating: 'poor',
      computeShaderSupport: false,
      recommendedConfig: this.getDefaultConfig(),
    };

    try {
      // Check for WebGPU support
      if (!navigator.gpu) {
        console.warn('[WebGPU] Not supported in this browser');
        this.capabilities = capabilities;
        return capabilities;
      }

      // Request adapter with high performance preference
      this.adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
        forceFallbackAdapter: false,
      });

      if (!this.adapter) {
        console.warn('[WebGPU] Failed to get adapter');
        this.capabilities = capabilities;
        return capabilities;
      }

      // Get adapter info and capabilities
      capabilities.isSupported = true;
      capabilities.adapterInfo = await this.adapter.requestAdapterInfo();
      capabilities.limits = this.adapter.limits;
      capabilities.features = this.adapter.features;

      // Request device to test full capabilities
      const deviceDescriptor: GPUDeviceDescriptor = {
        label: 'v1z3r-webgpu-device',
        requiredFeatures: this.getRequiredFeatures(this.adapter),
        requiredLimits: this.getRequiredLimits(this.adapter),
      };

      this.device = await this.adapter.requestDevice(deviceDescriptor);

      if (!this.device) {
        console.warn('[WebGPU] Failed to get device');
        this.capabilities = capabilities;
        return capabilities;
      }

      // Test canvas context
      this.context = this.canvas!.getContext('webgpu') as GPUCanvasContext;
      if (!this.context) {
        console.warn('[WebGPU] Failed to get canvas context');
        this.capabilities = capabilities;
        return capabilities;
      }

      // Configure context to test format support
      const preferredFormat = navigator.gpu.getPreferredCanvasFormat();
      capabilities.preferredFormat = preferredFormat;

      this.context.configure({
        device: this.device,
        format: preferredFormat,
        alphaMode: 'premultiplied',
      });

      // Test compute shader support
      capabilities.computeShaderSupport = await this.testComputeShaderSupport();

      // Assess performance rating
      capabilities.performanceRating = this.assessPerformanceRating();

      // Generate recommended configuration
      capabilities.recommendedConfig = this.generateRecommendedConfig();

      capabilities.fallbackRequired = false;

      console.log('[WebGPU] Detection successful:', capabilities);

    } catch (error) {
      console.error('[WebGPU] Detection failed:', error);
      capabilities.fallbackRequired = true;
    }

    this.capabilities = capabilities;
    return capabilities;
  }

  /**
   * Test compute shader support with a simple computation
   */
  private async testComputeShaderSupport(): Promise<boolean> {
    if (!this.device) return false;

    try {
      // Simple compute shader test
      const computeShaderModule = this.device.createShaderModule({
        label: 'test-compute-shader',
        code: `
          @group(0) @binding(0) var<storage, read_write> data: array<f32>;
          
          @compute @workgroup_size(1)
          fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
            data[global_id.x] = data[global_id.x] * 2.0;
          }
        `,
      });

      const computePipeline = this.device.createComputePipeline({
        label: 'test-compute-pipeline',
        layout: 'auto',
        compute: {
          module: computeShaderModule,
          entryPoint: 'main',
        },
      });

      // Create test buffer
      const testData = new Float32Array([1.0, 2.0, 3.0, 4.0]);
      const buffer = this.device.createBuffer({
        label: 'test-buffer',
        size: testData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
      });

      this.device.queue.writeBuffer(buffer, 0, testData);

      // Create bind group
      const bindGroup = this.device.createBindGroup({
        label: 'test-bind-group',
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: {
              buffer: buffer,
            },
          },
        ],
      });

      // Execute compute shader
      const commandEncoder = this.device.createCommandEncoder();
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(testData.length);
      computePass.end();

      this.device.queue.submit([commandEncoder.finish()]);

      // Wait for completion and verify
      await this.device.queue.onSubmittedWorkDone();

      buffer.destroy();
      return true;

    } catch (error) {
      console.warn('[WebGPU] Compute shader test failed:', error);
      return false;
    }
  }

  /**
   * Assess performance rating based on adapter capabilities
   */
  private assessPerformanceRating(): 'excellent' | 'good' | 'fair' | 'poor' {
    if (!this.adapter || !this.capabilities?.adapterInfo) {
      return 'poor';
    }

    const limits = this.adapter.limits;
    const info = this.capabilities.adapterInfo;

    // Performance indicators
    const hasHighMemory = limits.maxBufferSize >= 1024 * 1024 * 1024; // 1GB
    const hasHighTexture = limits.maxTextureDimension2D >= 8192;
    const hasHighWorkgroup = limits.maxComputeWorkgroupSizeX >= 256;
    const hasManyBindings = limits.maxBindGroups >= 8;

    // Vendor-specific optimizations
    const isHighEndVendor = info.vendor.toLowerCase().includes('nvidia') ||
                           info.vendor.toLowerCase().includes('amd') ||
                           info.vendor.toLowerCase().includes('intel') && 
                           info.architecture.toLowerCase().includes('arc');

    const indicators = [
      hasHighMemory,
      hasHighTexture,
      hasHighWorkgroup,
      hasManyBindings,
      isHighEndVendor,
    ].filter(Boolean).length;

    if (indicators >= 4) return 'excellent';
    if (indicators >= 3) return 'good';
    if (indicators >= 2) return 'fair';
    return 'poor';
  }

  /**
   * Generate recommended configuration based on capabilities
   */
  private generateRecommendedConfig(): WebGPUConfig {
    const defaultConfig = this.getDefaultConfig();

    if (!this.adapter || !this.capabilities) {
      return defaultConfig;
    }

    const limits = this.adapter.limits;
    const rating = this.capabilities.performanceRating;

    return {
      powerPreference: rating === 'excellent' ? 'high-performance' : 'low-power',
      forceFallbackAdapter: false,
      enableComputeShaders: this.capabilities.computeShaderSupport,
      maxTextureSize: Math.min(limits.maxTextureDimension2D, rating === 'excellent' ? 8192 : 4096),
      maxBufferSize: Math.min(limits.maxBufferSize, rating === 'excellent' ? 1024 * 1024 * 1024 : 256 * 1024 * 1024),
      maxComputeWorkgroupSize: Math.min(limits.maxComputeWorkgroupSizeX, 256),
      preferredFormat: this.capabilities.preferredFormat || 'bgra8unorm',
      enableDebug: process.env.NODE_ENV === 'development',
    };
  }

  /**
   * Get required features for v1z3r
   */
  private getRequiredFeatures(adapter: GPUAdapter): GPUFeatureName[] {
    const features: GPUFeatureName[] = [];

    // Essential features for VJ application
    if (adapter.features.has('timestamp-query')) {
      features.push('timestamp-query');
    }

    if (adapter.features.has('pipeline-statistics-query' as GPUFeatureName)) {
      features.push('pipeline-statistics-query' as GPUFeatureName);
    }

    // Texture compression for better performance
    if (adapter.features.has('texture-compression-bc')) {
      features.push('texture-compression-bc');
    }

    if (adapter.features.has('texture-compression-etc2')) {
      features.push('texture-compression-etc2');
    }

    if (adapter.features.has('texture-compression-astc')) {
      features.push('texture-compression-astc');
    }

    return features;
  }

  /**
   * Get required limits for v1z3r
   */
  private getRequiredLimits(adapter: GPUAdapter): Record<string, number> {
    const limits: Record<string, number> = {};

    // Ensure we have sufficient resources for VJ application
    limits.maxBindGroups = Math.min(adapter.limits.maxBindGroups, 8);
    limits.maxBufferSize = Math.min(adapter.limits.maxBufferSize, 512 * 1024 * 1024); // 512MB
    limits.maxTextureDimension2D = Math.min(adapter.limits.maxTextureDimension2D, 4096);
    limits.maxComputeWorkgroupSizeX = Math.min(adapter.limits.maxComputeWorkgroupSizeX, 256);

    return limits;
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): WebGPUConfig {
    return {
      powerPreference: 'high-performance',
      forceFallbackAdapter: false,
      enableComputeShaders: false,
      maxTextureSize: 2048,
      maxBufferSize: 128 * 1024 * 1024, // 128MB
      maxComputeWorkgroupSize: 64,
      preferredFormat: 'bgra8unorm',
      enableDebug: process.env.NODE_ENV === 'development',
    };
  }

  /**
   * Get GPU metrics for performance analysis
   */
  async getGPUMetrics(): Promise<GPUMetrics | null> {
    if (!this.capabilities?.adapterInfo) {
      return null;
    }

    const info = this.capabilities.adapterInfo;
    const limits = this.adapter?.limits;

    return {
      vendor: info.vendor,
      architecture: info.architecture,
      driverVersion: (info as any).driverVersion || 'unknown',
      memorySize: this.estimateGPUMemory(),
      computeUnits: this.estimateComputeUnits(),
      maxTextureSize: limits?.maxTextureDimension2D || 0,
      maxBufferSize: limits?.maxBufferSize || 0,
    };
  }

  /**
   * Estimate GPU memory size
   */
  private estimateGPUMemory(): number {
    if (!this.adapter) return 0;

    // Rough estimation based on max buffer size
    const maxBuffer = this.adapter.limits.maxBufferSize;
    
    // Most GPUs allow buffer sizes up to ~25% of total memory
    return Math.round(maxBuffer * 4);
  }

  /**
   * Estimate compute units
   */
  private estimateComputeUnits(): number {
    if (!this.adapter) return 0;

    const maxWorkgroupSize = this.adapter.limits.maxComputeWorkgroupSizeX;
    const maxWorkgroups = this.adapter.limits.maxComputeWorkgroupsPerDimension;

    // Rough estimation based on max parallel execution
    return Math.round((maxWorkgroupSize * maxWorkgroups) / 64);
  }

  /**
   * Test WebGPU performance with benchmark
   */
  async benchmarkPerformance(): Promise<{
    renderTime: number;
    computeTime: number;
    memoryBandwidth: number;
    score: number;
  }> {
    if (!this.device || !this.context) {
      throw new Error('WebGPU not initialized');
    }

    const results = {
      renderTime: 0,
      computeTime: 0,
      memoryBandwidth: 0,
      score: 0,
    };

    try {
      // Render performance test
      results.renderTime = await this.benchmarkRenderPerformance();
      
      // Compute performance test
      if (this.capabilities?.computeShaderSupport) {
        results.computeTime = await this.benchmarkComputePerformance();
      }

      // Memory bandwidth test
      results.memoryBandwidth = await this.benchmarkMemoryBandwidth();

      // Calculate overall score
      results.score = this.calculatePerformanceScore(results);

    } catch (error) {
      console.error('[WebGPU] Performance benchmark failed:', error);
    }

    return results;
  }

  private async benchmarkRenderPerformance(): Promise<number> {
    // Simple render performance test
    const startTime = performance.now();
    
    // Render multiple frames with simple geometry
    for (let i = 0; i < 100; i++) {
      const commandEncoder = this.device!.createCommandEncoder();
      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: this.context!.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });
      renderPass.end();
      this.device!.queue.submit([commandEncoder.finish()]);
    }

    await this.device!.queue.onSubmittedWorkDone();
    
    const endTime = performance.now();
    return endTime - startTime;
  }

  private async benchmarkComputePerformance(): Promise<number> {
    const startTime = performance.now();
    
    // Simple compute benchmark - matrix multiplication
    const size = 512;
    const bufferSize = size * size * 4; // Float32Array

    const buffer = this.device!.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const computeShader = this.device!.createShaderModule({
      code: `
        @group(0) @binding(0) var<storage, read_write> data: array<f32>;
        
        @compute @workgroup_size(8, 8)
        fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
          let index = global_id.y * ${size}u + global_id.x;
          if (index < arrayLength(&data)) {
            data[index] = sin(f32(index) * 0.01) * cos(f32(index) * 0.02);
          }
        }
      `,
    });

    const computePipeline = this.device!.createComputePipeline({
      layout: 'auto',
      compute: {
        module: computeShader,
        entryPoint: 'main',
      },
    });

    const bindGroup = this.device!.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer },
        },
      ],
    });

    const commandEncoder = this.device!.createCommandEncoder();
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, bindGroup);
    computePass.dispatchWorkgroups(size / 8, size / 8);
    computePass.end();
    this.device!.queue.submit([commandEncoder.finish()]);

    await this.device!.queue.onSubmittedWorkDone();
    
    buffer.destroy();
    
    const endTime = performance.now();
    return endTime - startTime;
  }

  private async benchmarkMemoryBandwidth(): Promise<number> {
    const startTime = performance.now();
    
    // Memory bandwidth test - large buffer operations
    const bufferSize = 64 * 1024 * 1024; // 64MB
    const data = new Float32Array(bufferSize / 4);
    
    const buffer = this.device!.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });

    // Write multiple times to test bandwidth
    for (let i = 0; i < 10; i++) {
      this.device!.queue.writeBuffer(buffer, 0, data);
    }

    await this.device!.queue.onSubmittedWorkDone();
    
    buffer.destroy();
    
    const endTime = performance.now();
    return (bufferSize * 10) / ((endTime - startTime) / 1000); // bytes per second
  }

  private calculatePerformanceScore(results: any): number {
    // Normalize and weight different performance metrics
    const renderScore = Math.max(0, 100 - results.renderTime); // Lower is better
    const computeScore = Math.max(0, 100 - results.computeTime); // Lower is better
    const bandwidthScore = Math.min(100, results.memoryBandwidth / (1024 * 1024 * 1024)); // GB/s

    return (renderScore * 0.4 + computeScore * 0.3 + bandwidthScore * 0.3);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
    this.adapter = null;
    this.context = null;
    this.capabilities = null;
  }
}

// Global WebGPU detector instance
export const webgpuDetector = new WebGPUDetector();