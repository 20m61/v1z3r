/**
 * Test suite for AI VJ Master Controller
 */

import { AIVJMaster, AIVJConfig } from '../aiVJMaster';
import { webgpuDetector } from '../webgpuDetection';
import { setupAllMocks, cleanupAllMocks, createWebGPUDetectorMock, createMIDIManagerMock } from '../../__mocks__/setupMocks';

// Mock dependencies
jest.mock('../webgpuRenderer', () => ({
  V1z3rRenderer: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue({
      renderer: {
        domElement: document.createElement('canvas'),
        setSize: jest.fn(),
        render: jest.fn(),
        getCapabilities: jest.fn().mockReturnValue({
          isWebGL2: true,
          maxTextures: 16,
          maxTextureSize: 4096
        })
      },
      isWebGPU: true
    }),
    render: jest.fn(),
    updateEffects: jest.fn(),
    setCanvasSize: jest.fn(),
    setSize: jest.fn(),
    getThreeRenderer: jest.fn(() => ({
      domElement: document.createElement('canvas'),
      setSize: jest.fn(),
      render: jest.fn(),
      getCapabilities: jest.fn().mockReturnValue({
        isWebGL2: true,
        maxTextures: 16,
        maxTextureSize: 4096
      })
    })),
    dispose: jest.fn()
  }))
}));
jest.mock('../aiMusicAnalyzer', () => ({
  AIMusicalAnalyzer: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn(),
    analyze: jest.fn().mockReturnValue({
      energy: 0.5,
      tempo: 120,
      harmonicity: 0.7
    }),
    getFeatureHistory: jest.fn().mockReturnValue([]),
    dispose: jest.fn()
  }))
}));
jest.mock('../aiStyleTransfer');
jest.mock('../webgpuParticles');
jest.mock('../professionalMIDI', () => ({
  ProfessionalMIDI: jest.fn().mockImplementation(() => {
    const mockManager = createMIDIManagerMock();
    return {
      initialize: mockManager.initialize,
      setCallbacks: jest.fn(),
      setParameterChangeHandler: mockManager.setParameterChangeHandler,
      sendControlChange: mockManager.sendControlChange,
      sendNoteOn: mockManager.sendNoteOn,
      sendNoteOff: mockManager.sendNoteOff,
      dispose: mockManager.dispose
    };
  }),
  ProfessionalMIDIManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    setCallbacks: jest.fn(),
    dispose: jest.fn(),
    isSupported: jest.fn().mockReturnValue(true),
    getDevices: jest.fn().mockReturnValue([]),
  }))
}));
jest.mock('../webgpuDetection', () => ({
  webgpuDetector: {
    detect: jest.fn().mockResolvedValue({
      isSupported: true,
      device: {},
      capabilities: {
        maxTextureSize: 8192,
        maxComputeWorkgroupSize: [256, 256, 64],
        preferredFormat: 'bgra8unorm',
      },
    })
  }
}));

