import {
  AudioBufferPool,
  WebGLResourceManager,
  MemoryManager,
  getReusableAudioBuffer,
  returnAudioBuffer,
  forceMemoryCleanup,
  getMemoryStats,
} from '../memoryManager';

// Mock error handler
jest.mock('../errorHandler', () => ({
  errorHandler: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('AudioBufferPool', () => {
  let pool: AudioBufferPool;

  beforeEach(() => {
    pool = new AudioBufferPool();
  });

  describe('getBuffer', () => {
    it('creates new buffer when pool is empty', () => {
      const buffer = pool.getBuffer(256);
      expect(buffer).toBeInstanceOf(Uint8Array);
      expect(buffer.length).toBe(256);
    });

    it('reuses buffer from pool when available', () => {
      const buffer1 = pool.getBuffer(256);
      pool.returnBuffer(buffer1);
      
      const buffer2 = pool.getBuffer(256);
      expect(buffer2).toBe(buffer1);
      expect(buffer2.every(val => val === 0)).toBe(true); // Should be cleared
    });

    it('throws error when memory limit exceeded', () => {
      // This test assumes default memory limit of 50MB
      expect(() => {
        pool.getBuffer(60 * 1024 * 1024); // 60MB
      }).toThrow('Memory limit exceeded');
    });
  });

  describe('returnBuffer', () => {
    it('stores buffer in pool for reuse', () => {
      const buffer = pool.getBuffer(256);
      pool.returnBuffer(buffer);
      
      const stats = pool.getStats();
      expect(stats.bufferCount).toBeGreaterThan(0);
    });

    it('does not store buffer when pool is full', () => {
      const buffers = [];
      
      // Fill the pool beyond maxPoolSize
      for (let i = 0; i < 15; i++) {
        const buffer = pool.getBuffer(256);
        buffers.push(buffer);
        pool.returnBuffer(buffer);
      }
      
      const stats = pool.getStats();
      expect(stats.bufferCount).toBeLessThanOrEqual(10); // maxPoolSize
    });
  });

  describe('cleanup', () => {
    it('removes buffers when memory usage is high', () => {
      // Create many buffers to trigger cleanup
      const buffers = [];
      for (let i = 0; i < 10; i++) {
        const buffer = pool.getBuffer(1024 * 1024); // 1MB each
        buffers.push(buffer);
        pool.returnBuffer(buffer);
      }
      
      const statsBefore = pool.getStats();
      pool.cleanup();
      const statsAfter = pool.getStats();
      
      expect(statsAfter.bufferCount).toBeLessThanOrEqual(statsBefore.bufferCount);
    });
  });

  describe('forceCleanup', () => {
    it('clears all pools', () => {
      const buffer = pool.getBuffer(256);
      pool.returnBuffer(buffer);
      
      pool.forceCleanup();
      
      const stats = pool.getStats();
      expect(stats.bufferCount).toBe(0);
      expect(stats.poolCount).toBe(0);
    });
  });

  describe('getStats', () => {
    it('returns correct statistics', () => {
      const buffer1 = pool.getBuffer(256);
      const buffer2 = pool.getBuffer(512);
      pool.returnBuffer(buffer1);
      pool.returnBuffer(buffer2);
      
      const stats = pool.getStats();
      expect(stats.poolCount).toBe(2); // Two different sizes
      expect(stats.bufferCount).toBe(2);
      expect(stats.totalAllocated).toBeGreaterThan(0);
    });
  });
});

describe('WebGLResourceManager', () => {
  let manager: WebGLResourceManager;
  let mockGL: any;

  beforeEach(() => {
    manager = new WebGLResourceManager();
    
    // Mock WebGL context
    mockGL = {
      isContextLost: jest.fn(() => false),
      isBuffer: jest.fn(() => true),
      isTexture: jest.fn(() => true),
      isProgram: jest.fn(() => true),
      isFramebuffer: jest.fn(() => true),
      deleteBuffer: jest.fn(),
      deleteTexture: jest.fn(),
      deleteProgram: jest.fn(),
      deleteFramebuffer: jest.fn(),
    };
  });

  describe('resource registration', () => {
    it('registers WebGL context', () => {
      manager.registerContext(mockGL);
      const stats = manager.getStats();
      expect(stats.contexts).toBe(1);
    });

    it('registers buffers, textures, programs, and framebuffers', () => {
      const buffer = {} as WebGLBuffer;
      const texture = {} as WebGLTexture;
      const program = {} as WebGLProgram;
      const framebuffer = {} as WebGLFramebuffer;
      
      manager.registerBuffer(buffer);
      manager.registerTexture(texture);
      manager.registerProgram(program);
      manager.registerFramebuffer(framebuffer);
      
      const stats = manager.getStats();
      expect(stats.buffers).toBe(1);
      expect(stats.textures).toBe(1);
      expect(stats.programs).toBe(1);
      expect(stats.framebuffers).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('deletes all registered resources', () => {
      manager.registerContext(mockGL);
      
      const buffer = {} as WebGLBuffer;
      const texture = {} as WebGLTexture;
      
      manager.registerBuffer(buffer);
      manager.registerTexture(texture);
      
      manager.cleanup();
      
      expect(mockGL.deleteBuffer).toHaveBeenCalledWith(buffer);
      expect(mockGL.deleteTexture).toHaveBeenCalledWith(texture);
    });

    it('skips lost contexts', () => {
      mockGL.isContextLost = jest.fn(() => true);
      manager.registerContext(mockGL);
      
      manager.cleanup();
      
      expect(mockGL.deleteBuffer).not.toHaveBeenCalled();
    });
  });
});

describe('MemoryManager', () => {
  let manager: MemoryManager;

  beforeEach(() => {
    manager = new MemoryManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('audio buffer management', () => {
    it('provides reusable audio buffers', () => {
      const buffer1 = manager.getAudioBuffer(256);
      expect(buffer1).toBeInstanceOf(Uint8Array);
      expect(buffer1.length).toBe(256);
      
      manager.returnAudioBuffer(buffer1);
      
      const buffer2 = manager.getAudioBuffer(256);
      expect(buffer2).toBe(buffer1);
    });
  });

  describe('WebGL resource management', () => {
    it('registers WebGL resources', () => {
      const mockGL = {
        isContextLost: () => false,
        isBuffer: () => true,
        isTexture: () => true,
        isProgram: () => true,
        isFramebuffer: () => true,
        deleteBuffer: jest.fn(),
        deleteTexture: jest.fn(),
        deleteProgram: jest.fn(),
        deleteFramebuffer: jest.fn(),
      } as any;
      const buffer = {} as WebGLBuffer;
      
      expect(() => {
        manager.registerWebGLContext(mockGL);
        manager.registerWebGLBuffer(buffer);
      }).not.toThrow();
    });
  });

  describe('memory monitoring', () => {
    it('getMemoryInfo returns null when memory API not available', () => {
      const memoryInfo = manager.getMemoryInfo();
      // In test environment, memory API is usually not available
      expect(memoryInfo).toBeNull();
    });

    it('isMemoryPressureHigh returns false when memory API not available', () => {
      const isHigh = manager.isMemoryPressureHigh();
      expect(isHigh).toBe(false);
    });
  });

  describe('forceCleanup', () => {
    it('triggers cleanup without errors', () => {
      expect(() => {
        manager.forceCleanup();
      }).not.toThrow();
    });
  });

  describe('getStats', () => {
    it('returns comprehensive statistics', () => {
      const stats = manager.getStats();
      
      expect(stats).toHaveProperty('memoryInfo');
      expect(stats).toHaveProperty('audioBufferPool');
      expect(stats).toHaveProperty('webglResources');
      expect(stats).toHaveProperty('isHighPressure');
    });
  });
});

describe('Utility functions', () => {
  describe('getReusableAudioBuffer', () => {
    it('returns audio buffer', () => {
      const buffer = getReusableAudioBuffer(256);
      expect(buffer).toBeInstanceOf(Uint8Array);
      expect(buffer.length).toBe(256);
    });
  });

  describe('returnAudioBuffer', () => {
    it('returns buffer without errors', () => {
      const buffer = getReusableAudioBuffer(256);
      expect(() => {
        returnAudioBuffer(buffer);
      }).not.toThrow();
    });
  });

  describe('forceMemoryCleanup', () => {
    it('triggers cleanup without errors', () => {
      expect(() => {
        forceMemoryCleanup();
      }).not.toThrow();
    });
  });

  describe('getMemoryStats', () => {
    it('returns memory statistics', () => {
      const stats = getMemoryStats();
      expect(stats).toHaveProperty('memoryInfo');
      expect(stats).toHaveProperty('audioBufferPool');
      expect(stats).toHaveProperty('webglResources');
      expect(stats).toHaveProperty('isHighPressure');
    });
  });
});

describe('Memory pressure simulation', () => {
  it('tests memory monitoring functionality', () => {
    const manager = new MemoryManager();
    
    // Test that memory monitoring doesn't crash
    const memoryInfo = manager.getMemoryInfo();
    const isHigh = manager.isMemoryPressureHigh();
    
    // These should return appropriate defaults when memory API is unavailable
    expect(typeof isHigh).toBe('boolean');
    
    manager.destroy();
  });
});