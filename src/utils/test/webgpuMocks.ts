/**
 * Enhanced WebGPU Mock System for Testing
 * Provides realistic WebGPU behavior simulation for comprehensive test coverage
 */

export interface WebGPUMockConfig {
  adapterAvailable?: boolean;
  deviceRequestSuccess?: boolean;
  features?: string[];
  limits?: Record<string, number>;
  simulateErrors?: boolean;
  asyncDelay?: number;
}

export class WebGPUMockAdapter {
  public name: string;
  public features: Set<string>;
  public limits: Record<string, number>;
  private config: WebGPUMockConfig;

  constructor(config: WebGPUMockConfig = {}) {
    this.config = config;
    this.name = 'Mock WebGPU Adapter';
    this.features = new Set(config.features || ['texture-compression-bc']);
    this.limits = {
      maxTextureDimension1D: 8192,
      maxTextureDimension2D: 8192,
      maxTextureDimension3D: 2048,
      maxTextureArrayLayers: 256,
      maxBindGroups: 4,
      maxDynamicUniformBuffersPerPipelineLayout: 8,
      maxDynamicStorageBuffersPerPipelineLayout: 4,
      maxSampledTexturesPerShaderStage: 16,
      maxSamplersPerShaderStage: 16,
      maxStorageBuffersPerShaderStage: 8,
      maxStorageTexturesPerShaderStage: 4,
      maxUniformBuffersPerShaderStage: 12,
      maxUniformBufferBindingSize: 65536,
      maxStorageBufferBindingSize: 134217728,
      ...config.limits,
    };
  }

  async requestDevice(): Promise<WebGPUMockDevice> {
    if (this.config.asyncDelay) {
      await new Promise(resolve => setTimeout(resolve, this.config.asyncDelay));
    }

    if (!this.config.deviceRequestSuccess) {
      throw new Error('Device request failed');
    }

    return new WebGPUMockDevice(this.config);
  }
}

export class WebGPUMockDevice {
  public features: Set<string>;
  public limits: Record<string, number>;
  public queue: WebGPUMockQueue;
  public lost: Promise<never>;
  private config: WebGPUMockConfig;
  private commandEncoders: WebGPUMockCommandEncoder[] = [];
  private buffers: WebGPUMockBuffer[] = [];
  private textures: WebGPUMockTexture[] = [];

  constructor(config: WebGPUMockConfig = {}) {
    this.config = config;
    this.features = new Set(config.features || ['texture-compression-bc']);
    this.limits = {
      maxTextureDimension1D: 8192,
      maxTextureDimension2D: 8192,
      ...config.limits,
    };
    this.queue = new WebGPUMockQueue(config);
    this.lost = new Promise(() => {}); // Never resolves in tests
  }

  createShaderModule(descriptor: any): WebGPUMockShaderModule {
    return new WebGPUMockShaderModule(descriptor, this.config);
  }

  createBindGroup(descriptor: any): WebGPUMockBindGroup {
    return new WebGPUMockBindGroup(descriptor);
  }

  createBindGroupLayout(descriptor: any): WebGPUMockBindGroupLayout {
    return new WebGPUMockBindGroupLayout(descriptor);
  }

  createPipelineLayout(descriptor: any): WebGPUMockPipelineLayout {
    return new WebGPUMockPipelineLayout(descriptor);
  }

  createComputePipeline(descriptor: any): WebGPUMockComputePipeline {
    return new WebGPUMockComputePipeline(descriptor);
  }

  createRenderPipeline(descriptor: any): WebGPUMockRenderPipeline {
    return new WebGPUMockRenderPipeline(descriptor);
  }

  createCommandEncoder(): WebGPUMockCommandEncoder {
    const encoder = new WebGPUMockCommandEncoder(this.config);
    this.commandEncoders.push(encoder);
    return encoder;
  }

  createBuffer(descriptor: any): WebGPUMockBuffer {
    const buffer = new WebGPUMockBuffer(descriptor, this.config);
    this.buffers.push(buffer);
    return buffer;
  }

  createTexture(descriptor: any): WebGPUMockTexture {
    const texture = new WebGPUMockTexture(descriptor);
    this.textures.push(texture);
    return texture;
  }

