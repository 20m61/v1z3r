/**
 * WebGPU Service Tests
 */

import { webgpuService, WebGPUService } from '../webgpuService';

// Mock WebGPU API
const mockGPU = {
  requestAdapter: jest.fn(),
  getPreferredCanvasFormat: jest.fn(() => 'bgra8unorm'),
};

const mockAdapter = {
  requestDevice: jest.fn(),
  limits: {
    maxBufferSize: 1024 * 1024 * 1024,
    maxTextureDimension2D: 8192,
    maxComputeWorkgroupsPerDimension: 65535,
    maxComputeWorkgroupSizeX: 256,
    maxComputeWorkgroupSizeY: 256,
    maxComputeWorkgroupSizeZ: 64,
    maxBindGroups: 8,
  },
  features: new Set(['timestamp-query', 'texture-compression-bc']),
  info: {
    vendor: 'Mock GPU',
    architecture: 'Mock Architecture',
    device: 'Mock Device',
    description: 'Mock GPU for testing',
  },
  requestAdapterInfo: jest.fn(async () => mockAdapter.info),
};

const mockDevice = {
  label: 'Mock Device',
  limits: mockAdapter.limits,
  features: mockAdapter.features,
  createShaderModule: jest.fn(),
  createComputePipeline: jest.fn(),
  createRenderPipeline: jest.fn(),
  createBuffer: jest.fn(),
  createTexture: jest.fn(),
  createBindGroupLayout: jest.fn(),
  createPipelineLayout: jest.fn(),
  createBindGroup: jest.fn(),
  queue: {
    writeBuffer: jest.fn(),
    submit: jest.fn(),
  },
  lost: Promise.resolve({ reason: 'destroyed', message: 'Device destroyed' }),
  destroy: jest.fn(),
};

// Setup global mocks
beforeEach(() => {
  jest.clearAllMocks();
  WebGPUService.resetInstance();
  
  // Mock navigator.gpu
  Object.defineProperty(navigator, 'gpu', {
    value: mockGPU,
    configurable: true,
  });
  
  mockGPU.requestAdapter.mockResolvedValue(mockAdapter);
  mockAdapter.requestDevice.mockResolvedValue(mockDevice);
});

