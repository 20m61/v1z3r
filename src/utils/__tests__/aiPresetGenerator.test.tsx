/**
 * Tests for AI Preset Generation System
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  AIPresetGenerator,
  useAIPresetGenerator,
  type TrackAnalysis,
  type PresetConfig,
  type VJStyle,
  type UserFeedback,
  type VJSession,
  type SpectralAnalysis,
  type StructuralAnalysis,
  type StyleAnalysis,
  type MusicSection,
  type ColorConfig,
  type EffectConfig,
} from '../aiPresetGenerator';

// Mock console methods
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
// Don't mock console.error to avoid conflicts with setupTests.ts
const consoleErrorSpy = jest.spyOn(console, 'error');

// Mock AudioBuffer
class MockAudioBuffer implements AudioBuffer {
  sampleRate = 44100;
  length = 1000000;
  duration = 22.68; // ~22.68 seconds
  numberOfChannels = 2;
  
  getChannelData(channel: number): Float32Array {
    return new Float32Array(this.length).map(() => Math.random() * 2 - 1);
  }
  
  copyFromChannel(
    destination: Float32Array,
    channelNumber: number,
    startInChannel?: number
  ): void {
    const data = this.getChannelData(channelNumber);
    for (let i = 0; i < destination.length; i++) {
      destination[i] = data[i + (startInChannel || 0)];
    }
  }
  
  copyToChannel(
    source: Float32Array,
    channelNumber: number,
    startInChannel?: number
  ): void {
    // Not implemented for tests
  }
}

describe('AI Preset Generator', () => {
  let generator: AIPresetGenerator;
  let mockAudioBuffer: AudioBuffer;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new AIPresetGenerator();
    mockAudioBuffer = new MockAudioBuffer();
    consoleErrorSpy.mockClear();
  });

  describe('AIPresetGenerator Class', () => {
    describe('Constructor', () => {
      it('should create instance with default styles', () => {
        expect(generator).toBeInstanceOf(AIPresetGenerator);
        const styles = (generator as any).vjStyles;
        expect(styles.size).toBeGreaterThan(0);
        expect(styles.has('Electronic Minimal')).toBe(true);
        expect(styles.has('Psychedelic Flow')).toBe(true);
        expect(styles.has('Techno Industrial')).toBe(true);
      });

      it('should initialize learning model', () => {
        const learningModel = (generator as any).learningModel;
        expect(learningModel).toBeDefined();
      });
    });

    describe('Track Analysis', () => {
      it('should analyze track successfully', async () => {
        const analysis = await generator.analyzeTrack(mockAudioBuffer);

        expect(analysis).toMatchObject({
          audio: expect.objectContaining({
            genre: expect.any(String),
            bpm: expect.any(Number),
            key: expect.any(String),
            mood: expect.any(String),
            instruments: expect.any(Array),
            energy: expect.any(Number),
            tempo: expect.any(String),
            dynamics: expect.any(Number),
            timestamp: expect.any(Number),
          }),
          spectral: expect.objectContaining({
            frequencyDistribution: expect.any(Array),
            harmonics: expect.any(Array),
            noiseLevel: expect.any(Number),
            dynamicRange: expect.any(Number),
            spectralBalance: expect.objectContaining({
              bass: expect.any(Number),
              midLow: expect.any(Number),
              midHigh: expect.any(Number),
              treble: expect.any(Number),
            }),
          }),
          structure: expect.objectContaining({
            sections: expect.any(Array),
            transitions: expect.any(Array),
            duration: expect.any(Number),
          }),
          style: expect.objectContaining({
            primaryGenre: expect.any(String),
            energyLevel: expect.any(Number),
            danceability: expect.any(Number),
            experimentalFactor: expect.any(Number),
          }),
          complexity: expect.any(Number),
          timestamp: expect.any(Number),
        });
      });

      it('should maintain analysis history', async () => {
        const history = (generator as any).analysisHistory;
        const initialLength = history.length;

        await generator.analyzeTrack(mockAudioBuffer);
        expect(history.length).toBe(initialLength + 1);

        await generator.analyzeTrack(mockAudioBuffer);
        expect(history.length).toBe(initialLength + 2);
      });

      it('should limit analysis history to 100 items', async () => {
        const history = (generator as any).analysisHistory;
        
        // Clear history first
        history.length = 0;
        
        // Fill history to almost full
        for (let i = 0; i < 99; i++) {
          history.push({} as TrackAnalysis);
        }

        await generator.analyzeTrack(mockAudioBuffer);
        expect(history.length).toBe(100);
        
        // Add one more and check it maintains 100
        await generator.analyzeTrack(mockAudioBuffer);
        expect(history.length).toBe(100);
      });

      it('should handle analysis errors', async () => {
        const badBuffer = {} as AudioBuffer;
        
        await expect(generator.analyzeTrack(badBuffer)).rejects.toThrow();
      });
    });

    describe('Preset Generation', () => {
      let mockAnalysis: TrackAnalysis;

      beforeEach(() => {
        mockAnalysis = {
          audio: {
            genre: 'electronic',
            bpm: 128,
            key: 'C',
            mood: 'energetic',
            instruments: ['kick', 'bass', 'lead'],
            energy: 0.8,
            tempo: 'medium',
            dynamics: 0.7,
            timestamp: Date.now(),
          },
          spectral: {
            frequencyDistribution: [],
            harmonics: [],
            noiseLevel: 0.1,
            dynamicRange: 0.8,
            spectralBalance: {
              bass: 0.3,
              midLow: 0.25,
              midHigh: 0.25,
              treble: 0.2,
            },
          },
          structure: {
            sections: [],
            transitions: [],
            repetitions: [],
            buildUps: [],
            drops: [],
            duration: 180,
          },
          style: {
            primaryGenre: 'electronic',
            subGenres: ['house'],
            era: '2020s',
            influences: [],
            moodTags: ['energetic'],
            energyLevel: 0.8,
            danceability: 0.9,
            experimentalFactor: 0.3,
          },
          complexity: 0.7,
          timestamp: Date.now(),
        };
      });

      it('should generate preset from analysis', () => {
        const preset = generator.generatePreset(mockAnalysis);

        expect(preset).toMatchObject({
          id: expect.stringMatching(/^preset_/),
          name: expect.stringContaining('AI Generated'),
          description: expect.any(String),
          effects: expect.any(Array),
          colors: expect.objectContaining({
            palette: expect.any(Array),
            mode: expect.any(String),
            saturation: expect.any(Number),
            brightness: expect.any(Number),
          }),
          animations: expect.objectContaining({
            speed: expect.any(Number),
            complexity: expect.any(Number),
            smoothness: expect.any(Number),
          }),
          particles: expect.objectContaining({
            count: expect.any(Number),
            size: expect.any(Number),
            speed: expect.any(Number),
          }),
          audioReactivity: expect.objectContaining({
            sensitivity: expect.any(Number),
            frequencyRanges: expect.any(Object),
          }),
          beatSync: expect.objectContaining({
            enabled: expect.any(Boolean),
            mode: expect.any(String),
          }),
          performance: expect.objectContaining({
            quality: expect.any(String),
            targetFPS: expect.any(Number),
          }),
          metadata: expect.objectContaining({
            tags: expect.any(Array),
            genre: expect.any(Array),
            mood: expect.any(Array),
            energy: expect.any(Number),
            complexity: expect.any(Number),
          }),
        });
      });

      it('should use custom VJ style if provided', () => {
        const customStyle: VJStyle = {
          name: 'Custom Style',
          characteristics: {
            colorPreference: ['#ff0000', '#00ff00'],
            effectTypes: ['custom'],
            animationStyle: 'smooth',
            complexity: 0.5,
            beatSyncPreference: 1.0,
            experimentalTendency: 0.7,
          },
          preferences: {
            primaryColors: ['#ff0000', '#00ff00'],
            secondaryColors: ['#ffff00'],
            avoidColors: [],
            preferredEffects: ['custom-effect'],
            avoidEffects: [],
            animationSpeed: 1.0,
            particleDensity: 0.5,
          },
          templates: [],
        };

        const preset = generator.generatePreset(mockAnalysis, customStyle);
        
        expect(preset.colors.palette).toEqual(customStyle.preferences.primaryColors);
        expect(preset.effects.some(e => e.type === 'custom-effect')).toBe(true);
      });

      it('should select optimal style automatically', () => {
        const preset = generator.generatePreset(mockAnalysis);
        
        expect(preset.name).toContain('electronic');
        expect(preset.metadata.genre).toContain('electronic');
      });

      it('should maintain preset history', () => {
        const history = (generator as any).presetHistory;
        const initialLength = history.length;

        generator.generatePreset(mockAnalysis);
        expect(history.length).toBe(initialLength + 1);
      });

      it('should limit preset history to 200 items', () => {
        const history = (generator as any).presetHistory;
        
        // Clear history first
        history.length = 0;
        
        // Fill history to almost full
        for (let i = 0; i < 199; i++) {
          history.push({} as PresetConfig);
        }

        generator.generatePreset(mockAnalysis);
        expect(history.length).toBe(200);
        
        // Add one more and check it maintains 200
        generator.generatePreset(mockAnalysis);
        expect(history.length).toBe(200);
      });

      it('should create fallback preset on error', () => {
        // Create a minimal valid analysis to avoid errors in fallback
        const badAnalysis: TrackAnalysis = {
          audio: {
            genre: 'unknown',
            bpm: 120,
            key: 'C',
            mood: 'neutral',
            instruments: [],
            energy: 0.5,
            tempo: 'medium',
            dynamics: 0.5,
            timestamp: Date.now(),
          },
          spectral: {
            frequencyDistribution: [],
            harmonics: [],
            noiseLevel: 0,
            dynamicRange: 0,
            spectralBalance: {
              bass: 0.25,
              midLow: 0.25,
              midHigh: 0.25,
              treble: 0.25,
            },
          },
          structure: {
            sections: [],
            transitions: [],
            repetitions: [],
            buildUps: [],
            drops: [],
            duration: 0,
          },
          style: {
            primaryGenre: 'unknown',
            subGenres: [],
            era: '2020s',
            influences: [],
            moodTags: [],
            energyLevel: 0.5,
            danceability: 0.5,
            experimentalFactor: 0.5,
          },
          complexity: 0.5,
          timestamp: Date.now(),
        };
        
        // Force an error by making selectOptimalStyle throw
        jest.spyOn(generator as any, 'selectOptimalStyle').mockImplementation(() => {
          throw new Error('Style selection failed');
        });
        
        const preset = generator.generatePreset(badAnalysis);
        
        expect(preset).toBeDefined();
        expect(preset.id).toMatch(/^preset_/);
      });
    });

    describe('Preset Optimization', () => {
      let mockPreset: PresetConfig;
      let mockFeedback: UserFeedback;

      beforeEach(() => {
        mockPreset = {
          id: 'test-preset',
          name: 'Test Preset',
          description: 'Test',
          effects: [],
          colors: {
            palette: ['#ff0000'],
            mode: 'static',
            saturation: 0.8,
            brightness: 0.7,
            contrast: 0.8,
            hueShift: 0,
            transition: {
              speed: 1,
              smoothness: 0.7,
              beatSync: true,
            },
          },
          animations: {
            speed: 1,
            complexity: 0.5,
            smoothness: 0.7,
            patterns: [],
            transitions: {
              type: 'fade',
              duration: 1000,
              easing: 'ease',
            },
          },
          particles: {
            count: 100,
            size: 0.5,
            speed: 1,
            lifetime: 2,
            behavior: 'random',
            audioReactive: true,
            physics: {
              gravity: 0.1,
              friction: 0.95,
              bounce: 0.3,
            },
          },
          audioReactivity: {
            sensitivity: 0.7,
            frequencyRanges: {
              bass: { min: 20, max: 250, weight: 0.4 },
              mid: { min: 250, max: 2000, weight: 0.3 },
              treble: { min: 2000, max: 20000, weight: 0.3 },
            },
            smoothing: 0.8,
            threshold: 0.1,
          },
          beatSync: {
            enabled: true,
            mode: 'auto',
            bpmLock: true,
            subdivision: 4,
            offset: 0,
            swing: 0,
          },
          performance: {
            quality: 'high',
            targetFPS: 60,
            adaptiveQuality: true,
            gpuAcceleration: true,
            memoryOptimization: true,
          },
          metadata: {
            tags: ['test'],
            genre: ['electronic'],
            mood: ['energetic'],
            energy: 0.8,
            complexity: 0.7,
            rating: 0,
            usage: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            author: 'test',
            version: '1.0',
          },
        };

        mockFeedback = {
          presetId: 'test-preset',
          rating: 4,
          liked: true,
          usageDuration: 300,
          modifications: {},
          context: {
            trackGenre: 'electronic',
            event: 'club',
            audience: 'dancers',
          },
          timestamp: Date.now(),
        };
      });

      it('should optimize preset based on positive feedback', () => {
        const optimized = generator.optimizePreset(mockPreset, mockFeedback);

        expect(optimized.metadata.rating).toBe(4);
        expect(optimized.metadata.updatedAt).toBeGreaterThanOrEqual(mockPreset.metadata.updatedAt);
      });

      it('should adjust preset for negative feedback', () => {
        mockFeedback.rating = 2;
        
        const optimized = generator.optimizePreset(mockPreset, mockFeedback);

        expect(optimized.metadata.rating).toBe(2);
        expect(optimized.colors).toBeDefined();
        expect(optimized.effects).toBeDefined();
      });

      it('should apply user modifications', () => {
        mockFeedback.modifications = {
          colors: { ...mockPreset.colors, saturation: 0.5 },
          animations: { ...mockPreset.animations, speed: 1.5 },
        };

        const optimized = generator.optimizePreset(mockPreset, mockFeedback);

        expect(optimized.colors.saturation).toBe(0.5);
        expect(optimized.animations.speed).toBe(1.5);
      });

      it('should handle optimization errors gracefully', () => {
        // Mock reinforceSuccessfulPattern to throw error
        jest.spyOn((generator as any).learningModel, 'reinforceSuccessfulPattern').mockImplementation(() => {
          throw new Error('Pattern reinforcement failed');
        });
        
        const result = generator.optimizePreset(mockPreset, mockFeedback);
        
        expect(result).toBe(mockPreset);
      });
    });

    describe('Learning from Usage', () => {
      it('should learn from VJ sessions', () => {
        const mockSessions: VJSession[] = [{
          id: 'session-1',
          duration: 3600,
          tracks: [],
          presets: [],
          transitions: [{
            fromPreset: 'preset-1',
            toPreset: 'preset-2',
            time: 100,
            duration: 2,
            type: 'fade',
            success: true,
          }],
          feedback: [{
            presetId: 'preset-1',
            rating: 5,
            liked: true,
            usageDuration: 300,
            modifications: {},
            context: {
              trackGenre: 'techno',
              event: 'club',
              audience: 'dancers',
            },
            timestamp: Date.now(),
          }],
          performance: {
            averageFPS: 60,
            memoryUsage: [100, 110, 120],
            cpuUsage: [30, 35, 40],
            audioLatency: 10,
            visualLatency: 16,
            errors: 0,
          },
          timestamp: Date.now(),
        }];

        generator.learnFromUsage(mockSessions);

        expect(consoleLogSpy).toHaveBeenCalledWith('[AIPreset] Learned from 1 sessions');
      });

      it('should handle learning errors gracefully', () => {
        // Mock analyzeSessionPatterns to throw error
        jest.spyOn(generator as any, 'analyzeSessionPatterns').mockImplementation(() => {
          throw new Error('Session analysis failed');
        });
        
        const validSessions: VJSession[] = [{
          id: 'session-1',
          duration: 3600,
          tracks: [],
          presets: [],
          transitions: [],
          feedback: [],
          performance: {
            averageFPS: 60,
            memoryUsage: [],
            cpuUsage: [],
            audioLatency: 10,
            visualLatency: 16,
            errors: 0,
          },
          timestamp: Date.now(),
        }];
        
        // Should not throw even with internal errors
        expect(() => generator.learnFromUsage(validSessions)).not.toThrow();
      });
    });

    describe('Helper Methods', () => {
      it('should calculate track complexity correctly', () => {
        const audio = {
          instruments: ['kick', 'bass', 'lead', 'pad'],
        } as any;
        const spectral = {
          harmonics: new Array(10).fill(0),
        } as SpectralAnalysis;
        const structural = {
          sections: new Array(5).fill({}),
        } as StructuralAnalysis;

        const complexity = (generator as any).calculateTrackComplexity(
          audio,
          spectral,
          structural
        );

        expect(complexity).toBeGreaterThan(0);
        expect(complexity).toBeLessThanOrEqual(1);
      });

      it('should calculate spectral balance', () => {
        const frequencyData = new Float32Array(1024).map((_, i) => Math.random());
        const sampleRate = 44100;

        const balance = (generator as any).calculateSpectralBalance(
          frequencyData,
          sampleRate
        );

        expect(balance.bass).toBeGreaterThanOrEqual(0);
        expect(balance.midLow).toBeGreaterThanOrEqual(0);
        expect(balance.midHigh).toBeGreaterThanOrEqual(0);
        expect(balance.treble).toBeGreaterThanOrEqual(0);
        
        const total = balance.bass + balance.midLow + balance.midHigh + balance.treble;
        expect(total).toBeCloseTo(1, 5);
      });

      it('should calculate noise level', () => {
        const channelData = new Float32Array(1000).map(() => Math.random() * 0.5);
        
        const noiseLevel = (generator as any).calculateNoiseLevel(channelData);
        
        expect(noiseLevel).toBeGreaterThan(0);
        expect(noiseLevel).toBeLessThan(1);
      });

      it('should calculate dynamic range', () => {
        const channelData = new Float32Array(1000).map(() => Math.random() * 2 - 1);
        
        const dynamicRange = (generator as any).calculateDynamicRange(channelData);
        
        expect(dynamicRange).toBeGreaterThan(0);
        expect(dynamicRange).toBeLessThanOrEqual(2);
      });
    });

    describe('Style Selection', () => {
      it('should select optimal style based on analysis', () => {
        const analysis = {
          style: {
            energyLevel: 0.8,
            experimentalFactor: 0.2,
          },
          audio: {
            bpm: 128,
          },
        } as TrackAnalysis;

        const style = (generator as any).selectOptimalStyle(analysis);
        
        expect(style).toBeDefined();
        expect(style.name).toBeDefined();
      });

      it('should calculate style compatibility', () => {
        const style = (generator as any).defaultStyles[0];
        const analysis = {
          style: {
            energyLevel: 0.8,
            experimentalFactor: 0.3,
          },
        } as TrackAnalysis;

        const score = (generator as any).calculateStyleCompatibility(style, analysis);
        
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    describe('Preset Configuration Generation', () => {
      let mockAnalysis: TrackAnalysis;
      let mockStyle: VJStyle;

      beforeEach(() => {
        mockAnalysis = {
          audio: {
            bpm: 128,
            genre: 'techno',
            mood: 'energetic',
            energy: 0.8,
          },
          style: {
            energyLevel: 0.8,
            primaryGenre: 'techno',
          },
          complexity: 0.7,
        } as TrackAnalysis;

        mockStyle = (generator as any).defaultStyles[0];
      });

      it('should generate effect configuration', () => {
        const effects = (generator as any).generateEffectConfig(mockAnalysis, mockStyle);
        
        expect(Array.isArray(effects)).toBe(true);
        effects.forEach((effect: EffectConfig) => {
          expect(effect).toHaveProperty('type');
          expect(effect).toHaveProperty('enabled');
          expect(effect).toHaveProperty('intensity');
          expect(effect).toHaveProperty('frequency');
          expect(effect).toHaveProperty('audioReactive');
        });
      });

      it('should generate color configuration', () => {
        const colors = (generator as any).generateColorConfig(mockAnalysis, mockStyle);
        
        expect(colors).toMatchObject({
          palette: expect.any(Array),
          mode: 'audio-reactive',
          saturation: expect.any(Number),
          brightness: 0.7,
          contrast: 0.8,
          hueShift: 0,
          transition: {
            speed: expect.any(Number),
            smoothness: 0.7,
            beatSync: true,
          },
        });
      });

      it('should generate animation configuration', () => {
        const animations = (generator as any).generateAnimationConfig(mockAnalysis, mockStyle);
        
        expect(animations).toMatchObject({
          speed: expect.any(Number),
          complexity: mockAnalysis.complexity,
          smoothness: expect.any(Number),
          patterns: expect.any(Array),
          transitions: {
            type: 'fade',
            duration: 1000,
            easing: 'ease-in-out',
          },
        });
      });

      it('should generate particle configuration', () => {
        const particles = (generator as any).generateParticleConfig(mockAnalysis, mockStyle);
        
        expect(particles).toMatchObject({
          count: expect.any(Number),
          size: 0.5,
          speed: expect.any(Number),
          lifetime: 2.0,
          behavior: 'flow',
          audioReactive: true,
          physics: {
            gravity: 0.1,
            friction: 0.95,
            bounce: 0.3,
          },
        });
      });

      it('should adjust preset for high BPM tracks', () => {
        mockAnalysis.audio.bpm = 150;
        
        const basePreset = (generator as any).createBasePreset(mockAnalysis, mockStyle);
        const originalAnimSpeed = basePreset.animations.speed;
        const originalParticleSpeed = basePreset.particles.speed;
        
        const optimized = (generator as any).optimizePresetForTrack(basePreset, mockAnalysis);
        
        expect(optimized.animations.speed).toBe(originalAnimSpeed * 1.2);
        expect(optimized.particles.speed).toBe(originalParticleSpeed * 1.1);
      });

      it('should adjust preset for low BPM tracks', () => {
        mockAnalysis.audio.bpm = 90;
        
        const basePreset = (generator as any).createBasePreset(mockAnalysis, mockStyle);
        const originalAnimSpeed = basePreset.animations.speed;
        const originalParticleSpeed = basePreset.particles.speed;
        
        const optimized = (generator as any).optimizePresetForTrack(basePreset, mockAnalysis);
        
        expect(optimized.animations.speed).toBe(originalAnimSpeed * 0.8);
        expect(optimized.particles.speed).toBe(originalParticleSpeed * 0.9);
      });

      it('should adjust preset for high energy tracks', () => {
        mockAnalysis.style.energyLevel = 0.9;
        
        const basePreset = (generator as any).createBasePreset(mockAnalysis, mockStyle);
        const optimized = (generator as any).optimizePresetForTrack(basePreset, mockAnalysis);
        
        optimized.effects.forEach((effect: EffectConfig) => {
          expect(effect.intensity).toBeGreaterThanOrEqual(basePreset.effects[0]?.intensity || 0);
        });
      });
    });
  });

  describe('PresetLearningModel', () => {
    it('should add feedback to learning model', () => {
      const learningModel = (generator as any).learningModel;
      const feedback: UserFeedback = {
        presetId: 'test',
        rating: 5,
        liked: true,
        usageDuration: 300,
        modifications: {},
        context: {
          trackGenre: 'techno',
          event: 'club',
          audience: 'dancers',
        },
        timestamp: Date.now(),
      };

      learningModel.addFeedback(feedback);
      
      expect(learningModel.feedbackHistory).toContain(feedback);
    });

    it('should reinforce successful patterns', () => {
      const learningModel = (generator as any).learningModel;
      const preset = {
        colors: { mode: 'static' },
        effects: [{ type: 'test' }],
        animations: { speed: 1 },
      } as PresetConfig;
      const feedback = {
        rating: 5,
      } as UserFeedback;

      learningModel.reinforceSuccessfulPattern(preset, feedback);
      
      const patterns = learningModel.successPatterns;
      expect(patterns.size).toBeGreaterThan(0);
    });
  });

  describe('useAIPresetGenerator Hook', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useAIPresetGenerator());

      expect(result.current.isGenerating).toBe(false);
      expect(result.current.lastPreset).toBeNull();
      expect(result.current.error).toBeNull();
      expect(typeof result.current.generatePreset).toBe('function');
      expect(typeof result.current.optimizePreset).toBe('function');
    });

    it('should generate preset', async () => {
      const { result } = renderHook(() => useAIPresetGenerator());

      await act(async () => {
        await result.current.generatePreset(mockAudioBuffer);
      });

      expect(result.current.lastPreset).toBeDefined();
      expect(result.current.lastPreset?.id).toMatch(/^preset_/);
      expect(result.current.error).toBeNull();
    });

    it('should handle generation errors', async () => {
      const { result } = renderHook(() => useAIPresetGenerator());
      const badBuffer = {} as AudioBuffer;

      await act(async () => {
        await result.current.generatePreset(badBuffer);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.lastPreset).toBeNull();
    });

    it('should optimize preset', () => {
      const { result } = renderHook(() => useAIPresetGenerator());
      
      // Create a complete preset config
      const preset: PresetConfig = {
        id: 'test-preset',
        name: 'Test Preset',
        description: 'Test',
        effects: [],
        colors: {
          palette: ['#ff0000'],
          mode: 'static',
          saturation: 0.8,
          brightness: 0.7,
          contrast: 0.8,
          hueShift: 0,
          transition: {
            speed: 1,
            smoothness: 0.7,
            beatSync: true,
          },
        },
        animations: {
          speed: 1,
          complexity: 0.5,
          smoothness: 0.7,
          patterns: [],
          transitions: {
            type: 'fade',
            duration: 1000,
            easing: 'ease',
          },
        },
        particles: {
          count: 100,
          size: 0.5,
          speed: 1,
          lifetime: 2,
          behavior: 'random',
          audioReactive: true,
          physics: {
            gravity: 0.1,
            friction: 0.95,
            bounce: 0.3,
          },
        },
        audioReactivity: {
          sensitivity: 0.7,
          frequencyRanges: {
            bass: { min: 20, max: 250, weight: 0.4 },
            mid: { min: 250, max: 2000, weight: 0.3 },
            treble: { min: 2000, max: 20000, weight: 0.3 },
          },
          smoothing: 0.8,
          threshold: 0.1,
        },
        beatSync: {
          enabled: true,
          mode: 'auto',
          bpmLock: true,
          subdivision: 4,
          offset: 0,
          swing: 0,
        },
        performance: {
          quality: 'high',
          targetFPS: 60,
          adaptiveQuality: true,
          gpuAcceleration: true,
          memoryOptimization: true,
        },
        metadata: {
          tags: ['test'],
          genre: ['electronic'],
          mood: ['energetic'],
          energy: 0.8,
          complexity: 0.7,
          rating: 0,
          usage: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          author: 'test',
          version: '1.0',
        },
      };
      
      const feedback: UserFeedback = {
        presetId: 'test-preset',
        rating: 5,
        liked: true,
        usageDuration: 300,
        modifications: {},
        context: {
          trackGenre: 'electronic',
          event: 'club',
          audience: 'dancers',
        },
        timestamp: Date.now(),
      };

      const optimized = result.current.optimizePreset(preset, feedback);

      expect(optimized).toBeDefined();
      expect(optimized.metadata.rating).toBe(5);
    });
  });
});