describe('AIVJMaster', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockAudioContext: AudioContext;
  let aiVJMaster: AIVJMaster;

  beforeAll(() => {
    setupAllMocks();
  });

  afterAll(() => {
    cleanupAllMocks();
  });

  beforeEach(() => {
    // Mock canvas
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 800;
    mockCanvas.height = 600;

    // Mock AudioContext
    mockAudioContext = {
      sampleRate: 44100,
      currentTime: 0,
      state: 'running',
      createAnalyser: jest.fn(() => ({
        fftSize: 2048,
        smoothingTimeConstant: 0.0,
        frequencyBinCount: 1024,
        connect: jest.fn(),
        disconnect: jest.fn(),
        getByteFrequencyData: jest.fn(),
        getFloatFrequencyData: jest.fn(),
      })),
      resume: jest.fn(),
    } as unknown as AudioContext;

    // Mock global AudioContext
    global.AudioContext = jest.fn(() => mockAudioContext);
    global.webkitAudioContext = jest.fn(() => mockAudioContext);
  });

  afterEach(() => {
    if (aiVJMaster) {
      aiVJMaster.dispose();
    }
  });

  describe('Constructor', () => {
    it('should create instance with default config', () => {
      aiVJMaster = new AIVJMaster();
      expect(aiVJMaster).toBeInstanceOf(AIVJMaster);
      
      const state = aiVJMaster.getState();
      expect(state.isInitialized).toBe(false);
      expect(state.isWebGPUEnabled).toBe(false);
      expect(state.isAIEnabled).toBe(false);
    });

    it('should create instance with custom config', () => {
      const config: Partial<AIVJConfig> = {
        canvas: mockCanvas,
        audioContext: mockAudioContext,
        enableWebGPU: true,
        enableAI: true,
        enableMIDI: true,
        performanceMode: 'performance',
        targetFPS: 60,
      };

      aiVJMaster = new AIVJMaster(config);
      expect(aiVJMaster).toBeInstanceOf(AIVJMaster);
    });
  });

  describe('Initialization', () => {
    beforeEach(() => {
      aiVJMaster = new AIVJMaster({
        canvas: mockCanvas,
        audioContext: mockAudioContext,
        enableWebGPU: true,
        enableAI: true,
        enableMIDI: true,
      });
    });

    it('should initialize successfully', async () => {
      await aiVJMaster.initialize();
      
      const state = aiVJMaster.getState();
      expect(state.isInitialized).toBe(true);
    });

    it('should handle initialization failure gracefully', async () => {
      // Mock renderer initialization to fail completely
      const V1z3rRenderer = require('../webgpuRenderer').V1z3rRenderer;
      V1z3rRenderer.mockImplementationOnce(() => ({
        initialize: jest.fn().mockRejectedValue(new Error('Renderer initialization failed'))
      }));
      
      await expect(aiVJMaster.initialize()).rejects.toThrow('Renderer initialization failed');
    });

    it('should not initialize twice', async () => {
      await aiVJMaster.initialize();
      
      // Mock console.warn to verify warning is logged
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await aiVJMaster.initialize();
      
      expect(consoleSpy).toHaveBeenCalledWith('[AIVJMaster] Already initialized');
      consoleSpy.mockRestore();
    });
  });

  describe('Audio Processing', () => {
    beforeEach(async () => {
      aiVJMaster = new AIVJMaster({
        canvas: mockCanvas,
        audioContext: mockAudioContext,
        enableAI: true,
      });
      await aiVJMaster.initialize();
    });

    it('should connect audio source', () => {
      const mockSource = {
        connect: jest.fn(),
        disconnect: jest.fn(),
      } as unknown as AudioNode;

      aiVJMaster.connectAudioSource(mockSource);
      expect(mockSource.connect).toHaveBeenCalled();
    });

    it('should disconnect audio source', () => {
      const mockSource = {
        connect: jest.fn(),
        disconnect: jest.fn(),
      } as unknown as AudioNode;

      aiVJMaster.connectAudioSource(mockSource);
      aiVJMaster.disconnectAudioSource();
      expect(mockSource.disconnect).toHaveBeenCalled();
    });
  });

  describe('Visual Parameters', () => {
    beforeEach(async () => {
      aiVJMaster = new AIVJMaster({
        canvas: mockCanvas,
        audioContext: mockAudioContext,
        enableAI: true,
      });
      await aiVJMaster.initialize();
    });

    it('should return current visual parameters', () => {
      const params = aiVJMaster.getCurrentVisualParameters();
      expect(params).toBeNull(); // Initially null
    });

    it('should return current music features', () => {
      const features = aiVJMaster.getCurrentMusicFeatures();
      expect(features).toBeNull(); // Initially null
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(async () => {
      aiVJMaster = new AIVJMaster({
        canvas: mockCanvas,
        audioContext: mockAudioContext,
      });
      await aiVJMaster.initialize();
    });

    it('should return performance metrics', () => {
      const metrics = aiVJMaster.getPerformanceMetrics();
      expect(metrics).toHaveProperty('fps');
      expect(metrics).toHaveProperty('frameTime');
      expect(metrics).toHaveProperty('aiProcessingTime');
      expect(metrics).toHaveProperty('renderTime');
      expect(metrics).toHaveProperty('particleCount');
      expect(metrics).toHaveProperty('memoryUsage');
    });

    it('should have valid metric values', () => {
      const metrics = aiVJMaster.getPerformanceMetrics();
      expect(typeof metrics.fps).toBe('number');
      expect(typeof metrics.frameTime).toBe('number');
      expect(typeof metrics.aiProcessingTime).toBe('number');
      expect(typeof metrics.renderTime).toBe('number');
      expect(typeof metrics.particleCount).toBe('number');
      expect(typeof metrics.memoryUsage).toBe('number');
    });
  });

  describe('Configuration', () => {
    beforeEach(async () => {
      aiVJMaster = new AIVJMaster({
        canvas: mockCanvas,
        audioContext: mockAudioContext,
      });
      await aiVJMaster.initialize();
    });

    it('should update configuration', () => {
      const newConfig = {
        targetFPS: 30,
        maxParticles: 25000,
        aiUpdateInterval: 200,
      };

      aiVJMaster.updateConfig(newConfig);
      
      // Config should be updated internally
      // We can't directly test private config, but can test effects
      expect(() => aiVJMaster.updateConfig(newConfig)).not.toThrow();
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      aiVJMaster = new AIVJMaster({
        canvas: mockCanvas,
        audioContext: mockAudioContext,
      });
      await aiVJMaster.initialize();
    });

    it('should add event listener', () => {
      const mockListener = jest.fn();
      aiVJMaster.addEventListener('beat_detected', mockListener);
      
      // Event listener should be added without throwing
      expect(() => aiVJMaster.addEventListener('beat_detected', mockListener)).not.toThrow();
    });

    it('should remove event listener', () => {
      const mockListener = jest.fn();
      aiVJMaster.addEventListener('beat_detected', mockListener);
      aiVJMaster.removeEventListener('beat_detected', mockListener);
      
      // Should not throw
      expect(() => aiVJMaster.removeEventListener('beat_detected', mockListener)).not.toThrow();
    });

    it('should handle resize events', () => {
      // Mock window resize
      const resizeEvent = new Event('resize');
      window.dispatchEvent(resizeEvent);
      
      // Should not throw
      expect(() => window.dispatchEvent(resizeEvent)).not.toThrow();
    });
  });

  describe('Disposal', () => {
    beforeEach(async () => {
      aiVJMaster = new AIVJMaster({
        canvas: mockCanvas,
        audioContext: mockAudioContext,
        enableAI: true,
        enableMIDI: true,
      });
      await aiVJMaster.initialize();
    });

    it('should dispose all resources', () => {
      aiVJMaster.dispose();
      
      const state = aiVJMaster.getState();
      expect(state.isInitialized).toBe(false);
    });

    it('should stop animation loop on dispose', () => {
      const cancelAnimationFrameSpy = jest.spyOn(window, 'cancelAnimationFrame');
      aiVJMaster.dispose();
      
      // Should have cancelled animation frame
      expect(cancelAnimationFrameSpy).toHaveBeenCalled();
      cancelAnimationFrameSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle WebGPU initialization failure', async () => {
      // Mock renderer to fail initialization
      const V1z3rRenderer = require('../webgpuRenderer').V1z3rRenderer;
      V1z3rRenderer.mockImplementationOnce(() => ({
        initialize: jest.fn().mockRejectedValue(new Error('WebGPU initialization failed'))
      }));
      
      aiVJMaster = new AIVJMaster({
        canvas: mockCanvas,
        audioContext: mockAudioContext,
        enableWebGPU: true,
      });

      await expect(aiVJMaster.initialize()).rejects.toThrow('WebGPU initialization failed');
    });

    it('should handle audio context suspension', async () => {
      const suspendedAudioContext = {
        ...mockAudioContext,
        state: 'suspended',
        resume: jest.fn().mockResolvedValue(undefined),
      } as unknown as AudioContext;

      aiVJMaster = new AIVJMaster({
        canvas: mockCanvas,
        audioContext: suspendedAudioContext,
      });

      await aiVJMaster.initialize();
      expect(suspendedAudioContext.resume).toHaveBeenCalled();
    });
  });

  describe('WebGPU Integration', () => {
    it('should enable WebGPU when supported', async () => {
      (webgpuDetector.detect as jest.Mock).mockResolvedValue({
        isSupported: true,
        device: {},
        capabilities: {
          maxTextureSize: 8192,
          maxComputeWorkgroupSize: [256, 256, 64],
          preferredFormat: 'bgra8unorm',
        },
      });

      aiVJMaster = new AIVJMaster({
        canvas: mockCanvas,
        audioContext: mockAudioContext,
        enableWebGPU: true,
        enableParticles: true,
      });

      await aiVJMaster.initialize();
      
      const state = aiVJMaster.getState();
      expect(state.isWebGPUEnabled).toBe(true);
    });

    it('should fallback to WebGL when WebGPU not supported', async () => {
      // Mock renderer to return WebGL fallback
      const V1z3rRenderer = require('../webgpuRenderer').V1z3rRenderer;
      V1z3rRenderer.mockImplementationOnce(() => ({
        initialize: jest.fn().mockResolvedValue({
          renderer: {
            domElement: document.createElement('canvas'),
            setSize: jest.fn(),
            render: jest.fn(),
            getCapabilities: jest.fn().mockReturnValue({
              isWebGL2: true,
              maxTextures: 16,
              maxTextureSize: 4096
            })
          },
          isWebGPU: false // WebGL fallback
        }),
        render: jest.fn(),
        updateEffects: jest.fn(),
        setCanvasSize: jest.fn(),
        setSize: jest.fn(),
        getThreeRenderer: jest.fn(() => ({
          domElement: document.createElement('canvas'),
          setSize: jest.fn(),
          render: jest.fn(),
          getCapabilities: jest.fn().mockReturnValue({
            isWebGL2: true,
            maxTextures: 16,
            maxTextureSize: 4096
          })
        })),
        dispose: jest.fn()
      }));

      aiVJMaster = new AIVJMaster({
        canvas: mockCanvas,
        audioContext: mockAudioContext,
        enableWebGPU: true,
      });

      await aiVJMaster.initialize();
      
      const state = aiVJMaster.getState();
      expect(state.isWebGPUEnabled).toBe(false);
    });
  });

  describe('AI Integration', () => {
    it('should enable AI when configured', async () => {
      aiVJMaster = new AIVJMaster({
        canvas: mockCanvas,
        audioContext: mockAudioContext,
        enableAI: true,
      });

      await aiVJMaster.initialize();
      
      const state = aiVJMaster.getState();
      expect(state.isAIEnabled).toBe(true);
    });

    it('should disable AI when not configured', async () => {
      aiVJMaster = new AIVJMaster({
        canvas: mockCanvas,
        audioContext: mockAudioContext,
        enableAI: false,
      });

      await aiVJMaster.initialize();
      
      const state = aiVJMaster.getState();
      expect(state.isAIEnabled).toBe(false);
    });
  });

  describe('MIDI Integration', () => {
    it('should enable MIDI when configured', async () => {
      // Ensure MIDI manager mock is properly set up
      const ProfessionalMIDI = require('../professionalMIDI').ProfessionalMIDI;
      const mockMIDIInstance = {
        initialize: jest.fn().mockResolvedValue(undefined),
        setParameterChangeHandler: jest.fn(),
        setButtonPressHandler: jest.fn(),
        setPadHitHandler: jest.fn(),
        setControllerConnectedHandler: jest.fn(),
        setControllerDisconnectedHandler: jest.fn(),
        dispose: jest.fn()
      };
      ProfessionalMIDI.mockImplementationOnce(() => mockMIDIInstance);
      
      aiVJMaster = new AIVJMaster({
        canvas: mockCanvas,
        audioContext: mockAudioContext,
        enableMIDI: true,
      });

      await aiVJMaster.initialize();
      
      const state = aiVJMaster.getState();
      expect(state.isMIDIEnabled).toBe(true);
    });

    it('should handle MIDI initialization failure', async () => {
      // Mock MIDI to fail
      const ProfessionalMIDI = require('../professionalMIDI').ProfessionalMIDI;
      ProfessionalMIDI.mockImplementationOnce(() => ({
        initialize: jest.fn().mockRejectedValue(new Error('MIDI not supported')),
        dispose: jest.fn()
      }));

      aiVJMaster = new AIVJMaster({
        canvas: mockCanvas,
        audioContext: mockAudioContext,
        enableMIDI: true,
      });

      await aiVJMaster.initialize();
      
      const state = aiVJMaster.getState();
      expect(state.isMIDIEnabled).toBe(false);
    });
  });
});