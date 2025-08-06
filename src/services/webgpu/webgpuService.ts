/**
 * WebGPU Service
 * Centralized WebGPU management and resource handling
 */

import { errorHandler } from '@/utils/errorHandler';

export interface WebGPUCapabilities {
  maxBufferSize: number;
  maxTextureSize: number;
  maxComputeWorkgroupsPerDimension: number;
  maxComputeWorkgroupSizeX: number;
  maxComputeWorkgroupSizeY: number;
  maxComputeWorkgroupSizeZ: number;
  timestampQuery: boolean;
  textureCompressionBC: boolean;
  textureCompressionETC2: boolean;
  textureCompressionASTC: boolean;
  shaderF16: boolean;
  depthClipControl: boolean;
  depth32FloatStencil8: boolean;
  indirectFirstInstance: boolean;
}

export interface WebGPUDevice {
  device: GPUDevice;
  adapter: GPUAdapter;
  capabilities: WebGPUCapabilities;
  limits: GPUSupportedLimits;
  features: GPUSupportedFeatures;
}

export class WebGPUService {
  private static instance: WebGPUService | null = null;
  private device: GPUDevice | null = null;
  private adapter: GPUAdapter | null = null;
  private capabilities: WebGPUCapabilities | null = null;
  private initPromise: Promise<WebGPUDevice> | null = null;

  private constructor() {}

  static getInstance(): WebGPUService {
    if (!WebGPUService.instance) {
      WebGPUService.instance = new WebGPUService();
    }
    return WebGPUService.instance;
  }

  /**
   * Check if WebGPU is supported
   */
  static isSupported(): boolean {
    return 'gpu' in navigator && navigator.gpu !== undefined;
  }

  /**
   * Initialize WebGPU
   */
  async initialize(): Promise<WebGPUDevice> {
    // Return existing initialization if in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    // Return existing device if already initialized
    if (this.device && this.adapter && this.capabilities) {
      return {
        device: this.device,
        adapter: this.adapter,
        capabilities: this.capabilities,
        limits: this.device.limits,
        features: this.device.features,
      };
    }

    this.initPromise = this.initializeInternal();
    return this.initPromise;
  }

  private async initializeInternal(): Promise<WebGPUDevice> {
    try {
      if (!WebGPUService.isSupported()) {
        throw new Error('WebGPU is not supported in this browser');
      }

      // Request adapter with high performance preference
      this.adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
      });

      if (!this.adapter) {
        throw new Error('Failed to get WebGPU adapter');
      }

      // Request device with optional features
      const requiredFeatures: GPUFeatureName[] = [];
      const optionalFeatures: GPUFeatureName[] = [
        'timestamp-query',
        'texture-compression-bc',
        'texture-compression-etc2',
        'texture-compression-astc',
        'shader-f16',
        'depth-clip-control',
        'depth32float-stencil8',
        'indirect-first-instance',
      ];

      // Filter supported features
      const supportedFeatures = optionalFeatures.filter(feature => 
        this.adapter!.features.has(feature)
      );

      this.device = await this.adapter.requestDevice({
        requiredFeatures,
        requiredLimits: {
          maxTextureDimension2D: 8192,
          maxBufferSize: 1024 * 1024 * 1024, // 1GB
          maxStorageBufferBindingSize: 1024 * 1024 * 256, // 256MB
          maxComputeWorkgroupStorageSize: 16384,
          maxComputeInvocationsPerWorkgroup: 256,
        },
      });

      if (!this.device) {
        throw new Error('Failed to get WebGPU device');
      }

      // Extract capabilities
      this.capabilities = this.extractCapabilities();

      // Set up device lost handler
      this.device.lost.then((info) => {
        errorHandler.error('WebGPU device lost', new Error(info.message));
        this.cleanup();
      });

      errorHandler.info('WebGPU initialized successfully', new Error(`WebGPU initialized - Adapter: ${this.adapter.toString()}`));

