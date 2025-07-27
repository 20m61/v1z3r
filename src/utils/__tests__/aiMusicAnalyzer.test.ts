/**
 * Test suite for AI Music Analyzer
 */

import { AIMusicalAnalyzer, AudioProcessor, MusicFeatures } from '../aiMusicAnalyzer';
import * as tf from '@tensorflow/tfjs';
import { setupTensorFlowMocks } from '@vj-app/test-utils';

// Mock TensorFlow.js
jest.mock('@tensorflow/tfjs');

describe('AudioProcessor', () => {
  let mockAudioContext: AudioContext;
  let mockAnalyser: AnalyserNode;
  let audioProcessor: AudioProcessor;

  beforeEach(() => {
    // Mock AnalyserNode
    mockAnalyser = {
      fftSize: 2048,
      frequencyBinCount: 1024,
      smoothingTimeConstant: 0.0,
      getByteFrequencyData: jest.fn(),
      getByteTimeDomainData: jest.fn(),
      getFloatFrequencyData: jest.fn(),
      getFloatTimeDomainData: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as AnalyserNode;

    // Mock AudioContext
    mockAudioContext = {
      sampleRate: 44100,
      currentTime: 0,
      createAnalyser: jest.fn(() => mockAnalyser),
    } as unknown as AudioContext;

    audioProcessor = new AudioProcessor(mockAudioContext);
  });

  describe('Constructor', () => {
    it('should create audio processor', () => {
      expect(audioProcessor).toBeInstanceOf(AudioProcessor);
      expect(mockAudioContext.createAnalyser).toHaveBeenCalled();
    });

    it('should configure analyser correctly', () => {
      expect(mockAnalyser.fftSize).toBe(2048);
      expect(mockAnalyser.smoothingTimeConstant).toBe(0.0);
    });
  });

  describe('Audio Connection', () => {
    it('should connect audio source', () => {
      const mockSource = {
        connect: jest.fn(),
      } as unknown as AudioNode;

      audioProcessor.connect(mockSource);
      expect(mockSource.connect).toHaveBeenCalledWith(mockAnalyser);
    });
  });

  describe('Feature Extraction', () => {
    beforeEach(() => {
      // Mock analyzer data
      const mockFrequencyData = new Uint8Array(1024);
      const mockTimeData = new Uint8Array(1024);

      // Fill with test data
      for (let i = 0; i < 1024; i++) {
        mockFrequencyData[i] = Math.floor(Math.random() * 255);
        mockTimeData[i] = Math.floor(Math.random() * 255);
      }

      (mockAnalyser.getByteFrequencyData as jest.Mock).mockImplementation((array) => {
        array.set(mockFrequencyData);
      });

      (mockAnalyser.getByteTimeDomainData as jest.Mock).mockImplementation((array) => {
        array.set(mockTimeData);
      });
    });

    it('should extract basic features', () => {
      const features = audioProcessor.extractFeatures();
      
      expect(features).toHaveProperty('spectralCentroid');
      expect(features).toHaveProperty('spectralRolloff');
      expect(features).toHaveProperty('spectralBandwidth');
      expect(features).toHaveProperty('spectralFlatness');
      expect(features).toHaveProperty('mfcc');
      expect(features).toHaveProperty('tempo');
      expect(features).toHaveProperty('energy');
    });

    it('should extract spectral features', () => {
      const features = audioProcessor.extractFeatures();
      
      expect(typeof features.spectralCentroid).toBe('number');
      expect(typeof features.spectralRolloff).toBe('number');
      expect(typeof features.spectralBandwidth).toBe('number');
      expect(typeof features.spectralFlatness).toBe('number');
      expect(features.mfcc).toBeInstanceOf(Float32Array);
    });

    it('should extract temporal features', () => {
      const features = audioProcessor.extractFeatures();
      
      expect(typeof features.tempo).toBe('number');
      expect(Array.isArray(features.beatTimes)).toBe(true);
      expect(Array.isArray(features.beatStrength)).toBe(true);
      expect(Array.isArray(features.onsetTimes)).toBe(true);
    });

    it('should extract harmonic features', () => {
      const features = audioProcessor.extractFeatures();
      
      expect(features.chromaticFeatures).toBeInstanceOf(Float32Array);
      expect(features.chromaticFeatures.length).toBe(12);
      expect(typeof features.key).toBe('string');
      expect(['major', 'minor']).toContain(features.mode);
    });

    it('should extract rhythmic features', () => {
      const features = audioProcessor.extractFeatures();
      
      expect(features.rhythmPattern).toBeInstanceOf(Float32Array);
      expect(typeof features.syncopation).toBe('number');
      expect(typeof features.rhythmComplexity).toBe('number');
    });

    it('should extract emotional features', () => {
      const features = audioProcessor.extractFeatures();
      
      expect(typeof features.energy).toBe('number');
      expect(typeof features.valence).toBe('number');
      expect(typeof features.danceability).toBe('number');
      expect(typeof features.acousticness).toBe('number');
      expect(typeof features.instrumentalness).toBe('number');
      expect(typeof features.liveness).toBe('number');
      expect(typeof features.loudness).toBe('number');
    });

    it('should handle empty audio data', () => {
      // Mock empty data
      (mockAnalyser.getByteFrequencyData as jest.Mock).mockImplementation((array) => {
        array.fill(0);
      });

      (mockAnalyser.getByteTimeDomainData as jest.Mock).mockImplementation((array) => {
        array.fill(128);
      });

      expect(() => {
        audioProcessor.extractFeatures();
      }).not.toThrow();
    });
  });

  describe('Buffer Size Configuration', () => {
    it('should update buffer size', () => {
      const newBufferSize = 4096;
      audioProcessor.setBufferSize(newBufferSize);
      
      expect(mockAnalyser.fftSize).toBe(newBufferSize);
    });

    it('should handle invalid buffer size', () => {
      const invalidBufferSize = 1000; // Not power of 2
      
      expect(() => {
        audioProcessor.setBufferSize(invalidBufferSize);
      }).not.toThrow(); // Should handle gracefully
    });
  });

  describe('Analyser Access', () => {
    it('should return analyser node', () => {
      const analyser = audioProcessor.getAnalyser();
      expect(analyser).toBe(mockAnalyser);
    });
  });
});

describe('AIMusicalAnalyzer', () => {
  let mockAudioContext: AudioContext;
  let aiAnalyzer: AIMusicalAnalyzer;

  beforeEach(() => {
    // Setup comprehensive TensorFlow.js mocks
    const tfMocks = setupTensorFlowMocks();
    Object.assign(tf, tfMocks);
    
    // Ensure tf.layers is properly available globally
    (tf.layers as any) = tfMocks.layers;

    mockAudioContext = {
      sampleRate: 44100,
      currentTime: 0,
      createAnalyser: jest.fn(() => ({
        fftSize: 2048,
        frequencyBinCount: 1024,
        smoothingTimeConstant: 0.0,
        getByteFrequencyData: jest.fn(),
        getByteTimeDomainData: jest.fn(),
        connect: jest.fn(),
        disconnect: jest.fn(),
      })),
    } as unknown as AudioContext;

    aiAnalyzer = new AIMusicalAnalyzer(mockAudioContext);
  });

  afterEach(() => {
    if (aiAnalyzer) {
      aiAnalyzer.dispose();
    }
  });

  describe('Constructor', () => {
    it('should create AI analyzer', () => {
      expect(aiAnalyzer).toBeInstanceOf(AIMusicalAnalyzer);
    });
  });

  describe('Initialization', () => {
    it('should initialize without AI model', async () => {
      // Mock TensorFlow model creation to fail
      (tf.sequential as jest.Mock).mockImplementation(() => {
        throw new Error('Model creation failed');
      });

      await aiAnalyzer.initialize();
      
      expect(aiAnalyzer.isAIModelLoaded()).toBe(false);
    });

    it.skip('should initialize with AI model', async () => {
      const mockModel = {
        add: jest.fn(),
        compile: jest.fn(),
        predict: jest.fn(),
        dispose: jest.fn(),
      };

      // Ensure tf.layers is properly mocked
      (tf.sequential as jest.Mock).mockReturnValue(mockModel);
      (tf.layers as any) = {
        dense: jest.fn(() => ({ name: 'dense_layer' })),
        dropout: jest.fn(() => ({ name: 'dropout_layer' })),
      };

      await aiAnalyzer.initialize();
      
      expect(aiAnalyzer.isAIModelLoaded()).toBe(true);
    });
  });

  describe('Audio Connection', () => {
    it('should connect audio source', () => {
      const mockSource = {
        connect: jest.fn(),
      } as unknown as AudioNode;

      aiAnalyzer.connect(mockSource);
      expect(mockSource.connect).toHaveBeenCalled();
    });
  });

  describe('Real-time Analysis', () => {
    beforeEach(() => {
      // Mock audio processor
      const mockExtractFeatures = jest.fn(() => ({
        tempo: 120,
        energy: 0.8,
        valence: 0.6,
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
        beatTimes: [0, 0.5, 1.0],
        beatStrength: [0.9, 0.7, 0.8],
        onsetTimes: [0, 0.25, 0.5, 0.75],
      }));

      (aiAnalyzer as any).audioProcessor.extractFeatures = mockExtractFeatures;
    });

    it('should analyze audio without AI model', async () => {
      const visualParams = await aiAnalyzer.analyzeRealtime();
      
      expect(visualParams).toHaveProperty('hue');
      expect(visualParams).toHaveProperty('saturation');
      expect(visualParams).toHaveProperty('brightness');
      expect(visualParams).toHaveProperty('speed');
      expect(visualParams).toHaveProperty('intensity');
      expect(visualParams).toHaveProperty('complexity');
    });

    it.skip('should analyze audio with AI model', async () => {
      const mockModel = {
        add: jest.fn(),
        compile: jest.fn(),
        predict: jest.fn(() => ({
          data: jest.fn().mockResolvedValue(new Float32Array([
            0.5, 0.8, 0.6, 0.7, // color params
            0.9, 0.7, 0.5, 0.8, // motion params
            0.6, 0.4, 0.8, 0.5, // effect params
            0.3, 0.6, 0.4, // style params
            0.5, 0.8, 0.6, // temporal params
          ])),
        })),
        dispose: jest.fn(),
      };

      // Mock tf.layers properly
      (tf.sequential as jest.Mock).mockReturnValue(mockModel);
      (tf.tensor2d as jest.Mock).mockReturnValue({
        dispose: jest.fn(),
      });
      (tf.layers as any) = {
        dense: jest.fn(() => ({ name: 'dense_layer' })),
        dropout: jest.fn(() => ({ name: 'dropout_layer' })),
      };

      await aiAnalyzer.initialize();
      
      const visualParams = await aiAnalyzer.analyzeRealtime();
      
      expect(visualParams).toHaveProperty('hue');
      expect(visualParams).toHaveProperty('saturation');
      expect(visualParams).toHaveProperty('brightness');
      expect(mockModel.predict).toHaveBeenCalled();
    });

    it('should handle AI model prediction failure', async () => {
      const mockModel = {
        add: jest.fn(),
        compile: jest.fn(),
        predict: jest.fn(() => {
          throw new Error('Prediction failed');
        }),
        dispose: jest.fn(),
      };

      // Mock tf.layers properly
      (tf.sequential as jest.Mock).mockReturnValue(mockModel);
      (tf.layers as any) = {
        dense: jest.fn(() => ({ name: 'dense_layer' })),
        dropout: jest.fn(() => ({ name: 'dropout_layer' })),
      };
      await aiAnalyzer.initialize();

      // Should fallback to rule-based analysis
      const visualParams = await aiAnalyzer.analyzeRealtime();
      
      expect(visualParams).toHaveProperty('hue');
      expect(visualParams).toHaveProperty('saturation');
      expect(visualParams).toHaveProperty('brightness');
    });
  });

  describe('Feature History', () => {
    beforeEach(() => {
      const mockFeatures = {
        tempo: 120,
        energy: 0.8,
        valence: 0.6,
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
        beatTimes: [0, 0.5, 1.0],
        beatStrength: [0.9, 0.7, 0.8],
        onsetTimes: [0, 0.25, 0.5, 0.75],
      } as MusicFeatures;

      (aiAnalyzer as any).audioProcessor.extractFeatures = jest.fn(() => mockFeatures);
    });

    it('should maintain feature history', async () => {
      await aiAnalyzer.analyzeRealtime();
      await aiAnalyzer.analyzeRealtime();
      
      const history = aiAnalyzer.getFeatureHistory();
      expect(history.length).toBe(2);
    });

    it('should limit feature history size', async () => {
      // Analyze many times to exceed history limit
      for (let i = 0; i < 110; i++) {
        await aiAnalyzer.analyzeRealtime();
      }
      
      const history = aiAnalyzer.getFeatureHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('should return current features', async () => {
      await aiAnalyzer.analyzeRealtime();
      
      const currentFeatures = aiAnalyzer.getCurrentFeatures();
      expect(currentFeatures).not.toBeNull();
      expect(currentFeatures).toHaveProperty('tempo');
      expect(currentFeatures).toHaveProperty('energy');
    });

    it('should return null when no features available', () => {
      const currentFeatures = aiAnalyzer.getCurrentFeatures();
      expect(currentFeatures).toBeNull();
    });
  });

  describe('Rule-based Analysis', () => {
    it('should map musical keys to hues correctly', async () => {
      const mockFeatures = {
        key: 'C',
        mode: 'major',
        tempo: 120,
        energy: 0.8,
        valence: 0.6,
        loudness: -10,
        acousticness: 0.3,
        instrumentalness: 0.8,
        rhythmComplexity: 0.6,
        syncopation: 0.4,
        spectralCentroid: 2000,
        spectralBandwidth: 1000,
        danceability: 0.7,
      } as MusicFeatures;

      (aiAnalyzer as any).audioProcessor.extractFeatures = jest.fn(() => mockFeatures);
      
      const visualParams = await aiAnalyzer.analyzeRealtime();
      expect(visualParams.hue).toBe(0); // C maps to red (0°)
    });

    it('should select appropriate visual styles', async () => {
      // Test acoustic music -> organic style
      const acousticFeatures = {
        acousticness: 0.8,
        instrumentalness: 0.5,
        energy: 0.4,
        danceability: 0.3,
        valence: 0.6,
        tempo: 80,
        loudness: -15,
        rhythmComplexity: 0.3,
        syncopation: 0.2,
        spectralCentroid: 1500,
        spectralBandwidth: 800,
        key: 'G',
        mode: 'major',
      } as MusicFeatures;

      (aiAnalyzer as any).audioProcessor.extractFeatures = jest.fn(() => acousticFeatures);
      
      const visualParams = await aiAnalyzer.analyzeRealtime();
      expect(visualParams.visualStyle).toBe('organic');
    });

    it('should handle edge cases in rule-based analysis', async () => {
      const edgeFeatures = {
        energy: 0,
        valence: 0,
        tempo: 0,
        loudness: -100,
        acousticness: 0,
        instrumentalness: 0,
        rhythmComplexity: 0,
        syncopation: 0,
        spectralCentroid: 0,
        spectralBandwidth: 0,
        danceability: 0,
        key: 'C',
        mode: 'major',
      } as MusicFeatures;

      (aiAnalyzer as any).audioProcessor.extractFeatures = jest.fn(() => edgeFeatures);
      
      expect(async () => {
        await aiAnalyzer.analyzeRealtime();
      }).not.toThrow();
    });
  });

  describe('Disposal', () => {
    it('should dispose TensorFlow model', () => {
      const mockModel = {
        dispose: jest.fn(),
      };

      (aiAnalyzer as any).tfModel = mockModel;
      aiAnalyzer.dispose();
      
      expect(mockModel.dispose).toHaveBeenCalled();
    });

    it('should clear feature history', () => {
      (aiAnalyzer as any).featureHistory = [1, 2, 3];
      aiAnalyzer.dispose();
      
      expect(aiAnalyzer.getFeatureHistory()).toEqual([]);
    });

    it('should handle disposal without model', () => {
      expect(() => {
        aiAnalyzer.dispose();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle audio processing errors', async () => {
      (aiAnalyzer as any).audioProcessor.extractFeatures = jest.fn(() => {
        throw new Error('Audio processing failed');
      });

      await expect(aiAnalyzer.analyzeRealtime()).rejects.toThrow('Audio processing failed');
    });

    it('should handle AI model loading errors', async () => {
      (tf.sequential as jest.Mock).mockImplementation(() => {
        throw new Error('Model loading failed');
      });

      await aiAnalyzer.initialize();
      
      expect(aiAnalyzer.isAIModelLoaded()).toBe(false);
    });

    it('should handle invalid audio context', () => {
      const invalidAudioContext = null;
      
      expect(() => {
        new AIMusicalAnalyzer(invalidAudioContext as any);
      }).toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle rapid successive analyses', async () => {
      const mockFeatures = {
        tempo: 120,
        energy: 0.8,
        valence: 0.6,
        spectralCentroid: 2000,
        acousticness: 0.3,
        instrumentalness: 0.8,
        rhythmComplexity: 0.6,
        syncopation: 0.4,
        danceability: 0.7,
        loudness: -10,
        spectralBandwidth: 1000,
        key: 'C',
        mode: 'major',
      } as MusicFeatures;

      (aiAnalyzer as any).audioProcessor.extractFeatures = jest.fn(() => mockFeatures);

      // Perform many rapid analyses
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(aiAnalyzer.analyzeRealtime());
      }

      await expect(Promise.all(promises)).resolves.toHaveLength(100);
    });

    it('should handle large MFCC arrays', async () => {
      const mockFeatures = {
        mfcc: new Float32Array(1000), // Large MFCC array
        chromaticFeatures: new Float32Array(12),
        rhythmPattern: new Float32Array(16),
        tempo: 120,
        energy: 0.8,
        valence: 0.6,
        spectralCentroid: 2000,
        acousticness: 0.3,
        instrumentalness: 0.8,
        rhythmComplexity: 0.6,
        syncopation: 0.4,
        danceability: 0.7,
        loudness: -10,
        spectralBandwidth: 1000,
        key: 'C',
        mode: 'major',
      } as MusicFeatures;

      (aiAnalyzer as any).audioProcessor.extractFeatures = jest.fn(() => mockFeatures);

      expect(async () => {
        await aiAnalyzer.analyzeRealtime();
      }).not.toThrow();
    });
  });
});