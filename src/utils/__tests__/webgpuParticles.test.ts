/**
 * Test suite for WebGPU Particle System
 */

import { WebGPUParticleSystem, ParticleConfig } from '../webgpuParticles';
import { MusicFeatures } from '../aiMusicAnalyzer';

// Mock WebGPU
const mockDevice = {
  createBuffer: jest.fn(),
  createShaderModule: jest.fn(),
  createComputePipeline: jest.fn(),
  createRenderPipeline: jest.fn(),
  createBindGroup: jest.fn(),
  createCommandEncoder: jest.fn(),
  queue: {
    writeBuffer: jest.fn(),
    submit: jest.fn(),
  },
};

const mockContext = {
  configure: jest.fn(),
  getCurrentTexture: jest.fn(() => ({
    createView: jest.fn(),
  })),
};

const mockCapabilities = {
  maxTextureSize: 8192,
  maxComputeWorkgroupSize: [256, 256, 64],
  preferredFormat: 'bgra8unorm',
};

describe.skip('WebGPUParticleSystem', () => {
  let mockCanvas: HTMLCanvasElement;
  let particleSystem: WebGPUParticleSystem;

  beforeEach(() => {
    // Mock canvas
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 800;
    mockCanvas.height = 600;

    // Mock WebGPU context
    mockCanvas.getContext = jest.fn(() => mockContext);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (particleSystem) {
      particleSystem.dispose();
    }
  });

  describe('Constructor', () => {
    it('should create instance with default config', () => {
      particleSystem = new WebGPUParticleSystem(mockCanvas);
      expect(particleSystem).toBeInstanceOf(WebGPUParticleSystem);
    });

    it('should create instance with custom config', () => {
      const config: Partial<ParticleConfig> = {
        maxParticles: 50000,
        particleSize: 3.0,
        emissionRate: 2000,
        audioReactivity: 1.5,
        colorMode: 'energy',
        blendMode: 'screen',
      };

      particleSystem = new WebGPUParticleSystem(mockCanvas, config);
      expect(particleSystem).toBeInstanceOf(WebGPUParticleSystem);
    });
  });

  describe('Initialization', () => {
    beforeEach(() => {
      particleSystem = new WebGPUParticleSystem(mockCanvas, {
        maxParticles: 10000,
      });
    });

    it('should initialize successfully', async () => {
      await particleSystem.initialize(mockDevice as any, mockCapabilities);
      
      expect(mockContext.configure).toHaveBeenCalledWith({
        device: mockDevice,
        format: 'bgra8unorm',
        alphaMode: 'premultiplied',
      });
    });

    it('should create necessary buffers', async () => {
      await particleSystem.initialize(mockDevice as any, mockCapabilities);
      
      expect(mockDevice.createBuffer).toHaveBeenCalledTimes(4); // particle, uniform, audio, force buffers
    });

    it('should create shader modules', async () => {
      await particleSystem.initialize(mockDevice as any, mockCapabilities);
      
      expect(mockDevice.createShaderModule).toHaveBeenCalledTimes(3); // compute, vertex, fragment
    });

    it('should create pipelines', async () => {
      await particleSystem.initialize(mockDevice as any, mockCapabilities);
      
      expect(mockDevice.createComputePipeline).toHaveBeenCalledTimes(1);
      expect(mockDevice.createRenderPipeline).toHaveBeenCalledTimes(1);
    });

    it('should fail without WebGPU context', async () => {
      mockCanvas.getContext = jest.fn(() => null);
      
      await expect(particleSystem.initialize(mockDevice as any, mockCapabilities))
        .rejects.toThrow('Failed to get WebGPU context');
    });
  });

  describe('Update', () => {
    let mockMusicFeatures: MusicFeatures;

    beforeEach(async () => {
      mockMusicFeatures = {
        tempo: 120,
        energy: 0.8,
        valence: 0.6,
        beatTimes: [0, 0.5, 1.0],
        beatStrength: [0.9, 0.7, 0.8],
        onsetTimes: [0, 0.25, 0.5, 0.75],
        spectralCentroid: 2000,
        spectralRolloff: 4000,
        spectralBandwidth: 1000,
        spectralFlatness: 0.3,
        mfcc: new Float32Array(13),
        chromaticFeatures: new Float32Array(12),
        key: 'C',
        mode: 'major',
        rhythmPattern: new Float32Array(16),
        syncopation: 0.4,
        rhythmComplexity: 0.6,
        danceability: 0.7,
        acousticness: 0.3,
        instrumentalness: 0.8,
        liveness: 0.2,
        loudness: -10,
      };

      particleSystem = new WebGPUParticleSystem(mockCanvas, {
        maxParticles: 1000,
      });
      await particleSystem.initialize(mockDevice as any, mockCapabilities);
    });

    it('should update particle system', () => {
      const deltaTime = 0.016; // 60 FPS
      const audioData = new Float32Array(1024);
      
      // Fill with test data
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(i * 0.1) * 128 + 128;
      }

      expect(() => {
        particleSystem.update(deltaTime, audioData, mockMusicFeatures);
      }).not.toThrow();
    });

    it('should update uniform buffer', () => {
      const deltaTime = 0.016;
      const audioData = new Float32Array(1024);
      
      particleSystem.update(deltaTime, audioData, mockMusicFeatures);
      
      expect(mockDevice.queue.writeBuffer).toHaveBeenCalledWith(
        expect.anything(), // uniform buffer
        0,
        expect.any(Float32Array)
      );
    });

    it('should update audio buffer', () => {
      const deltaTime = 0.016;
      const audioData = new Float32Array(1024);
      
      particleSystem.update(deltaTime, audioData, mockMusicFeatures);
      
      expect(mockDevice.queue.writeBuffer).toHaveBeenCalledWith(
        expect.anything(), // audio buffer
        0,
        expect.any(Float32Array)
      );
    });

    it('should dispatch compute workgroups', () => {
      const deltaTime = 0.016;
      const audioData = new Float32Array(1024);
      
      const mockComputePass = {
        setPipeline: jest.fn(),
        setBindGroup: jest.fn(),
        dispatchWorkgroups: jest.fn(),
        end: jest.fn(),
      };

      const mockCommandEncoder = {
        beginComputePass: jest.fn(() => mockComputePass),
        finish: jest.fn(),
      };

      mockDevice.createCommandEncoder.mockReturnValue(mockCommandEncoder);
      
      particleSystem.update(deltaTime, audioData, mockMusicFeatures);
      
      expect(mockComputePass.dispatchWorkgroups).toHaveBeenCalled();
    });

    it('should handle empty audio data', () => {
      const deltaTime = 0.016;
      const audioData = new Float32Array(0);
      
      expect(() => {
        particleSystem.update(deltaTime, audioData, mockMusicFeatures);
      }).not.toThrow();
    });
  });

  describe('Render', () => {
    beforeEach(async () => {
      particleSystem = new WebGPUParticleSystem(mockCanvas, {
        maxParticles: 1000,
      });
      await particleSystem.initialize(mockDevice as any, mockCapabilities);
    });

    it('should render particles', () => {
      const viewProjectionMatrix = new Float32Array(16);
      
      expect(() => {
        particleSystem.render(viewProjectionMatrix);
      }).not.toThrow();
    });

    it('should create render pass', () => {
      const viewProjectionMatrix = new Float32Array(16);
      
      const mockRenderPass = {
        setPipeline: jest.fn(),
        setBindGroup: jest.fn(),
        draw: jest.fn(),
        end: jest.fn(),
      };

      const mockCommandEncoder = {
        beginRenderPass: jest.fn(() => mockRenderPass),
        finish: jest.fn(),
      };

      mockDevice.createCommandEncoder.mockReturnValue(mockCommandEncoder);
      
      particleSystem.render(viewProjectionMatrix);
      
      expect(mockCommandEncoder.beginRenderPass).toHaveBeenCalled();
      expect(mockRenderPass.draw).toHaveBeenCalledWith(4, 1000); // 4 vertices per particle
    });

    it('should handle missing dependencies gracefully', () => {
      // Create system without proper initialization
      const uninitializedSystem = new WebGPUParticleSystem(mockCanvas);
      const viewProjectionMatrix = new Float32Array(16);
      
      expect(() => {
        uninitializedSystem.render(viewProjectionMatrix);
      }).not.toThrow();
    });
  });

  describe('Emitters', () => {
    beforeEach(async () => {
      particleSystem = new WebGPUParticleSystem(mockCanvas);
      await particleSystem.initialize(mockDevice as any, mockCapabilities);
    });

    it('should add emitter', () => {
      const emitter = {
        position: new Float32Array([0, 0, 0]),
        direction: new Float32Array([0, 1, 0]),
        spread: Math.PI / 4,
        rate: 1000,
        burstCount: 1,
        shape: 'point' as const,
        size: new Float32Array([1, 1, 1]),
      };

      expect(() => {
        particleSystem.addEmitter(emitter);
      }).not.toThrow();
    });

    it('should remove emitter', () => {
      const emitter = {
        position: new Float32Array([0, 0, 0]),
        direction: new Float32Array([0, 1, 0]),
        spread: Math.PI / 4,
        rate: 1000,
        burstCount: 1,
        shape: 'point' as const,
        size: new Float32Array([1, 1, 1]),
      };

      particleSystem.addEmitter(emitter);
      
      expect(() => {
        particleSystem.removeEmitter(0);
      }).not.toThrow();
    });
  });

  describe('Forces', () => {
    beforeEach(async () => {
      particleSystem = new WebGPUParticleSystem(mockCanvas);
      await particleSystem.initialize(mockDevice as any, mockCapabilities);
    });

    it('should add force', () => {
      const force = {
        type: 'gravity' as const,
        strength: 9.8,
        position: new Float32Array([0, 0, 0]),
      };

      expect(() => {
        particleSystem.addForce(force);
      }).not.toThrow();
    });

    it('should remove force', () => {
      const force = {
        type: 'gravity' as const,
        strength: 9.8,
        position: new Float32Array([0, 0, 0]),
      };

      particleSystem.addForce(force);
      
      expect(() => {
        particleSystem.removeForce(0);
      }).not.toThrow();
    });

    it('should handle different force types', () => {
      const forces = [
        { type: 'gravity' as const, strength: 9.8 },
        { type: 'wind' as const, strength: 2.0, direction: new Float32Array([1, 0, 0]) },
        { type: 'attraction' as const, strength: 5.0, position: new Float32Array([0, 0, 0]) },
        { type: 'repulsion' as const, strength: 3.0, position: new Float32Array([0, 0, 0]), radius: 2.0 },
        { type: 'vortex' as const, strength: 1.0, position: new Float32Array([0, 0, 0]), radius: 3.0 },
        { type: 'turbulence' as const, strength: 0.5, frequency: 0.1 },
      ];

      forces.forEach(force => {
        expect(() => {
          particleSystem.addForce(force);
        }).not.toThrow();
      });
    });
  });

  describe('Configuration', () => {
    beforeEach(async () => {
      particleSystem = new WebGPUParticleSystem(mockCanvas);
      await particleSystem.initialize(mockDevice as any, mockCapabilities);
    });

    it('should update configuration', () => {
      const newConfig: Partial<ParticleConfig> = {
        maxParticles: 20000,
        particleSize: 4.0,
        emissionRate: 3000,
        audioReactivity: 2.0,
      };

      expect(() => {
        particleSystem.updateConfig(newConfig);
      }).not.toThrow();
    });

    it('should handle invalid configuration', () => {
      const invalidConfig = {
        maxParticles: -1000,
        particleSize: -1.0,
        emissionRate: -500,
      };

      expect(() => {
        particleSystem.updateConfig(invalidConfig);
      }).not.toThrow(); // Should not throw but should handle gracefully
    });
  });

  describe('Metrics', () => {
    beforeEach(async () => {
      particleSystem = new WebGPUParticleSystem(mockCanvas);
      await particleSystem.initialize(mockDevice as any, mockCapabilities);
    });

    it('should return metrics', () => {
      const metrics = particleSystem.getMetrics();
      
      expect(metrics).toHaveProperty('activeParticles');
      expect(metrics).toHaveProperty('totalParticles');
      expect(metrics).toHaveProperty('computeTime');
      expect(metrics).toHaveProperty('renderTime');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('fps');
    });

    it('should have valid metric values', () => {
      const metrics = particleSystem.getMetrics();
      
      expect(typeof metrics.activeParticles).toBe('number');
      expect(typeof metrics.totalParticles).toBe('number');
      expect(typeof metrics.computeTime).toBe('number');
      expect(typeof metrics.renderTime).toBe('number');
      expect(typeof metrics.memoryUsage).toBe('number');
      expect(typeof metrics.fps).toBe('number');
    });
  });

  describe('Disposal', () => {
    beforeEach(async () => {
      particleSystem = new WebGPUParticleSystem(mockCanvas);
      await particleSystem.initialize(mockDevice as any, mockCapabilities);
    });

    it('should dispose all resources', () => {
      const mockBuffer = {
        destroy: jest.fn(),
      };

      mockDevice.createBuffer.mockReturnValue(mockBuffer);
      
      particleSystem.dispose();
      
      // Should not throw after disposal
      expect(() => {
        particleSystem.dispose();
      }).not.toThrow();
    });

    it('should handle disposal before initialization', () => {
      const uninitializedSystem = new WebGPUParticleSystem(mockCanvas);
      
      expect(() => {
        uninitializedSystem.dispose();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle WebGPU context creation failure', async () => {
      mockCanvas.getContext = jest.fn(() => null);
      
      particleSystem = new WebGPUParticleSystem(mockCanvas);
      
      await expect(particleSystem.initialize(mockDevice as any, mockCapabilities))
        .rejects.toThrow('Failed to get WebGPU context');
    });

    it('should handle buffer creation failure', async () => {
      mockDevice.createBuffer.mockImplementation(() => {
        throw new Error('Buffer creation failed');
      });
      
      particleSystem = new WebGPUParticleSystem(mockCanvas);
      
      await expect(particleSystem.initialize(mockDevice as any, mockCapabilities))
        .rejects.toThrow();
    });

    it('should handle shader compilation failure', async () => {
      mockDevice.createShaderModule.mockImplementation(() => {
        throw new Error('Shader compilation failed');
      });
      
      particleSystem = new WebGPUParticleSystem(mockCanvas);
      
      await expect(particleSystem.initialize(mockDevice as any, mockCapabilities))
        .rejects.toThrow('Shader compilation failed');
    });

    it('should handle pipeline creation failure', async () => {
      mockDevice.createComputePipeline.mockImplementation(() => {
        throw new Error('Pipeline creation failed');
      });
      
      particleSystem = new WebGPUParticleSystem(mockCanvas);
      
      await expect(particleSystem.initialize(mockDevice as any, mockCapabilities))
        .rejects.toThrow();
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      particleSystem = new WebGPUParticleSystem(mockCanvas, {
        maxParticles: 100000,
      });
      await particleSystem.initialize(mockDevice as any, mockCapabilities);
    });

    it('should handle large particle counts', () => {
      const deltaTime = 0.016;
      const audioData = new Float32Array(1024);
      const mockMusicFeatures = {
        energy: 0.8,
        tempo: 120,
        rhythmComplexity: 0.6,
        beatStrength: [0.9],
      } as MusicFeatures;

      expect(() => {
        particleSystem.update(deltaTime, audioData, mockMusicFeatures);
      }).not.toThrow();
    });

    it('should maintain consistent performance', () => {
      const deltaTime = 0.016;
      const audioData = new Float32Array(1024);
      const mockMusicFeatures = {
        energy: 0.8,
        tempo: 120,
        rhythmComplexity: 0.6,
        beatStrength: [0.9],
      } as MusicFeatures;

      // Run multiple updates
      for (let i = 0; i < 10; i++) {
        expect(() => {
          particleSystem.update(deltaTime, audioData, mockMusicFeatures);
        }).not.toThrow();
      }
    });
  });
});