  destroy(): void {
    this.commandEncoders.forEach(encoder => encoder.destroy());
    this.buffers.forEach(buffer => buffer.destroy());
    this.textures.forEach(texture => texture.destroy());
  }

  // Mock performance monitoring
  getMemoryUsage(): { heap: number; gpu: number } {
    return {
      heap: this.buffers.length * 1024 * 1024, // Mock heap usage
      gpu: this.textures.length * 512 * 512 * 4, // Mock GPU memory
    };
  }
}

export class WebGPUMockQueue {
  private config: WebGPUMockConfig;

  constructor(config: WebGPUMockConfig) {
    this.config = config;
  }

  submit(commandBuffers: any[]): void {
    if (this.config.simulateErrors && Math.random() < 0.1) {
      throw new Error('Queue submission failed');
    }
  }

  writeBuffer(buffer: any, offset: number, data: ArrayBuffer): void {
    // Mock buffer write
  }

  writeTexture(destination: any, data: ArrayBuffer, layout: any, size: any): void {
    // Mock texture write
  }
}

export class WebGPUMockShaderModule {
  private descriptor: any;
  private config: WebGPUMockConfig;

  constructor(descriptor: any, config: WebGPUMockConfig) {
    this.descriptor = descriptor;
    this.config = config;
  }

  async compilationInfo(): Promise<{ messages: any[] }> {
    if (this.config.simulateErrors && Math.random() < 0.05) {
      return {
        messages: [{
          type: 'error',
          message: 'Mock compilation error'
        }]
      };
    }
    return { messages: [] };
  }
}

export class WebGPUMockBindGroup {
  constructor(private descriptor: any) {}
}

export class WebGPUMockBindGroupLayout {
  constructor(private descriptor: any) {}
}

export class WebGPUMockPipelineLayout {
  constructor(private descriptor: any) {}
}

export class WebGPUMockComputePipeline {
  constructor(private descriptor: any) {}

  getBindGroupLayout(index: number): WebGPUMockBindGroupLayout {
    return new WebGPUMockBindGroupLayout({});
  }
}

export class WebGPUMockRenderPipeline {
  constructor(private descriptor: any) {}

  getBindGroupLayout(index: number): WebGPUMockBindGroupLayout {
    return new WebGPUMockBindGroupLayout({});
  }
}

export class WebGPUMockCommandEncoder {
  private config: WebGPUMockConfig;
  private passes: any[] = [];

  constructor(config: WebGPUMockConfig) {
    this.config = config;
  }

  beginComputePass(): WebGPUMockComputePass {
    const pass = new WebGPUMockComputePass();
    this.passes.push(pass);
    return pass;
  }

  beginRenderPass(descriptor: any): WebGPUMockRenderPass {
    const pass = new WebGPUMockRenderPass();
    this.passes.push(pass);
    return pass;
  }

  finish(): WebGPUMockCommandBuffer {
    return new WebGPUMockCommandBuffer();
  }

  destroy(): void {
    this.passes.forEach(pass => pass.end());
  }
}

export class WebGPUMockComputePass {
  setPipeline(pipeline: any): void {}
  setBindGroup(index: number, bindGroup: any): void {}
  dispatchWorkgroups(x: number, y?: number, z?: number): void {}
  end(): void {}
}

export class WebGPUMockRenderPass {
  setPipeline(pipeline: any): void {}
  setBindGroup(index: number, bindGroup: any): void {}
  setVertexBuffer(slot: number, buffer: any): void {}
  setIndexBuffer(buffer: any, format: string): void {}
  draw(vertexCount: number, instanceCount?: number): void {}
  drawIndexed(indexCount: number, instanceCount?: number): void {}
  end(): void {}
}

export class WebGPUMockCommandBuffer {
  // Command buffer implementation
}

export class WebGPUMockBuffer {
  public size: number;
  public usage: number;
  public mapState: string = 'unmapped';
  private config: WebGPUMockConfig;
  private destroyed: boolean = false;

  constructor(descriptor: any, config: WebGPUMockConfig) {
    this.size = descriptor.size || 1024;
    this.usage = descriptor.usage || 0;
    this.config = config;
  }

