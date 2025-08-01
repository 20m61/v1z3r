/**
 * Comprehensive WebGPU and WebGL mock for testing
 * Provides complete GPU API and WebGL context mock implementation
 */

export interface MockGPUAdapter {
  name: string;
  features: Set<string>;
  limits: Record<string, number>;
  requestDevice: jest.Mock;
}

export interface MockGPUDevice {
  features: Set<string>;
  limits: Record<string, number>;
  queue: MockGPUQueue;
  createShaderModule: jest.Mock;
  createBindGroup: jest.Mock;
  createBindGroupLayout: jest.Mock;
  createPipelineLayout: jest.Mock;
  createComputePipeline: jest.Mock;
  createRenderPipeline: jest.Mock;
  createCommandEncoder: jest.Mock;
  createBuffer: jest.Mock;
  createTexture: jest.Mock;
  destroy: jest.Mock;
  lost: Promise<{ reason: string; message: string }>;
}

export interface MockGPUQueue {
  submit: jest.Mock;
  writeBuffer: jest.Mock;
  writeTexture: jest.Mock;
}

export interface MockWebGLRenderingContext {
  canvas: HTMLCanvasElement;
  drawingBufferWidth: number;
  drawingBufferHeight: number;
  getExtension: jest.Mock;
  getParameter: jest.Mock;
  createShader: jest.Mock;
  shaderSource: jest.Mock;
  compileShader: jest.Mock;
  getShaderParameter: jest.Mock;
  createProgram: jest.Mock;
  attachShader: jest.Mock;
  linkProgram: jest.Mock;
  getProgramParameter: jest.Mock;
  useProgram: jest.Mock;
  createBuffer: jest.Mock;
  bindBuffer: jest.Mock;
  bufferData: jest.Mock;
  createTexture: jest.Mock;
  bindTexture: jest.Mock;
  texImage2D: jest.Mock;
  texParameteri: jest.Mock;
  viewport: jest.Mock;
  clear: jest.Mock;
  clearColor: jest.Mock;
  enable: jest.Mock;
  disable: jest.Mock;
  blendFunc: jest.Mock;
  drawArrays: jest.Mock;
  drawElements: jest.Mock;
  getError: jest.Mock;
}

// WebGPU Mock Implementation
export const createGPUAdapterMock = (): MockGPUAdapter => ({
  name: 'Mock GPU Adapter',
  features: new Set(['texture-compression-bc', 'timestamp-query']),
  limits: {
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
    maxVertexBuffers: 8,
    maxVertexAttributes: 16,
    maxVertexBufferArrayStride: 2048
  },
  requestDevice: jest.fn().mockResolvedValue(createGPUDeviceMock())
});

export const createGPUDeviceMock = (): MockGPUDevice => {
  const device: MockGPUDevice = {
    features: new Set(['texture-compression-bc']),
    limits: {
      maxTextureDimension1D: 8192,
      maxTextureDimension2D: 8192,
      maxTextureDimension3D: 2048
    },
    queue: {
      submit: jest.fn(),
      writeBuffer: jest.fn(),
      writeTexture: jest.fn()
    },
    createShaderModule: jest.fn().mockReturnValue({
      compilationInfo: jest.fn().mockResolvedValue({ messages: [] })
    }),
    createBindGroup: jest.fn().mockReturnValue({}),
    createBindGroupLayout: jest.fn().mockReturnValue({}),
    createPipelineLayout: jest.fn().mockReturnValue({}),
    createComputePipeline: jest.fn().mockReturnValue({
      getBindGroupLayout: jest.fn().mockReturnValue({})
    }),
    createRenderPipeline: jest.fn().mockReturnValue({
      getBindGroupLayout: jest.fn().mockReturnValue({})
    }),
    createCommandEncoder: jest.fn().mockReturnValue({
      beginComputePass: jest.fn().mockReturnValue({
        setPipeline: jest.fn(),
        setBindGroup: jest.fn(),
        dispatchWorkgroups: jest.fn(),
        end: jest.fn()
      }),
      beginRenderPass: jest.fn().mockReturnValue({
        setPipeline: jest.fn(),
        setBindGroup: jest.fn(),
        setVertexBuffer: jest.fn(),
        setIndexBuffer: jest.fn(),
        draw: jest.fn(),
        drawIndexed: jest.fn(),
        end: jest.fn()
      }),
      finish: jest.fn().mockReturnValue({})
    }),
    createBuffer: jest.fn().mockReturnValue({
      size: 1024,
      usage: 0,
      mapState: 'unmapped',
      mapAsync: jest.fn().mockResolvedValue(undefined),
      getMappedRange: jest.fn().mockReturnValue(new ArrayBuffer(1024)),
      unmap: jest.fn(),
      destroy: jest.fn()
    }),
    createTexture: jest.fn().mockReturnValue({
      createView: jest.fn().mockReturnValue({}),
      destroy: jest.fn()
    }),
    destroy: jest.fn(),
    lost: new Promise(() => {}) // Never resolves in tests
  };
  
  return device;
};