      return {
        device: this.device,
        adapter: this.adapter,
        capabilities: this.capabilities,
        limits: this.device.limits,
        features: this.device.features,
      };
    } catch (error) {
      errorHandler.error('WebGPU initialization failed', error as Error);
      throw error;
    }
  }

  private extractCapabilities(): WebGPUCapabilities {
    if (!this.device || !this.adapter) {
      throw new Error('Device not initialized');
    }

    const limits = this.device.limits;
    const features = this.device.features;

    return {
      maxBufferSize: limits.maxBufferSize,
      maxTextureSize: limits.maxTextureDimension2D,
      maxComputeWorkgroupsPerDimension: limits.maxComputeWorkgroupsPerDimension,
      maxComputeWorkgroupSizeX: limits.maxComputeWorkgroupSizeX,
      maxComputeWorkgroupSizeY: limits.maxComputeWorkgroupSizeY,
      maxComputeWorkgroupSizeZ: limits.maxComputeWorkgroupSizeZ,
      timestampQuery: features.has('timestamp-query'),
      textureCompressionBC: features.has('texture-compression-bc'),
      textureCompressionETC2: features.has('texture-compression-etc2'),
      textureCompressionASTC: features.has('texture-compression-astc'),
      shaderF16: features.has('shader-f16'),
      depthClipControl: features.has('depth-clip-control'),
      depth32FloatStencil8: features.has('depth32float-stencil8'),
      indirectFirstInstance: features.has('indirect-first-instance'),
    };
  }

  /**
   * Get current device
   */
  getDevice(): GPUDevice | null {
    return this.device;
  }

  /**
   * Get current adapter
   */
  getAdapter(): GPUAdapter | null {
    return this.adapter;
  }

  /**
   * Get capabilities
   */
  getCapabilities(): WebGPUCapabilities | null {
    return this.capabilities;
  }

  /**
   * Create compute pipeline
   */
  createComputePipeline(
    shaderCode: string,
    bindGroupLayouts?: GPUBindGroupLayout[]
  ): GPUComputePipeline {
    if (!this.device) {
      throw new Error('WebGPU device not initialized');
    }

    const shaderModule = this.device.createShaderModule({
      label: 'Compute shader',
      code: shaderCode,
    });

    const pipelineLayout = bindGroupLayouts
      ? this.device.createPipelineLayout({
          bindGroupLayouts,
        })
      : 'auto';

    return this.device.createComputePipeline({
      label: 'Compute pipeline',
      layout: pipelineLayout,
      compute: {
        module: shaderModule,
        entryPoint: 'main',
      },
    });
  }

  /**
   * Create render pipeline
   */
  createRenderPipeline(
    vertexShader: string,
    fragmentShader: string,
    options: {
      vertexBuffers?: GPUVertexBufferLayout[];
      bindGroupLayouts?: GPUBindGroupLayout[];
      primitive?: GPUPrimitiveState;
      depthStencil?: GPUDepthStencilState;
      multisample?: GPUMultisampleState;
      targets: GPUColorTargetState[];
    }
  ): GPURenderPipeline {
    if (!this.device) {
      throw new Error('WebGPU device not initialized');
    }

    const vertexModule = this.device.createShaderModule({
      label: 'Vertex shader',
      code: vertexShader,
    });

    const fragmentModule = this.device.createShaderModule({
      label: 'Fragment shader',
      code: fragmentShader,
    });

    const pipelineLayout = options.bindGroupLayouts
      ? this.device.createPipelineLayout({
          bindGroupLayouts: options.bindGroupLayouts,
        })
      : 'auto';

    return this.device.createRenderPipeline({
      label: 'Render pipeline',
      layout: pipelineLayout,
      vertex: {
        module: vertexModule,
        entryPoint: 'main',
        buffers: options.vertexBuffers || [],
      },
      fragment: {
        module: fragmentModule,
        entryPoint: 'main',
        targets: options.targets,
      },
      primitive: options.primitive || {
        topology: 'triangle-list',
      },
      depthStencil: options.depthStencil,
      multisample: options.multisample || {
        count: 1,
      },
    });
  }

  /**
   * Create buffer
   */
  createBuffer(
    size: number,
    usage: GPUBufferUsageFlags,
    mappedAtCreation = false
  ): GPUBuffer {
    if (!this.device) {
      throw new Error('WebGPU device not initialized');
    }

    return this.device.createBuffer({
      size,
      usage,
      mappedAtCreation,
    });
  }

  /**
   * Create texture
   */
  createTexture(descriptor: GPUTextureDescriptor): GPUTexture {
    if (!this.device) {
      throw new Error('WebGPU device not initialized');
    }

    return this.device.createTexture(descriptor);
  }

  /**
   * Write to buffer
   */
  writeBuffer(buffer: GPUBuffer, data: ArrayBuffer | ArrayBufferView, offset = 0): void {
    if (!this.device || !this.device.queue) {
      throw new Error('WebGPU device not initialized');
    }

    this.device.queue.writeBuffer(buffer, offset, data instanceof ArrayBuffer ? data : data.buffer);
  }

  /**
   * Submit command buffer
   */
  submit(commandBuffers: GPUCommandBuffer[]): void {
    if (!this.device || !this.device.queue) {
      throw new Error('WebGPU device not initialized');
    }

    this.device.queue.submit(commandBuffers);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
    this.adapter = null;
    this.capabilities = null;
    this.initPromise = null;
  }

  /**
   * Reset instance (for testing)
   */
  static resetInstance(): void {
    if (WebGPUService.instance) {
      WebGPUService.instance.cleanup();
      WebGPUService.instance = null;
    }
  }
}

// Export singleton instance
export const webgpuService = WebGPUService.getInstance();