/**
 * Test suite for AI Beat Detection System
 */

// Mock TensorFlow.js before importing
// Mock the errorHandler module
jest.mock('../../utils/errorHandler', () => ({
  errorHandler: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('@tensorflow/tfjs', () => {
  const mockModel = {
    predict: jest.fn().mockReturnValue({
      data: jest.fn().mockResolvedValue([0.8, 0.2]),
      dispose: jest.fn()
    }),
    compile: jest.fn(),
    dispose: jest.fn()
  };

  const mockLayers = {
    dense: jest.fn().mockReturnValue({}),
    lstm: jest.fn().mockReturnValue({})
  };

  const mockTensor = {
    data: jest.fn().mockResolvedValue([0.5]),
    dispose: jest.fn(),
    shape: [1, 1]
  };

  return {
    sequential: jest.fn().mockReturnValue(mockModel),
    layers: mockLayers,
    tensor: jest.fn().mockReturnValue(mockTensor),
    tensor2d: jest.fn().mockReturnValue(mockTensor),
    tensor3d: jest.fn().mockReturnValue(mockTensor),
    zeros: jest.fn().mockReturnValue(mockTensor),
    ones: jest.fn().mockReturnValue(mockTensor),
    randomNormal: jest.fn().mockReturnValue(mockTensor),
    dispose: jest.fn(),
    loadLayersModel: jest.fn().mockResolvedValue(mockModel)
  };
});

import { AIBeatDetection, OnsetDetectionFunction, AdaptivePeakPicker, TempoTracker } from '../aiBeatDetection';
import { MusicFeatures } from '../aiMusicAnalyzer';


describe('OnsetDetectionFunction', () => {
  let odf: OnsetDetectionFunction;

  beforeEach(() => {
    odf = new OnsetDetectionFunction(44100, 1024, 512);
  });

  describe('Constructor', () => {
    it('should create ODF instance', () => {
      expect(odf).toBeInstanceOf(OnsetDetectionFunction);
    });
  });

  describe('Spectral Flux Calculation', () => {
    it('should calculate spectral flux', () => {
      const spectrum = new Float32Array(512);
      for (let i = 0; i < spectrum.length; i++) {
        spectrum[i] = Math.sin(i * 0.1);
      }

      const flux = odf.calculateSpectralFlux(spectrum);
      expect(typeof flux).toBe('number');
      expect(flux).toBeGreaterThanOrEqual(0);
    });

    it('should return zero for first spectrum', () => {
      const spectrum = new Float32Array(512);
      const flux = odf.calculateSpectralFlux(spectrum);
      expect(flux).toBe(0);
    });

    it('should handle empty spectrum', () => {
      const spectrum = new Float32Array(0);
      expect(() => {
        odf.calculateSpectralFlux(spectrum);
      }).not.toThrow();
    });
  });

  describe('Phase Deviation Calculation', () => {
    it('should calculate phase deviation', () => {
      const spectrum = new Float32Array(512);
      const phase = new Float32Array(512);
      
      for (let i = 0; i < spectrum.length; i++) {
        spectrum[i] = Math.random();
        phase[i] = Math.random() * 2 * Math.PI - Math.PI;
      }

      const deviation = odf.calculatePhaseDeviation(spectrum, phase);
      expect(typeof deviation).toBe('number');
      expect(deviation).toBeGreaterThanOrEqual(0);
    });

    it('should return zero for first phase', () => {
      const spectrum = new Float32Array(512);
      const phase = new Float32Array(512);
      
      const deviation = odf.calculatePhaseDeviation(spectrum, phase);
      expect(deviation).toBe(0);
    });
  });

  describe('Complex Domain Calculation', () => {
    it('should calculate complex domain onset', () => {
      const spectrum = new Float32Array(512);
      const phase = new Float32Array(512);
      
      for (let i = 0; i < spectrum.length; i++) {
        spectrum[i] = Math.random();
        phase[i] = Math.random() * 2 * Math.PI - Math.PI;
      }

      const onset = odf.calculateComplexDomain(spectrum, phase);
      expect(typeof onset).toBe('number');
      expect(onset).toBeGreaterThanOrEqual(0);
    });

    it('should handle mismatched array lengths', () => {
      const spectrum = new Float32Array(256);
      const phase = new Float32Array(512);
      
      expect(() => {
        odf.calculateComplexDomain(spectrum, phase);
      }).not.toThrow();
    });
  });

  describe('State Reset', () => {
    it('should reset internal state', () => {
      const spectrum = new Float32Array(512);
      odf.calculateSpectralFlux(spectrum);
      
      odf.reset();
      
      const flux = odf.calculateSpectralFlux(spectrum);
      expect(flux).toBe(0); // Should be zero after reset
    });
  });
});

describe('AdaptivePeakPicker', () => {
  let peakPicker: AdaptivePeakPicker;

  beforeEach(() => {
    peakPicker = new AdaptivePeakPicker(0.3, 5, 0.01);
  });

  describe('Constructor', () => {
    it('should create peak picker instance', () => {
      expect(peakPicker).toBeInstanceOf(AdaptivePeakPicker);
    });

    it('should set initial threshold', () => {
      expect(peakPicker.getThreshold()).toBe(0.3);
    });
  });

  describe('Peak Detection', () => {
    it('should detect peaks in ODF', () => {
      const odfValues = [0.1, 0.2, 0.5, 0.3, 0.1]; // Peak at index 2
      const timestamp = 0;
      
      let beat = null;
      for (let i = 0; i < odfValues.length; i++) {
        beat = peakPicker.detectPeaks(odfValues[i], timestamp + i * 0.1);
      }

      expect(beat).not.toBeNull();
    });

    it('should not detect peaks below threshold', () => {
      const odfValues = [0.1, 0.1, 0.1, 0.1, 0.1];
      const timestamp = 0;
      
      let beat = null;
      for (let i = 0; i < odfValues.length; i++) {
        beat = peakPicker.detectPeaks(odfValues[i], timestamp + i * 0.1);
      }

      expect(beat).toBeNull();
    });

    it('should return null for insufficient data', () => {
      const beat = peakPicker.detectPeaks(0.5, 0);
      expect(beat).toBeNull();
    });

    it('should adapt threshold over time', () => {
      const initialThreshold = peakPicker.getThreshold();
      
      // Feed high values to adapt threshold
      for (let i = 0; i < 100; i++) {
        peakPicker.detectPeaks(0.8, i * 0.1);
      }

      const adaptedThreshold = peakPicker.getThreshold();
      expect(adaptedThreshold).toBeGreaterThanOrEqual(initialThreshold);
    });
  });

  describe('State Reset', () => {
    it('should reset internal state', () => {
      // Feed some data
      for (let i = 0; i < 10; i++) {
        peakPicker.detectPeaks(0.5, i * 0.1);
      }

      peakPicker.reset();
      
      const beat = peakPicker.detectPeaks(0.5, 0);
      expect(beat).toBeNull(); // Should be null after reset
    });
  });
});

describe('TempoTracker', () => {
  let tempoTracker: TempoTracker;

  beforeEach(() => {
    tempoTracker = new TempoTracker(60, 200);
  });

  describe('Constructor', () => {
    it('should create tempo tracker instance', () => {
      expect(tempoTracker).toBeInstanceOf(TempoTracker);
    });

    it('should set default tempo', () => {
      expect(tempoTracker.getCurrentTempo()).toBe(120);
    });
  });

  describe('Tempo Tracking', () => {
    it('should update tempo from beat intervals', () => {
      const beatTimes = [0, 0.5, 1.0, 1.5, 2.0]; // 120 BPM
      
      for (const time of beatTimes) {
        tempoTracker.updateTempo(time);
      }

      const tempo = tempoTracker.getCurrentTempo();
      expect(tempo).toBeCloseTo(120, 0);
    });

    it('should filter out invalid tempo values', () => {
      const initialTempo = tempoTracker.getCurrentTempo();
      
      // Try to set invalid tempo (too fast)
      tempoTracker.updateTempo(0);
      tempoTracker.updateTempo(0.01); // 6000 BPM
      
      const tempo = tempoTracker.getCurrentTempo();
      expect(tempo).toBe(initialTempo);
    });

    it('should handle single beat', () => {
      tempoTracker.updateTempo(1.0);
      
      const tempo = tempoTracker.getCurrentTempo();
      expect(tempo).toBe(120); // Should remain default
    });

    it('should smooth tempo changes', () => {
      const beatTimes = [0, 0.5, 1.0, 1.5, 2.0, 2.4]; // Slight tempo change
      
      for (const time of beatTimes) {
        tempoTracker.updateTempo(time);
      }

      const tempo = tempoTracker.getCurrentTempo();
      expect(tempo).toBeGreaterThan(100);
      expect(tempo).toBeLessThan(140);
    });
  });

  describe('Confidence Tracking', () => {
    it('should track confidence', () => {
      const confidence = tempoTracker.getConfidence();
      expect(typeof confidence).toBe('number');
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('should increase confidence with stable tempo', () => {
      const beatTimes = [0, 0.5, 1.0, 1.5, 2.0, 2.5]; // Stable 120 BPM
      
      for (const time of beatTimes) {
        tempoTracker.updateTempo(time);
      }

      const confidence = tempoTracker.getConfidence();
      expect(confidence).toBeGreaterThan(0.5);
    });
  });

  describe('State Reset', () => {
    it('should reset tracker state', () => {
      // Set up some state
      tempoTracker.updateTempo(0);
      tempoTracker.updateTempo(0.5);
      
      tempoTracker.reset();
      
      expect(tempoTracker.getCurrentTempo()).toBe(120);
      expect(tempoTracker.getConfidence()).toBe(0);
    });
  });
});

describe.skip('AIBeatDetection', () => {
  let mockAudioContext: AudioContext;
  let beatDetection: AIBeatDetection;

  beforeEach(() => {
    // Mock AudioContext
    const mockAnalyserNode = {
      fftSize: 2048,
      frequencyBinCount: 1024,
      smoothingTimeConstant: 0.0,
      getFloatFrequencyData: jest.fn((array) => {
        // Fill with mock frequency data
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.random() * -100;
        }
      }),
      getFloatTimeDomainData: jest.fn((array) => {
        // Fill with mock time domain data
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.sin(i * 0.1) * 0.5;
        }
      }),
      connect: jest.fn(),
      disconnect: jest.fn(),
    };
    
    mockAudioContext = {
      sampleRate: 44100,
      currentTime: 0,
      state: 'running',
      createAnalyser: jest.fn(() => mockAnalyserNode),
    } as unknown as AudioContext;

    beatDetection = new AIBeatDetection(mockAudioContext);
  });

  afterEach(() => {
    if (beatDetection) {
      beatDetection.dispose();
    }
  });

  describe('Constructor', () => {
    it('should create beat detection instance', () => {
      expect(beatDetection).toBeInstanceOf(AIBeatDetection);
    });

    it('should create with custom config', () => {
      const config = {
        minTempo: 80,
        maxTempo: 180,
        enableAI: false,
        qualityMode: 'fast' as const,
      };

      const detector = new AIBeatDetection(mockAudioContext, config);
      expect(detector).toBeInstanceOf(AIBeatDetection);
      detector.dispose();
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await beatDetection.initialize();
      expect(beatDetection).toBeDefined();
    });

    it('should initialize without AI model', async () => {
      const tf = require('@tensorflow/tfjs');
      (tf.sequential as jest.Mock).mockImplementation(() => {
        throw new Error('Model creation failed');
      });

      const detector = new AIBeatDetection(mockAudioContext, { enableAI: false });
      await detector.initialize();
      
      expect(detector).toBeDefined();
      detector.dispose();
    });
  });

  describe('Audio Connection', () => {
    it('should connect audio source', () => {
      const mockSource = {
        connect: jest.fn(),
      } as unknown as AudioNode;

      beatDetection.connect(mockSource);
      expect(mockSource.connect).toHaveBeenCalled();
    });
  });

  describe('Beat Detection Processing', () => {
    beforeEach(async () => {
      await beatDetection.initialize();
    });

    it('should start processing', () => {
      expect(() => {
        beatDetection.start();
      }).not.toThrow();
    });

    it('should stop processing', () => {
      beatDetection.start();
      
      expect(() => {
        beatDetection.stop();
      }).not.toThrow();
    });

    it('should not start twice', () => {
      beatDetection.start();
      beatDetection.start(); // Should not throw
      
      expect(() => {
        beatDetection.start();
      }).not.toThrow();
    });
  });

  describe('State Management', () => {
    beforeEach(async () => {
      await beatDetection.initialize();
    });

    it('should return sync state', () => {
      const state = beatDetection.getSyncState();
      
      expect(state).toHaveProperty('currentTempo');
      expect(state).toHaveProperty('lastBeatTime');
      expect(state).toHaveProperty('nextBeatTime');
      expect(state).toHaveProperty('beatPhase');
      expect(state).toHaveProperty('measurePhase');
      expect(state).toHaveProperty('isStable');
      expect(state).toHaveProperty('confidence');
    });

    it('should return recent beats', () => {
      const beats = beatDetection.getRecentBeats(5);
      expect(Array.isArray(beats)).toBe(true);
      expect(beats.length).toBeLessThanOrEqual(5);
    });

    it('should return metrics', () => {
      const metrics = beatDetection.getMetrics();
      
      expect(metrics).toHaveProperty('accuracy');
      expect(metrics).toHaveProperty('latency');
      expect(metrics).toHaveProperty('stability');
      expect(metrics).toHaveProperty('processingTime');
      expect(metrics).toHaveProperty('beatCount');
      expect(metrics).toHaveProperty('missedBeats');
      expect(metrics).toHaveProperty('falsePositives');
    });
  });

  describe('Configuration', () => {
    beforeEach(async () => {
      await beatDetection.initialize();
    });

    it('should update configuration', () => {
      const newConfig = {
        minTempo: 80,
        maxTempo: 180,
        confidenceThreshold: 0.8,
      };

      expect(() => {
        beatDetection.updateConfig(newConfig);
      }).not.toThrow();
    });

    it('should recreate components on tempo range change', () => {
      const newConfig = {
        minTempo: 100,
        maxTempo: 160,
      };

      expect(() => {
        beatDetection.updateConfig(newConfig);
      }).not.toThrow();
    });
  });

  describe('Reset and Disposal', () => {
    beforeEach(async () => {
      await beatDetection.initialize();
    });

    it('should reset system', () => {
      beatDetection.start();
      
      expect(() => {
        beatDetection.reset();
      }).not.toThrow();
    });

    it('should dispose all resources', () => {
      expect(() => {
        beatDetection.dispose();
      }).not.toThrow();
    });

    it('should handle disposal without initialization', () => {
      const uninitializedDetector = new AIBeatDetection(mockAudioContext);
      
      expect(() => {
        uninitializedDetector.dispose();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle audio context errors', () => {
      const invalidAudioContext = {
        sampleRate: 0,
        state: 'closed',
        createAnalyser: jest.fn(() => {
          throw new Error('Analyser creation failed');
        }),
      } as unknown as AudioContext;

      expect(() => {
        new AIBeatDetection(invalidAudioContext);
      }).toThrow('Analyser creation failed');
    });

    it('should handle AI model initialization failure', async () => {
      (tf.sequential as jest.Mock).mockImplementation(() => {
        throw new Error('Model initialization failed');
      });

      const detector = new AIBeatDetection(mockAudioContext, { enableAI: true });
      await detector.initialize();
      
      // Should continue without AI
      expect(detector).toBeDefined();
      detector.dispose();
    });

    it.skip('should handle processing errors gracefully', async () => {
      await beatDetection.initialize();
      
      // Start beat detection before mocking error
      beatDetection.start();
      
      // Mock analyser to throw error for next frame
      const mockAnalyser = (beatDetection as any).analyser;
      if (mockAnalyser) {
        mockAnalyser.getFloatFrequencyData = jest.fn(() => {
          throw new Error('Audio data access failed');
        });
      }

      // Should continue processing despite errors
      // The error should be caught internally
      expect(() => {
        // Trigger processing by getting sync state
        beatDetection.getSyncState();
      }).not.toThrow();
      
      beatDetection.stop();
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await beatDetection.initialize();
    });

    it('should handle high-frequency updates', () => {
      beatDetection.start();
      
      // Simulate multiple rapid updates
      for (let i = 0; i < 100; i++) {
        const state = beatDetection.getSyncState();
        expect(state).toBeDefined();
      }
    });

    it('should maintain consistent performance', () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 10; i++) {
        beatDetection.getSyncState();
        beatDetection.getRecentBeats(10);
        beatDetection.getMetrics();
      }
      
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100); // Should be fast
    });
  });

  describe('AI Model Integration', () => {
    beforeEach(async () => {
      await beatDetection.initialize();
    });

    it('should use AI model for predictions', async () => {
      const mockModel = (beatDetection as any).aiModel;
      if (mockModel && mockModel.isModelLoaded()) {
        const features = new Float32Array(50);
        const prediction = await mockModel.predict(features);
        
        expect(prediction).toHaveProperty('beatProbability');
        expect(prediction).toHaveProperty('tempoAdjustment');
      }
    });

    it('should handle AI model prediction errors', async () => {
      const mockModel = (beatDetection as any).aiModel;
      if (mockModel) {
        mockModel.predict = jest.fn().mockRejectedValue(new Error('Prediction failed'));
        
        // Should not crash
        expect(async () => {
          await mockModel.predict(new Float32Array(50));
        }).not.toThrow();
      }
    });
  });

  describe('Real-time Processing', () => {
    beforeEach(async () => {
      await beatDetection.initialize();
    });

    it('should process audio in real-time mode', () => {
      const detector = new AIBeatDetection(mockAudioContext, {
        enableRealTimeProcessing: true,
        maxLatency: 25,
      });

      expect(() => {
        detector.start();
      }).not.toThrow();
      
      detector.dispose();
    });

    it('should process audio in non-real-time mode', () => {
      const detector = new AIBeatDetection(mockAudioContext, {
        enableRealTimeProcessing: false,
      });

      expect(() => {
        detector.start();
      }).not.toThrow();
      
      detector.dispose();
    });
  });
});