// WebGL Mock Implementation
export const createWebGLContextMock = (): MockWebGLRenderingContext => {
  const gl: MockWebGLRenderingContext = {
    canvas: document.createElement('canvas'),
    drawingBufferWidth: 800,
    drawingBufferHeight: 600,
    getExtension: jest.fn((name: string) => {
      if (name === 'WEBGL_debug_renderer_info') {
        return { UNMASKED_VENDOR_WEBGL: 0x9245, UNMASKED_RENDERER_WEBGL: 0x9246 };
      }
      return {};
    }),
    getParameter: jest.fn((pname: number) => {
      const params: Record<number, any> = {
        0x9245: 'Mock GPU Vendor', // UNMASKED_VENDOR_WEBGL
        0x9246: 'Mock GPU Renderer', // UNMASKED_RENDERER_WEBGL
        0x0D33: 4096, // MAX_TEXTURE_SIZE
        0x851C: 16, // MAX_VERTEX_TEXTURE_IMAGE_UNITS
        0x8B4D: 16, // MAX_FRAGMENT_UNIFORM_VECTORS
        0x8869: 16, // MAX_VERTEX_ATTRIBS
        0x8DFB: 32 // MAX_SAMPLES
      };
      return params[pname] || 0;
    }),
    createShader: jest.fn().mockReturnValue({}),
    shaderSource: jest.fn(),
    compileShader: jest.fn(),
    getShaderParameter: jest.fn().mockReturnValue(true),
    createProgram: jest.fn().mockReturnValue({}),
    attachShader: jest.fn(),
    linkProgram: jest.fn(),
    getProgramParameter: jest.fn().mockReturnValue(true),
    useProgram: jest.fn(),
    createBuffer: jest.fn().mockReturnValue({}),
    bindBuffer: jest.fn(),
    bufferData: jest.fn(),
    createTexture: jest.fn().mockReturnValue({}),
    bindTexture: jest.fn(),
    texImage2D: jest.fn(),
    texParameteri: jest.fn(),
    viewport: jest.fn(),
    clear: jest.fn(),
    clearColor: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn(),
    blendFunc: jest.fn(),
    drawArrays: jest.fn(),
    drawElements: jest.fn(),
    getError: jest.fn().mockReturnValue(0) // NO_ERROR
  };
  
  return gl;
};

// Three.js WebGLRenderer capabilities mock
export const createWebGLCapabilitiesMock = () => ({
  isWebGL2: true,
  drawBuffers: true,
  precision: 'highp',
  logarithmicDepthBuffer: false,
  maxTextures: 16,
  maxVertexTextures: 16,
  maxTextureSize: 4096,
  maxCubemapSize: 4096,
  maxAttributes: 16,
  maxVertexUniforms: 1024,
  maxVaryings: 32,
  maxFragmentUniforms: 1024,
  vertexTextures: true,
  floatFragmentTextures: true,
  floatVertexTextures: true
});

// Setup global WebGPU and WebGL mocks
export const setupWebGPUMocks = () => {
  // Mock WebGPU API
  // @ts-ignore
  global.navigator.gpu = {
    requestAdapter: jest.fn().mockResolvedValue(createGPUAdapterMock()),
    getPreferredCanvasFormat: jest.fn().mockReturnValue('bgra8unorm')
  };
  
  // Mock OffscreenCanvas
  // @ts-ignore
  global.OffscreenCanvas = jest.fn().mockImplementation((width: number, height: number) => ({
    width,
    height,
    getContext: jest.fn((contextType: string) => {
      if (contextType === 'webgl' || contextType === 'webgl2') {
        return createWebGLContextMock();
      }
      if (contextType === 'webgpu') {
        return {
          configure: jest.fn(),
          unconfigure: jest.fn(),
          getCurrentTexture: jest.fn().mockReturnValue({
            createView: jest.fn().mockReturnValue({})
          })
        };
      }
      return null;
    }),
    transferToImageBitmap: jest.fn()
  }));
  
  // Mock WebGL2RenderingContext
  // @ts-ignore
  global.WebGL2RenderingContext = jest.fn();
  // @ts-ignore
  global.WebGLRenderingContext = jest.fn();
};

// WebGPU Detector mock
export const createWebGPUDetectorMock = (shouldSupport: boolean = true) => ({
  detect: jest.fn().mockImplementation(() => {
    if (shouldSupport) {
      return Promise.resolve({
        adapter: createGPUAdapterMock(),
        device: createGPUDeviceMock()
      });
    } else {
      return Promise.reject(new Error('WebGPU not supported'));
    }
  })
});

// Cleanup function
export const cleanupWebGPUMocks = () => {
  // @ts-ignore
  if (global.navigator && global.navigator.gpu) {
    delete global.navigator.gpu;
  }
  // @ts-ignore
  if (global.OffscreenCanvas) {
    delete global.OffscreenCanvas;
  }
  // @ts-ignore
  if (global.WebGL2RenderingContext) {
    delete global.WebGL2RenderingContext;
  }
  // @ts-ignore
  if (global.WebGLRenderingContext) {
    delete global.WebGLRenderingContext;
  }
};