  async mapAsync(mode: number, offset?: number, size?: number): Promise<void> {
    if (this.destroyed) {
      throw new Error('Buffer is destroyed');
    }
    
    if (this.config.asyncDelay) {
      await new Promise(resolve => setTimeout(resolve, this.config.asyncDelay));
    }

    if (this.config.simulateErrors && Math.random() < 0.05) {
      throw new Error('Buffer mapping failed');
    }

    this.mapState = 'mapped';
  }

  getMappedRange(offset?: number, size?: number): ArrayBuffer {
    if (this.mapState !== 'mapped') {
      throw new Error('Buffer is not mapped');
    }
    return new ArrayBuffer(size || this.size);
  }

  unmap(): void {
    this.mapState = 'unmapped';
  }

  destroy(): void {
    this.destroyed = true;
    this.mapState = 'destroyed';
  }
}

export class WebGPUMockTexture {
  private descriptor: any;
  private destroyed: boolean = false;

  constructor(descriptor: any) {
    this.descriptor = descriptor;
  }

  createView(descriptor?: any): WebGPUMockTextureView {
    if (this.destroyed) {
      throw new Error('Texture is destroyed');
    }
    return new WebGPUMockTextureView();
  }

  destroy(): void {
    this.destroyed = true;
  }
}

export class WebGPUMockTextureView {
  // Texture view implementation
}

/**
 * Setup comprehensive WebGPU mocks for testing
 */
export function setupWebGPUMocks(config: WebGPUMockConfig = {}): void {
  // Create mock adapter
  const mockAdapter = config.adapterAvailable !== false 
    ? new WebGPUMockAdapter(config)
    : null;

  // Mock WebGPU constants
  (global as any).GPUBufferUsage = {
    MAP_READ: 0x0001,
    MAP_WRITE: 0x0002,
    COPY_SRC: 0x0004,
    COPY_DST: 0x0008,
    INDEX: 0x0010,
    VERTEX: 0x0020,
    UNIFORM: 0x0040,
    STORAGE: 0x0080,
    INDIRECT: 0x0100,
    QUERY_RESOLVE: 0x0200,
  };

  (global as any).GPUTextureUsage = {
    COPY_SRC: 0x01,
    COPY_DST: 0x02,
    TEXTURE_BINDING: 0x04,
    STORAGE_BINDING: 0x08,
    RENDER_ATTACHMENT: 0x10,
  };

  (global as any).GPUShaderStage = {
    VERTEX: 0x1,
    FRAGMENT: 0x2,
    COMPUTE: 0x4,
  };

  // Mock navigator.gpu
  Object.defineProperty(navigator, 'gpu', {
    value: {
      requestAdapter: jest.fn(() => Promise.resolve(mockAdapter)),
      getPreferredCanvasFormat: jest.fn(() => 'bgra8unorm'),
    },
    writable: true,
    configurable: true,
  });
}

/**
 * Reset WebGPU mocks to initial state
 */
export function resetWebGPUMocks(): void {
  if (navigator.gpu) {
    (navigator.gpu.requestAdapter as jest.Mock).mockClear();
    (navigator.gpu.getPreferredCanvasFormat as jest.Mock).mockClear();
  }
}

/**
 * Create WebGPU mock scenario for specific test cases
 */
export function createWebGPUScenario(scenario: string): WebGPUMockConfig {
  switch (scenario) {
    case 'no-adapter':
      return { adapterAvailable: false };
    
    case 'device-fail':
      return { adapterAvailable: true, deviceRequestSuccess: false };
    
    case 'limited-features':
      return { 
        adapterAvailable: true,
        deviceRequestSuccess: true,
        features: ['depth-clamping'],
        limits: { maxTextureDimension2D: 4096 }
      };
    
    case 'slow-response':
      return {
        adapterAvailable: true,
        deviceRequestSuccess: true,
        asyncDelay: 100
      };
    
    case 'error-prone':
      return {
        adapterAvailable: true,
        deviceRequestSuccess: true,
        simulateErrors: true
      };
    
    default:
      return {
        adapterAvailable: true,
        deviceRequestSuccess: true
      };
  }
}