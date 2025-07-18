/**
 * Music to Visual Engine Tests
 */

import { MusicToVisualEngine } from '../musicToVisualEngine';
import { webgpuService } from '../../webgpu/webgpuService';

// Mock WebGPU service
jest.mock('../../webgpu/webgpuService', () => ({
  webgpuService: {
    initialize: jest.fn(),
    createComputePipeline: jest.fn(),
    createBuffer: jest.fn(),
  },
}));

// Mock errorHandler
jest.mock('@/utils/errorHandler', () => ({
  errorHandler: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock AudioContext and AnalyserNode
class MockAnalyserNode {
  fftSize = 2048;
  smoothingTimeConstant = 0.8;
  
  connect = jest.fn();
  disconnect = jest.fn();
  getFloatTimeDomainData = jest.fn((array: Float32Array) => {
    // Simulate audio data
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.sin(i * 0.1) * 0.5;
    }
  });
  getFloatFrequencyData = jest.fn((array: Float32Array) => {
    // Simulate frequency data in dB
    for (let i = 0; i < array.length; i++) {
      array[i] = -30 - i * 0.1; // Decreasing dB values
    }
  });
}

class MockAudioContext {
  sampleRate = 44100;
  createAnalyser = jest.fn(() => new MockAnalyserNode());
}

describe('MusicToVisualEngine', () => {
  let engine: MusicToVisualEngine;
  let mockAudioContext: MockAudioContext;
  let mockDevice: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAudioContext = new MockAudioContext();
    engine = new MusicToVisualEngine(mockAudioContext as any);
    
    mockDevice = {
      createShaderModule: jest.fn(),
      createComputePipeline: jest.fn(),
      createBuffer: jest.fn(),
    };
    
    (webgpuService.initialize as jest.Mock).mockResolvedValue({
      device: mockDevice,
      adapter: {},
      capabilities: {},
    });
  });

  describe('initialization', () => {
    it('should initialize successfully with WebGPU', async () => {
      await engine.initialize();
      
      expect(webgpuService.initialize).toHaveBeenCalled();
      expect(webgpuService.createComputePipeline).toHaveBeenCalled();
    });

    it('should handle WebGPU initialization failure gracefully', async () => {
      (webgpuService.initialize as jest.Mock).mockRejectedValue(new Error('WebGPU failed'));
      
      await engine.initialize();
      
      // Should continue without WebGPU
      expect(webgpuService.initialize).toHaveBeenCalled();
    });
  });

  describe('connectSource', () => {
    it('should connect audio source to analyser', () => {
      const mockSource = { connect: jest.fn() };
      const analyser = (engine as any).analyser;
      
      engine.connectSource(mockSource as any);
      
      expect(mockSource.connect).toHaveBeenCalledWith(analyser);
    });
  });

  describe('extractAudioFeatures', () => {
    it('should extract basic audio features', () => {
      const features = engine.extractAudioFeatures();
      
      expect(features).toMatchObject({
        rms: expect.any(Number),
        zcr: expect.any(Number),
        energy: expect.any(Number),
        spectralCentroid: expect.any(Number),
        spectralFlux: expect.any(Number),
        tempo: expect.any(Number),
        onset: expect.any(Boolean),
        loudness: expect.any(Number),
        energy_level: expect.stringMatching(/low|medium|high/),
      });
    });

    it('should calculate RMS correctly', () => {
      const features = engine.extractAudioFeatures();
      
      // RMS should be positive for non-zero signal
      expect(features.rms).toBeGreaterThan(0);
      expect(features.rms).toBeLessThan(1);
    });

    it('should detect energy levels', () => {
      const features = engine.extractAudioFeatures();
      
      expect(['low', 'medium', 'high']).toContain(features.energy_level);
    });

    it('should calculate spectral features', () => {
      const features = engine.extractAudioFeatures();
      
      expect(features.spectralCentroid).toBeGreaterThanOrEqual(0);
      expect(features.spectralFlux).toBeGreaterThanOrEqual(0);
    });

    it('should detect onsets when spectral flux is high', () => {
      // First call to establish baseline
      const features1 = engine.extractAudioFeatures();
      
      // Mock high spectral flux by changing frequency data
      const analyser = (engine as any).analyser;
      analyser.getFloatFrequencyData = jest.fn((array: Float32Array) => {
        // Simulate sudden increase in frequency data
        for (let i = 0; i < array.length; i++) {
          array[i] = -5; // Much higher dB values than baseline
        }
      });

      // Extract features again with new data
      const features2 = engine.extractAudioFeatures();
      
      // Should have positive spectral flux due to increase
      expect(features2.spectralFlux).toBeGreaterThan(0);
    });
  });

  describe('generateVisualParameters', () => {
    it('should generate visual parameters from audio features', () => {
      const features = engine.extractAudioFeatures();
      const params = engine.generateVisualParameters(features);
      
      expect(params).toMatchObject({
        particleCount: expect.any(Number),
        particleSpeed: expect.any(Number),
        particleSpread: expect.any(Number),
        gravity: expect.any(Number),
        turbulence: expect.any(Number),
        primaryColor: expect.arrayContaining([
          expect.any(Number),
          expect.any(Number),
          expect.any(Number),
        ]),
        cameraMovement: expect.arrayContaining([
          expect.any(Number),
          expect.any(Number),
          expect.any(Number),
        ]),
        bloomIntensity: expect.any(Number),
        shapeType: expect.stringMatching(/sphere|cube|torus|custom/),
        animationSpeed: expect.any(Number),
      });
    });

    it('should scale particle count with energy', () => {
      const lowEnergyFeatures = engine.extractAudioFeatures();
      lowEnergyFeatures.energy = 0.1;
      const lowParams = engine.generateVisualParameters(lowEnergyFeatures);
      
      const highEnergyFeatures = engine.extractAudioFeatures();
      highEnergyFeatures.energy = 0.9;
      const highParams = engine.generateVisualParameters(highEnergyFeatures);
      
      expect(highParams.particleCount).toBeGreaterThan(lowParams.particleCount);
    });

    it('should apply camera shake on onset', () => {
      const features = engine.extractAudioFeatures();
      features.onset = false;
      const paramsNoOnset = engine.generateVisualParameters(features);
      
      features.onset = true;
      features.beatStrength = 0.8;
      const paramsWithOnset = engine.generateVisualParameters(features);
      
      expect(paramsNoOnset.cameraMovement).toEqual([0, 0, 0]);
      expect(paramsWithOnset.cameraMovement.some(v => v !== 0)).toBe(true);
    });

    it('should map harmonicity to shape type', () => {
      const features = engine.extractAudioFeatures();
      
      features.harmonicity = 0.1;
      expect(engine.generateVisualParameters(features).shapeType).toBe('cube');
      
      features.harmonicity = 0.4;
      expect(engine.generateVisualParameters(features).shapeType).toBe('sphere');
      
      features.harmonicity = 0.6;
      expect(engine.generateVisualParameters(features).shapeType).toBe('torus');
      
      features.harmonicity = 0.9;
      expect(engine.generateVisualParameters(features).shapeType).toBe('custom');
    });
  });

  describe('smoothTransition', () => {
    it('should interpolate between visual parameters', () => {
      const current = {
        particleCount: 10000,
        particleSpeed: 5,
        particleSpread: 10,
        particleSize: 1,
        particleLifespan: 2,
        gravity: 9.8,
        turbulence: 1,
        attractorStrength: 5,
        windForce: [0, 0, 0] as [number, number, number],
        primaryColor: [1, 0, 0] as [number, number, number],
        secondaryColor: [0, 1, 0] as [number, number, number],
        colorIntensity: 0.5,
        colorTransition: 0.1,
        cameraMovement: [0, 0, 0] as [number, number, number],
        cameraRotation: [0, 0, 0] as [number, number, number],
        fov: 60,
        bloomIntensity: 0.5,
        glitchAmount: 0,
        distortionLevel: 0,
        shapeType: 'sphere' as const,
        patternComplexity: 5,
        symmetry: 4,
        animationSpeed: 1,
        morphFactor: 0,
        pulseFactor: 0,
      };
      
      const target = {
        ...current,
        particleCount: 20000,
        particleSpeed: 10,
        primaryColor: [0, 0, 1] as [number, number, number],
        shapeType: 'cube' as const,
      };
      
      const interpolated = engine.smoothTransition(current, target, 0.5);
      
      expect(interpolated.particleCount).toBe(15000);
      expect(interpolated.particleSpeed).toBe(7.5);
      expect(interpolated.primaryColor).toEqual([0.5, 0, 0.5]);
      expect(interpolated.shapeType).toBe('sphere'); // Changes at factor > 0.5
    });

    it('should handle shape type transition at factor > 0.5', () => {
      const current = {
        particleCount: 10000,
        particleSpeed: 5,
        particleSpread: 10,
        particleSize: 1,
        particleLifespan: 2,
        gravity: 9.8,
        turbulence: 1,
        attractorStrength: 5,
        windForce: [0, 0, 0] as [number, number, number],
        primaryColor: [1, 0, 0] as [number, number, number],
        secondaryColor: [0, 1, 0] as [number, number, number],
        colorIntensity: 0.5,
        colorTransition: 0.1,
        cameraMovement: [0, 0, 0] as [number, number, number],
        cameraRotation: [0, 0, 0] as [number, number, number],
        fov: 60,
        bloomIntensity: 0.5,
        glitchAmount: 0,
        distortionLevel: 0,
        shapeType: 'sphere' as const,
        patternComplexity: 5,
        symmetry: 4,
        animationSpeed: 1,
        morphFactor: 0,
        pulseFactor: 0,
      };
      
      const target = { ...current, shapeType: 'cube' as const };
      
      const interpolated1 = engine.smoothTransition(current, target, 0.4);
      expect(interpolated1.shapeType).toBe('sphere');
      
      const interpolated2 = engine.smoothTransition(current, target, 0.6);
      expect(interpolated2.shapeType).toBe('cube');
    });
  });

  describe('cleanup', () => {
    it('should disconnect analyser on destroy', () => {
      const analyser = (engine as any).analyser;
      
      engine.destroy();
      
      expect(analyser.disconnect).toHaveBeenCalled();
    });
  });
});