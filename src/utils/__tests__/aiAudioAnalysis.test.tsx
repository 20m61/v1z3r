/**
 * Tests for AI Audio Analysis System
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  AIAudioAnalysis,
  useAIAudioAnalysis,
  type AudioAnalysis,
  type SpectralFeatures,
  type BPMDetectionResult,
  type MusicGenre,
  type MusicalKey,
  type EmotionalState,
  type InstrumentType,
  type TempoType,
} from '../aiAudioAnalysis';

// Mock Web Audio API
class MockAudioContext {
  sampleRate = 44100;
  destination = {} as AudioDestinationNode;
  
  createAnalyser() {
    return {
      fftSize: 2048,
      frequencyBinCount: 1024,
      smoothingTimeConstant: 0.8,
      getByteFrequencyData: jest.fn(),
      getByteTimeDomainData: jest.fn(),
    } as unknown as AnalyserNode;
  }
  
  createGain() {
    return {
      gain: { value: 1.0 },
      connect: jest.fn(),
    } as unknown as GainNode;
  }
  
  createMediaStreamSource(stream: MediaStream) {
    return {
      connect: jest.fn(),
    } as unknown as MediaStreamAudioSourceNode;
  }
  
  close() {
    return Promise.resolve();
  }
}

// Mock navigator.mediaDevices
const mockGetUserMedia = jest.fn();
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
  },
  writable: true,
});

// Mock requestAnimationFrame
let animationFrameCallback: (() => void) | null = null;
global.requestAnimationFrame = jest.fn((callback) => {
  animationFrameCallback = callback;
  return 1;
});

describe('AI Audio Analysis', () => {
  let originalAudioContext: typeof AudioContext;
  let mockStream: MediaStream;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Mock AudioContext
    originalAudioContext = global.AudioContext;
    (global as any).AudioContext = MockAudioContext;
    
    // Mock MediaStream
    mockStream = {
      getTracks: jest.fn(() => []),
      getAudioTracks: jest.fn(() => []),
      getVideoTracks: jest.fn(() => []),
      active: true,
    } as unknown as MediaStream;
    
    mockGetUserMedia.mockResolvedValue(mockStream);
    
    animationFrameCallback = null;
  });

  afterEach(() => {
    jest.useRealTimers();
    global.AudioContext = originalAudioContext;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('AIAudioAnalysis Class', () => {
    let analyzer: AIAudioAnalysis;

    beforeEach(() => {
      analyzer = new AIAudioAnalysis();
    });

    afterEach(() => {
      analyzer.dispose();
    });

    describe('Initialization', () => {
      it('should initialize with microphone input', async () => {
        await analyzer.initialize();

        expect(mockGetUserMedia).toHaveBeenCalledWith({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        expect(consoleLogSpy).toHaveBeenCalledWith('[AIAudio] Audio analysis initialized');
      });

      it('should initialize with external audio stream', async () => {
        await analyzer.initialize(mockStream);

        expect(mockGetUserMedia).not.toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith('[AIAudio] Audio analysis initialized');
      });

      it('should handle initialization errors', async () => {
        mockGetUserMedia.mockRejectedValue(new Error('Microphone access denied'));

        await expect(analyzer.initialize()).rejects.toThrow('Microphone access denied');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[AIAudio] Initialization failed:',
          expect.any(Error)
        );
      });
    });

    describe('Analysis Control', () => {
      beforeEach(async () => {
        await analyzer.initialize(mockStream);
      });

      it('should start analysis', () => {
        analyzer.startAnalysis();

        // Analysis should set isAnalyzing flag
        expect((analyzer as any).isAnalyzing).toBe(true);
      });

      it('should stop analysis', () => {
        analyzer.startAnalysis();
        analyzer.stopAnalysis();

        // Analysis should clear isAnalyzing flag
        expect((analyzer as any).isAnalyzing).toBe(false);
      });

      it('should not start analysis if already analyzing', () => {
        analyzer.startAnalysis();
        expect((analyzer as any).isAnalyzing).toBe(true);
        
        // Try to start again - should not change state
        analyzer.startAnalysis();
        expect((analyzer as any).isAnalyzing).toBe(true);
      });

      it('should not start analysis without initialization', () => {
        const uninitializedAnalyzer = new AIAudioAnalysis();
        uninitializedAnalyzer.startAnalysis();

        expect((uninitializedAnalyzer as any).isAnalyzing).toBe(false);
        
        uninitializedAnalyzer.dispose();
      });
    });

    describe('Callback System', () => {
      beforeEach(async () => {
        await analyzer.initialize(mockStream);
      });

      it('should register analysis callback', () => {
        const mockCallback = jest.fn();
        analyzer.onAnalysis(mockCallback);

        analyzer.startAnalysis();
        
        // Trigger analysis frame
        if (animationFrameCallback) {
          animationFrameCallback();
        }

        expect(mockCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            genre: expect.any(String),
            bpm: expect.any(Number),
            key: expect.any(String),
            mood: expect.any(String),
            instruments: expect.any(Array),
            energy: expect.any(Number),
            tempo: expect.any(String),
            dynamics: expect.any(Number),
            timestamp: expect.any(Number),
          })
        );
      });
    });

    describe('Resource Management', () => {
      it('should dispose resources properly', async () => {
        await analyzer.initialize(mockStream);
        analyzer.startAnalysis();

        const mockClose = jest.fn().mockResolvedValue(undefined);
        (analyzer as any).audioContext.close = mockClose;

        analyzer.dispose();

        expect(mockClose).toHaveBeenCalled();
      });

      it('should handle dispose without initialization', () => {
        expect(() => analyzer.dispose()).not.toThrow();
      });
    });
  });

  describe('Audio Analysis Features', () => {
    let analyzer: AIAudioAnalysis;

    beforeEach(async () => {
      analyzer = new AIAudioAnalysis();
      await analyzer.initialize(mockStream);
      
      // Mock frequency and time domain data
      const mockFrequencyData = new Uint8Array(1024).fill(128);
      const mockTimeData = new Uint8Array(1024).fill(128);
      
      (analyzer as any).frequencyData = mockFrequencyData;
      (analyzer as any).timeData = mockTimeData;
      (analyzer as any).analyserNode = {
        getByteFrequencyData: jest.fn((data) => {
          for (let i = 0; i < data.length; i++) {
            data[i] = mockFrequencyData[i];
          }
        }),
        getByteTimeDomainData: jest.fn((data) => {
          for (let i = 0; i < data.length; i++) {
            data[i] = mockTimeData[i];
          }
        }),
      };
    });

    afterEach(() => {
      analyzer.dispose();
    });

    describe('Spectral Features', () => {
      it('should extract spectral features', () => {
        const features = (analyzer as any).extractSpectralFeatures();

        expect(features).toEqual({
          centroid: expect.any(Number),
          rolloff: expect.any(Number),
          flux: expect.any(Number),
          mfcc: expect.arrayContaining([expect.any(Number)]),
          chroma: expect.arrayContaining([expect.any(Number)]),
          tonnetz: expect.arrayContaining([expect.any(Number)]),
        });
        
        expect(features.mfcc).toHaveLength(13);
        expect(features.chroma).toHaveLength(12);
        expect(features.tonnetz).toHaveLength(6);
      });

      it('should handle missing frequency data', () => {
        (analyzer as any).frequencyData = null;
        const features = (analyzer as any).extractSpectralFeatures();

        expect(features).toEqual({
          centroid: 0,
          rolloff: 0,
          flux: 0,
          mfcc: new Array(13).fill(0),
          chroma: new Array(12).fill(0),
          tonnetz: new Array(6).fill(0),
        });
      });

      it('should maintain spectral history', () => {
        (analyzer as any).extractSpectralFeatures();
        (analyzer as any).extractSpectralFeatures();

        const history = (analyzer as any).spectralHistory;
        expect(history).toHaveLength(2);
      });

      it('should limit spectral history to 100 frames', () => {
        for (let i = 0; i < 105; i++) {
          (analyzer as any).extractSpectralFeatures();
        }

        const history = (analyzer as any).spectralHistory;
        expect(history).toHaveLength(100);
      });
    });

    describe('BPM Detection', () => {
      it('should detect BPM with default values', () => {
        const result = (analyzer as any).detectBPM();

        expect(result).toEqual({
          bpm: expect.any(Number),
          confidence: expect.any(Number),
          beats: expect.any(Array),
          tempo: expect.any(String),
        });
      });

      it('should handle missing time data', () => {
        (analyzer as any).timeData = null;
        const result = (analyzer as any).detectBPM();

        expect(result).toEqual({
          bpm: 120,
          confidence: 0,
          beats: [],
          tempo: 'medium',
        });
      });

      it('should classify tempo correctly', () => {
        const testCases = [
          { bpm: 70, expectedTempo: 'slow' },
          { bpm: 100, expectedTempo: 'medium' },
          { bpm: 140, expectedTempo: 'fast' },
          { bpm: 180, expectedTempo: 'very-fast' },
        ];

        testCases.forEach(({ bpm, expectedTempo }) => {
          (analyzer as any).bpmBuffer = [bpm, bpm, bpm, bpm];
          const result = (analyzer as any).detectBPM();
          expect(result.tempo).toBe(expectedTempo);
        });
      });
    });

    describe('Musical Key Detection', () => {
      it('should detect musical key from chroma features', () => {
        const mockFeatures: SpectralFeatures = {
          centroid: 1000,
          rolloff: 5000,
          flux: 0.5,
          mfcc: new Array(13).fill(0),
          chroma: [0.8, 0.1, 0.2, 0.1, 0.3, 0.2, 0.1, 0.4, 0.1, 0.2, 0.1, 0.2],
          tonnetz: new Array(6).fill(0),
        };

        const key = (analyzer as any).detectMusicalKey(mockFeatures);
        expect(typeof key).toBe('string');
      });

      it('should return unknown for insufficient chroma data', () => {
        const mockFeatures: SpectralFeatures = {
          centroid: 1000,
          rolloff: 5000,
          flux: 0.5,
          mfcc: new Array(13).fill(0),
          chroma: [0.1, 0.1], // Only 2 elements instead of 12
          tonnetz: new Array(6).fill(0),
        };

        const key = (analyzer as any).detectMusicalKey(mockFeatures);
        expect(key).toBe('unknown');
      });
    });

    describe('Energy and Dynamics Calculation', () => {
      it('should calculate energy correctly', () => {
        const energy = (analyzer as any).calculateEnergy();
        expect(energy).toBeGreaterThanOrEqual(0);
        expect(energy).toBeLessThanOrEqual(1);
      });

      it('should calculate dynamics correctly', () => {
        const dynamics = (analyzer as any).calculateDynamics();
        expect(dynamics).toBeGreaterThanOrEqual(0);
        expect(dynamics).toBeLessThanOrEqual(1);
      });

      it('should handle missing data', () => {
        (analyzer as any).frequencyData = null;
        const energy = (analyzer as any).calculateEnergy();
        expect(energy).toBe(0);

        (analyzer as any).timeData = null;
        const dynamics = (analyzer as any).calculateDynamics();
        expect(dynamics).toBe(0);
      });
    });

    describe('Onset Detection', () => {
      it('should detect onset based on spectral flux', () => {
        // Add some spectral history first
        for (let i = 0; i < 10; i++) {
          (analyzer as any).extractSpectralFeatures();
        }

        const onset = (analyzer as any).detectOnset();
        expect(typeof onset).toBe('boolean');
      });

      it('should return false with insufficient history', () => {
        const onset = (analyzer as any).detectOnset();
        expect(onset).toBe(false);
      });

      it('should return false with missing frequency data', () => {
        (analyzer as any).frequencyData = null;
        const onset = (analyzer as any).detectOnset();
        expect(onset).toBe(false);
      });
    });
  });

  describe('Audio Analysis Helper Classes', () => {
    let testAnalyzer: AIAudioAnalysis;

    beforeEach(async () => {
      testAnalyzer = new AIAudioAnalysis();
      await testAnalyzer.initialize(mockStream);
    });

    afterEach(() => {
      testAnalyzer.dispose();
    });

    describe('GenreClassifier', () => {
      it('should classify house music', () => {
        const features: SpectralFeatures = {
          centroid: 2500,
          rolloff: 5000,
          flux: 0.5,
          mfcc: new Array(13).fill(0),
          chroma: new Array(12).fill(0),
          tonnetz: new Array(6).fill(0),
        };
        const bpm: BPMDetectionResult = { bpm: 128, confidence: 0.8, beats: [], tempo: 'fast' };

        const classifier = (testAnalyzer as any).genreClassifier;
        const genre = classifier.classify(features, bpm);
        expect(genre).toBe('house');
      });

      it('should classify techno music', () => {
        const features: SpectralFeatures = {
          centroid: 1500,
          rolloff: 5000,
          flux: 0.5,
          mfcc: new Array(13).fill(0),
          chroma: new Array(12).fill(0),
          tonnetz: new Array(6).fill(0),
        };
        const bpm: BPMDetectionResult = { bpm: 145, confidence: 0.8, beats: [], tempo: 'fast' };

        const classifier = (testAnalyzer as any).genreClassifier;
        const genre = classifier.classify(features, bpm);
        expect(genre).toBe('techno');
      });

      it('should classify low BPM music as ambient', () => {
        const features: SpectralFeatures = {
          centroid: 1000,
          rolloff: 3000,
          flux: 0.5,
          mfcc: new Array(13).fill(0),
          chroma: new Array(12).fill(0),
          tonnetz: new Array(6).fill(0),
        };
        const bpm: BPMDetectionResult = { bpm: 95, confidence: 0.5, beats: [], tempo: 'medium' };

        const classifier = (testAnalyzer as any).genreClassifier;
        const genre = classifier.classify(features, bpm);
        expect(genre).toBe('ambient');
      });
    });

    describe('InstrumentDetector', () => {
      it('should detect bass and kick instruments', () => {
        const features: SpectralFeatures = {
          centroid: 800,
          rolloff: 3000,
          flux: 0.5,
          mfcc: [-2, -4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Low MFCC[1]
          chroma: new Array(12).fill(0),
          tonnetz: new Array(6).fill(0),
        };

        const detector = (testAnalyzer as any).instrumentDetector;
        const instruments = detector.detect(features);
        expect(instruments).toContain('kick');
        expect(instruments).toContain('bass');
      });

      it('should detect high frequency instruments', () => {
        const features: SpectralFeatures = {
          centroid: 3500,
          rolloff: 9000,
          flux: 0.5,
          mfcc: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          chroma: new Array(12).fill(0),
          tonnetz: new Array(6).fill(0),
        };

        const detector = (testAnalyzer as any).instrumentDetector;
        const instruments = detector.detect(features);
        expect(instruments).toContain('hihat');
      });
    });

    describe('EmotionAnalyzer', () => {
      it('should detect energetic emotion', () => {
        const features: SpectralFeatures = {
          centroid: 3000,
          rolloff: 8000,
          flux: 0.5,
          mfcc: new Array(13).fill(0),
          chroma: new Array(12).fill(0),
          tonnetz: new Array(6).fill(0),
        };
        const bpm: BPMDetectionResult = { bpm: 150, confidence: 0.8, beats: [], tempo: 'fast' };

        const emotionAnalyzer = (testAnalyzer as any).emotionAnalyzer;
        const emotion = emotionAnalyzer.analyze(features, bpm);
        expect(emotion).toBe('energetic');
      });

      it('should detect calm emotion', () => {
        const features: SpectralFeatures = {
          centroid: 800,
          rolloff: 3000,
          flux: 0.2,
          mfcc: new Array(13).fill(0),
          chroma: new Array(12).fill(0),
          tonnetz: new Array(6).fill(0),
        };
        const bpm: BPMDetectionResult = { bpm: 70, confidence: 0.2, beats: [], tempo: 'slow' };

        const emotionAnalyzer = (testAnalyzer as any).emotionAnalyzer;
        const emotion = emotionAnalyzer.analyze(features, bpm);
        expect(emotion).toBe('calm');
      });
    });
  });

  describe('Mathematical Helper Functions', () => {
    let mathAnalyzer: AIAudioAnalysis;

    beforeEach(async () => {
      mathAnalyzer = new AIAudioAnalysis();
      await mathAnalyzer.initialize(mockStream);
    });

    afterEach(() => {
      mathAnalyzer.dispose();
    });

    it('should calculate spectral centroid', () => {
      const spectrum = [10, 20, 30, 40, 30, 20, 10];
      const sampleRate = 44100;
      const centroid = (mathAnalyzer as any).calculateSpectralCentroid(spectrum, sampleRate);
      
      expect(centroid).toBeGreaterThan(0);
      expect(typeof centroid).toBe('number');
    });

    it('should calculate spectral rolloff', () => {
      const spectrum = [10, 20, 30, 40, 30, 20, 10];
      const sampleRate = 44100;
      const rolloff = (mathAnalyzer as any).calculateSpectralRolloff(spectrum, sampleRate);
      
      expect(rolloff).toBeGreaterThan(0);
      expect(rolloff).toBeLessThanOrEqual(sampleRate / 2);
    });

    it('should calculate correlation', () => {
      const a = [1, 2, 3, 4, 5];
      const b = [2, 4, 6, 8, 10];
      const correlation = (mathAnalyzer as any).calculateCorrelation(a, b);
      
      expect(correlation).toBeCloseTo(1, 1); // Perfect positive correlation
    });

    it('should handle zero correlation', () => {
      const a = [1, 2, 3, 4, 5];
      const b = [5, 4, 3, 2, 1];
      const correlation = (mathAnalyzer as any).calculateCorrelation(a, b);
      
      expect(correlation).toBeCloseTo(-1, 1); // Perfect negative correlation
    });

    it('should handle mismatched array lengths', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3, 4, 5];
      const correlation = (mathAnalyzer as any).calculateCorrelation(a, b);
      
      expect(correlation).toBe(0);
    });
  });

  describe('useAIAudioAnalysis Hook', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useAIAudioAnalysis());

      expect(result.current.analysis).toBeNull();
      expect(result.current.isAnalyzing).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.startAnalysis).toBe('function');
      expect(typeof result.current.stopAnalysis).toBe('function');
    });

    it('should start analysis successfully', async () => {
      const { result } = renderHook(() => useAIAudioAnalysis());

      await act(async () => {
        await result.current.startAnalysis();
      });

      expect(result.current.isAnalyzing).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should handle analysis errors', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Microphone denied'));
      const { result } = renderHook(() => useAIAudioAnalysis());

      await act(async () => {
        await result.current.startAnalysis();
      });

      expect(result.current.isAnalyzing).toBe(false);
      expect(result.current.error).toBe('Microphone denied');
    });

    it('should stop analysis', async () => {
      const { result } = renderHook(() => useAIAudioAnalysis());

      await act(async () => {
        await result.current.startAnalysis();
      });

      act(() => {
        result.current.stopAnalysis();
      });

      expect(result.current.isAnalyzing).toBe(false);
    });

    it('should cleanup on unmount', () => {
      const { unmount } = renderHook(() => useAIAudioAnalysis());

      expect(() => unmount()).not.toThrow();
    });
  });
});