describe('WebGPUService', () => {
  describe('isSupported', () => {
    it('should return true when WebGPU is available', () => {
      expect(WebGPUService.isSupported()).toBe(true);
    });
    
    it('should return false when WebGPU is not available', () => {
      Object.defineProperty(navigator, 'gpu', {
        value: undefined,
        configurable: true,
      });
      
      expect(WebGPUService.isSupported()).toBe(false);
    });
  });
  
  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = WebGPUService.getInstance();
      const instance2 = WebGPUService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
  
  describe('initialize', () => {
    it('should successfully initialize WebGPU', async () => {
      const result = await webgpuService.initialize();
      
      expect(result.device).toBe(mockDevice);
      expect(result.adapter).toBe(mockAdapter);
      expect(result.capabilities).toBeDefined();
      expect(result.capabilities.timestampQuery).toBe(true);
      expect(result.capabilities.textureCompressionBC).toBe(true);
      
      expect(mockGPU.requestAdapter).toHaveBeenCalledWith({
        powerPreference: 'high-performance',
      });
    });
    
    it('should handle missing WebGPU support', async () => {
      Object.defineProperty(navigator, 'gpu', {
        value: undefined,
        configurable: true,
      });
      
      await expect(webgpuService.initialize()).rejects.toThrow(
        'WebGPU is not supported in this browser'
      );
    });
    
    it('should handle adapter request failure', async () => {
      // Reset instance to ensure fresh state
      WebGPUService.resetInstance();
      const freshService = WebGPUService.getInstance();
      
      mockGPU.requestAdapter.mockResolvedValue(null);
      
      await expect(freshService.initialize()).rejects.toThrow(
        'Failed to get WebGPU adapter'
      );
    });
    
    it('should handle device request failure', async () => {
      // Reset instance to ensure fresh state
      WebGPUService.resetInstance();
      const freshService = WebGPUService.getInstance();
      
      mockAdapter.requestDevice.mockResolvedValue(null);
      
      await expect(freshService.initialize()).rejects.toThrow(
        'Failed to get WebGPU device'
      );
    });
    
    it('should return cached result on subsequent calls', async () => {
      const result1 = await webgpuService.initialize();
      const result2 = await webgpuService.initialize();
      
      expect(result1).toBe(result2);
      expect(mockGPU.requestAdapter).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('capabilities extraction', () => {
    it('should extract correct capabilities', async () => {
      const result = await webgpuService.initialize();
      const capabilities = result.capabilities;
      
      expect(capabilities.maxBufferSize).toBe(1024 * 1024 * 1024);
      expect(capabilities.maxTextureSize).toBe(8192);
      expect(capabilities.timestampQuery).toBe(true);
      expect(capabilities.textureCompressionBC).toBe(true);
      expect(capabilities.shaderF16).toBe(false);
    });
  });
  
  describe('createComputePipeline', () => {
    const mockPipeline = { label: 'Mock Pipeline' };
    const shaderCode = 'mock shader code';
    
    beforeEach(async () => {
      // Reset mocks and ensure fresh state
      mockGPU.requestAdapter.mockResolvedValue(mockAdapter);
      mockAdapter.requestDevice.mockResolvedValue(mockDevice);
      
      await webgpuService.initialize();
      mockDevice.createShaderModule.mockReturnValue({ label: 'Mock Shader' });
      mockDevice.createComputePipeline.mockReturnValue(mockPipeline);
    });
    
    it('should create compute pipeline', () => {
      const pipeline = webgpuService.createComputePipeline(shaderCode);
      
      expect(pipeline).toBe(mockPipeline);
      expect(mockDevice.createShaderModule).toHaveBeenCalledWith({
        label: 'Compute shader',
        code: shaderCode,
      });
      expect(mockDevice.createComputePipeline).toHaveBeenCalled();
    });
    
    it('should use custom bind group layouts', () => {
      const mockLayout = { label: 'Mock Layout' };
      const mockPipelineLayout = { label: 'Mock Pipeline Layout' };
      
      mockDevice.createPipelineLayout.mockReturnValue(mockPipelineLayout);
      
      webgpuService.createComputePipeline(shaderCode, [mockLayout as any]);
      
      expect(mockDevice.createPipelineLayout).toHaveBeenCalledWith({
        bindGroupLayouts: [mockLayout],
      });
    });
    
    it('should throw when device not initialized', () => {
      WebGPUService.resetInstance();
      
      expect(() => webgpuService.createComputePipeline(shaderCode))
        .toThrow('WebGPU device not initialized');
    });
  });
  
  describe('createBuffer', () => {
    const mockBuffer = { label: 'Mock Buffer' };
    
    beforeEach(async () => {
      // Reset mocks and ensure fresh state
      mockGPU.requestAdapter.mockResolvedValue(mockAdapter);
      mockAdapter.requestDevice.mockResolvedValue(mockDevice);
      
      await webgpuService.initialize();
      mockDevice.createBuffer.mockReturnValue(mockBuffer);
    });
    
    it('should create buffer with correct parameters', () => {
      const size = 1024;
      const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
      
      const buffer = webgpuService.createBuffer(size, usage, true);
      
      expect(buffer).toBe(mockBuffer);
      expect(mockDevice.createBuffer).toHaveBeenCalledWith({
        size,
        usage,
        mappedAtCreation: true,
      });
    });
  });
  
  describe('writeBuffer', () => {
    const mockBuffer = { label: 'Mock Buffer' };
    const data = new Float32Array([1, 2, 3, 4]);
    
    beforeEach(async () => {
      // Reset mocks and ensure fresh state
      mockGPU.requestAdapter.mockResolvedValue(mockAdapter);
      mockAdapter.requestDevice.mockResolvedValue(mockDevice);
      
      await webgpuService.initialize();
    });
    
    it('should write data to buffer', () => {
      webgpuService.writeBuffer(mockBuffer as any, data);
      
      expect(mockDevice.queue.writeBuffer).toHaveBeenCalledWith(
        mockBuffer,
        0,
        data
      );
    });
    
    it('should write with offset', () => {
      const offset = 16;
      webgpuService.writeBuffer(mockBuffer as any, data, offset);
      
      expect(mockDevice.queue.writeBuffer).toHaveBeenCalledWith(
        mockBuffer,
        offset,
        data
      );
    });
  });
  
  describe('submit', () => {
    const mockCommandBuffer = { label: 'Mock Command Buffer' };
    
    beforeEach(async () => {
      // Reset mocks and ensure fresh state
      mockGPU.requestAdapter.mockResolvedValue(mockAdapter);
      mockAdapter.requestDevice.mockResolvedValue(mockDevice);
      
      await webgpuService.initialize();
    });
    
    it('should submit command buffers', () => {
      webgpuService.submit([mockCommandBuffer as any]);
      
      expect(mockDevice.queue.submit).toHaveBeenCalledWith([mockCommandBuffer]);
    });
  });
  
  describe('cleanup', () => {
    it('should clean up resources', async () => {
      // Reset mocks and ensure fresh state
      mockGPU.requestAdapter.mockResolvedValue(mockAdapter);
      mockAdapter.requestDevice.mockResolvedValue(mockDevice);
      
      await webgpuService.initialize();
      
      webgpuService.cleanup();
      
      expect(mockDevice.destroy).toHaveBeenCalled();
      expect(webgpuService.getDevice()).toBeNull();
      expect(webgpuService.getAdapter()).toBeNull();
    });
  });
});