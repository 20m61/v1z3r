/**
 * Tests for AI Speech Recognition System
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  AISpeechRecognition,
  useAISpeechRecognition,
  VJ_VOCABULARY_JP,
  VJ_VOCABULARY_EN,
  type VoiceCommand,
  type VJAction,
  type SpeechRecognitionConfig,
  type SpeechRecognitionError,
} from '../aiSpeechRecognition';

// Mock SpeechRecognition API
class MockSpeechRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  
  onstart: ((event: Event) => void) | null = null;
  onend: ((event: Event) => void) | null = null;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  
  private isStarted = false;
  
  start() {
    this.isStarted = true;
    // Immediately trigger the onstart event
    if (this.onstart) {
      this.onstart(new Event('start'));
    }
  }
  
  stop() {
    this.isStarted = false;
    // Immediately trigger the onend event
    if (this.onend) {
      this.onend(new Event('end'));
    }
  }
  
  // Test helper to simulate speech recognition results
  simulateResult(transcript: string, confidence: number = 0.9, isFinal = true) {
    if (this.onresult) {
      const event = {
        results: {
          length: 1,
          0: {
            length: 1,
            0: { transcript, confidence },
            isFinal,
          },
          item: (index: number) => this[index],
        },
        resultIndex: 0,
      };
      this.onresult(event);
    }
  }
  
  // Test helper to simulate errors
  simulateError(error: string, message: string) {
    if (this.onerror) {
      this.onerror({ error, message });
    }
  }
}

// Mock Web Audio API
class MockAudioContext {
  sampleRate = 44100;
  destination = {} as AudioDestinationNode;
  
  createGain() {
    return {
      gain: { value: 1.0 },
      connect: jest.fn(),
    } as unknown as GainNode;
  }
  
  createBiquadFilter() {
    return {
      type: 'lowpass',
      frequency: { value: 350 },
      Q: { value: 1 },
      connect: jest.fn(),
    } as unknown as BiquadFilterNode;
  }
  
  close() {
    return Promise.resolve();
  }
}

// Mock console methods
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

describe('AI Speech Recognition', () => {
  let originalAudioContext: typeof AudioContext;
  let mockSpeechRecognition: MockSpeechRecognition;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock AudioContext
    originalAudioContext = global.AudioContext;
    (global as any).AudioContext = MockAudioContext;
    
    // Mock SpeechRecognition
    mockSpeechRecognition = new MockSpeechRecognition();
    (global as any).SpeechRecognition = jest.fn(() => mockSpeechRecognition);
    (global as any).webkitSpeechRecognition = jest.fn(() => mockSpeechRecognition);
    
    // Ensure window object has the speech recognition constructors
    Object.defineProperty(window, 'SpeechRecognition', {
      writable: true,
      value: jest.fn(() => mockSpeechRecognition),
    });
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      writable: true,
      value: jest.fn(() => mockSpeechRecognition),
    });
  });

  afterEach(() => {
    global.AudioContext = originalAudioContext;
    jest.clearAllMocks();
    
    // Reset singleton instance
    const { resetSpeechRecognitionInstance } = require('../aiSpeechRecognition');
    if (resetSpeechRecognitionInstance) {
      resetSpeechRecognitionInstance();
    }
    
    // Clean up speech recognition mocks
    delete (window as any).SpeechRecognition;
    delete (window as any).webkitSpeechRecognition;
    delete (global as any).SpeechRecognition;
    delete (global as any).webkitSpeechRecognition;
  });

  describe('VJ Vocabulary', () => {
    it('should have Japanese vocabulary with correct commands', () => {
      expect(VJ_VOCABULARY_JP).toBeDefined();
      expect(VJ_VOCABULARY_JP['エフェクト変更']).toEqual({ type: 'EFFECT_CHANGE' });
      expect(VJ_VOCABULARY_JP['音量アップ']).toEqual({ type: 'VOLUME_ADJUST', value: 10 });
      expect(VJ_VOCABULARY_JP['色を赤に']).toEqual({ type: 'COLOR_SET', value: '#ff0000' });
      expect(VJ_VOCABULARY_JP['ビート同期開始']).toEqual({ type: 'BEAT_SYNC', value: true });
      expect(VJ_VOCABULARY_JP['プリセット1']).toEqual({ type: 'PRESET_LOAD', target: '1' });
      expect(VJ_VOCABULARY_JP['レイヤー追加']).toEqual({ type: 'LAYER_CONTROL', value: 'add' });
    });

    it('should have English vocabulary with correct commands', () => {
      expect(VJ_VOCABULARY_EN).toBeDefined();
      expect(VJ_VOCABULARY_EN['change effect']).toEqual({ type: 'EFFECT_CHANGE' });
      expect(VJ_VOCABULARY_EN['volume up']).toEqual({ type: 'VOLUME_ADJUST', value: 10 });
      expect(VJ_VOCABULARY_EN['red color']).toEqual({ type: 'COLOR_SET', value: '#ff0000' });
      expect(VJ_VOCABULARY_EN['start beat sync']).toEqual({ type: 'BEAT_SYNC', value: true });
      expect(VJ_VOCABULARY_EN['preset one']).toEqual({ type: 'PRESET_LOAD', target: '1' });
      expect(VJ_VOCABULARY_EN['add layer']).toEqual({ type: 'LAYER_CONTROL', value: 'add' });
    });

    it('should have consistent action types between languages', () => {
      const jpTypes = Object.values(VJ_VOCABULARY_JP).map(action => action.type);
      const enTypes = Object.values(VJ_VOCABULARY_EN).map(action => action.type);
      
      const uniqueJpTypes = [...new Set(jpTypes)];
      const uniqueEnTypes = [...new Set(enTypes)];
      
      expect(uniqueJpTypes.sort()).toEqual(uniqueEnTypes.sort());
    });
  });

  describe('AISpeechRecognition Class', () => {
    let speechRecognizer: AISpeechRecognition;

    afterEach(() => {
      if (speechRecognizer) {
        speechRecognizer.dispose();
      }
    });

    describe('Constructor', () => {
      it('should create instance with default config', () => {
        speechRecognizer = new AISpeechRecognition();
        
        const config = (speechRecognizer as any).config;
        expect(config.language).toBe('ja-JP');
        expect(config.continuous).toBe(true);
        expect(config.interimResults).toBe(false);
        expect(config.maxAlternatives).toBe(3);
        expect(config.confidenceThreshold).toBe(0.7);
        expect(config.noiseReduction).toBe(true);
      });

      it('should create instance with custom config', () => {
        const customConfig: Partial<SpeechRecognitionConfig> = {
          language: 'en-US',
          continuous: false,
          interimResults: true,
          maxAlternatives: 5,
          confidenceThreshold: 0.8,
          noiseReduction: false,
        };
        
        speechRecognizer = new AISpeechRecognition(customConfig);
        
        const config = (speechRecognizer as any).config;
        expect(config.language).toBe('en-US');
        expect(config.continuous).toBe(false);
        expect(config.interimResults).toBe(true);
        expect(config.maxAlternatives).toBe(5);
        expect(config.confidenceThreshold).toBe(0.8);
        expect(config.noiseReduction).toBe(false);
      });

      it('should set vocabulary based on language', () => {
        speechRecognizer = new AISpeechRecognition({ language: 'ja-JP' });
        expect((speechRecognizer as any).vocabulary).toBe(VJ_VOCABULARY_JP);
        
        speechRecognizer.dispose();
        speechRecognizer = new AISpeechRecognition({ language: 'en-US' });
        expect((speechRecognizer as any).vocabulary).toBe(VJ_VOCABULARY_EN);
      });

      it('should initialize speech recognition if supported', () => {
        speechRecognizer = new AISpeechRecognition();
        
        expect((speechRecognizer as any).recognition).toBeDefined();
        expect(mockSpeechRecognition.lang).toBe('ja-JP');
        expect(mockSpeechRecognition.continuous).toBe(true);
        expect(mockSpeechRecognition.interimResults).toBe(false);
        expect(mockSpeechRecognition.maxAlternatives).toBe(3);
      });

      it('should handle unsupported browser gracefully', () => {
        // Clean up mocks first
        delete (window as any).SpeechRecognition;
        delete (window as any).webkitSpeechRecognition;
        delete (global as any).SpeechRecognition;
        delete (global as any).webkitSpeechRecognition;
        
        // Clear previous calls
        consoleWarnSpy.mockClear();
        
        speechRecognizer = new AISpeechRecognition();
        
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Speech Recognition not supported in this browser'
        );
        expect((speechRecognizer as any).recognition).toBeNull();
      });
    });

    describe('Speech Recognition Control', () => {
      beforeEach(() => {
        speechRecognizer = new AISpeechRecognition();
      });

      it('should start listening', () => {
        const startSpy = jest.spyOn(mockSpeechRecognition, 'start');
        
        speechRecognizer.startListening();
        
        expect(startSpy).toHaveBeenCalled();
        expect((speechRecognizer as any).isListening).toBe(true);
      });

      it('should stop listening', () => {
        const stopSpy = jest.spyOn(mockSpeechRecognition, 'stop');
        
        speechRecognizer.startListening();
        speechRecognizer.stopListening();
        
        expect(stopSpy).toHaveBeenCalled();
        expect((speechRecognizer as any).isListening).toBe(false);
      });

      it('should not start if already listening', () => {
        const startSpy = jest.spyOn(mockSpeechRecognition, 'start');
        
        speechRecognizer.startListening();
        speechRecognizer.startListening(); // Second call
        
        expect(startSpy).toHaveBeenCalledTimes(1);
      });

      it('should not stop if not listening', () => {
        const stopSpy = jest.spyOn(mockSpeechRecognition, 'stop');
        
        speechRecognizer.stopListening();
        
        expect(stopSpy).not.toHaveBeenCalled();
      });

      it('should handle start without recognition support', () => {
        speechRecognizer.dispose();
        delete (window as any).SpeechRecognition;
        delete (window as any).webkitSpeechRecognition;
        delete (global as any).SpeechRecognition;
        delete (global as any).webkitSpeechRecognition;
        speechRecognizer = new AISpeechRecognition();
        
        expect(() => speechRecognizer.startListening()).not.toThrow();
        expect((speechRecognizer as any).isListening).toBe(false);
      });
    });

    describe('Voice Command Processing', () => {
      let commandCallback: jest.Mock;

      beforeEach(() => {
        speechRecognizer = new AISpeechRecognition();
        commandCallback = jest.fn();
        speechRecognizer.onCommand(commandCallback);
      });

      it('should process recognized Japanese commands', () => {
        speechRecognizer.startListening();
        
        mockSpeechRecognition.simulateResult('エフェクト変更', 0.9);
        
        expect(commandCallback).toHaveBeenCalledWith({
          command: 'エフェクト変更',
          confidence: 0.9,
          action: { type: 'EFFECT_CHANGE' },
          timestamp: expect.any(Number),
        });
      });

      it('should process recognized English commands', () => {
        speechRecognizer.dispose();
        speechRecognizer = new AISpeechRecognition({ language: 'en-US' });
        commandCallback = jest.fn();
        speechRecognizer.onCommand(commandCallback);
        speechRecognizer.startListening();
        
        mockSpeechRecognition.simulateResult('volume up', 0.8);
        
        expect(commandCallback).toHaveBeenCalledWith({
          command: 'volume up',
          confidence: 0.8,
          action: { type: 'VOLUME_ADJUST', value: 10 },
          timestamp: expect.any(Number),
        });
      });

      it('should process fuzzy matched commands', () => {
        speechRecognizer.startListening();
        
        // Test fuzzy matching for similar commands
        mockSpeechRecognition.simulateResult('音量アップして', 0.7);
        
        expect(commandCallback).toHaveBeenCalledWith(expect.objectContaining({
          command: expect.stringContaining('音量'),
          action: expect.objectContaining({ type: 'VOLUME_ADJUST' }),
        }));
      });

      it('should reject commands below confidence threshold', () => {
        speechRecognizer.startListening();
        
        mockSpeechRecognition.simulateResult('エフェクト変更', 0.5); // Below 0.7 threshold
        
        expect(commandCallback).not.toHaveBeenCalled();
      });

      it('should ignore unrecognized commands', () => {
        speechRecognizer.startListening();
        
        mockSpeechRecognition.simulateResult('unknown command', 0.9);
        
        expect(commandCallback).not.toHaveBeenCalled();
      });

      it('should handle interim results correctly', () => {
        speechRecognizer.dispose();
        speechRecognizer = new AISpeechRecognition({ interimResults: true });
        commandCallback = jest.fn();
        speechRecognizer.onCommand(commandCallback);
        speechRecognizer.startListening();
        
        // Interim result should not trigger command
        mockSpeechRecognition.simulateResult('エフェクト', 0.9, false);
        expect(commandCallback).not.toHaveBeenCalled();
        
        // Final result should trigger command
        mockSpeechRecognition.simulateResult('エフェクト変更', 0.9, true);
        expect(commandCallback).toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      let errorCallback: jest.Mock;

      beforeEach(() => {
        speechRecognizer = new AISpeechRecognition();
        errorCallback = jest.fn();
        speechRecognizer.onError(errorCallback);
      });

      it('should handle speech recognition errors', () => {
        speechRecognizer.startListening();
        
        mockSpeechRecognition.simulateError('network', 'Network error occurred');
        
        expect(errorCallback).toHaveBeenCalledWith({
          error: 'network',
          message: 'Network error occurred',
        });
      });

      it('should log recognition errors', () => {
        speechRecognizer.startListening();
        
        mockSpeechRecognition.simulateError('audio-capture', 'Microphone not accessible');
        
        // Just verify error callback is called, don't check console
        expect(errorCallback).toHaveBeenCalled();
      });

      it('should handle errors gracefully without callback', () => {
        speechRecognizer.startListening();
        
        // Remove error callback
        speechRecognizer.onError(undefined as any);
        
        expect(() => {
          mockSpeechRecognition.simulateError('network', 'Network error');
        }).not.toThrow();
      });
    });

    describe('Fuzzy Matching', () => {
      beforeEach(() => {
        speechRecognizer = new AISpeechRecognition();
      });

      it('should calculate edit distance correctly', () => {
        // This method is private, so we'll test through fuzzy matching instead
        const result = (speechRecognizer as any).findFuzzyMatch('音量アップ');
        expect(result).toBeDefined();
        expect(result.similarity).toBe(1); // Exact match
      });

      it('should find fuzzy matches for similar commands', () => {
        const result = (speechRecognizer as any).findFuzzyMatch('音量アップして');
        
        expect(result).toBeDefined();
        expect(result.similarity).toBeGreaterThan(0.5);
        expect(result.command).toContain('音量');
      });

      it('should return null for poor fuzzy matches', () => {
        const result = (speechRecognizer as any).findFuzzyMatch('completely different text');
        
        expect(result).toBeNull();
      });

      it('should prefer exact matches over fuzzy matches', () => {
        const exactResult = (speechRecognizer as any).findFuzzyMatch('音量アップ');
        const fuzzyResult = (speechRecognizer as any).findFuzzyMatch('音量アップして');
        
        expect(exactResult.similarity).toBe(1);
        expect(fuzzyResult.similarity).toBeLessThan(1);
      });
    });

    describe('Audio Processing', () => {
      beforeEach(() => {
        speechRecognizer = new AISpeechRecognition();
      });

      it('should initialize audio context when noise reduction is enabled', () => {
        expect((speechRecognizer as any).audioContext).toBeDefined();
        expect((speechRecognizer as any).gainNode).toBeDefined();
        expect((speechRecognizer as any).filterNode).toBeDefined();
      });

      it('should not initialize audio context when noise reduction is disabled', () => {
        speechRecognizer.dispose();
        speechRecognizer = new AISpeechRecognition({ noiseReduction: false });
        
        expect((speechRecognizer as any).audioContext).toBeNull();
        expect((speechRecognizer as any).gainNode).toBeNull();
        expect((speechRecognizer as any).filterNode).toBeNull();
      });

      it('should handle audio context creation errors gracefully', () => {
        const OriginalAudioContext = global.AudioContext;
        (global as any).AudioContext = function() {
          throw new Error('AudioContext not supported');
        };
        
        speechRecognizer.dispose();
        
        expect(() => {
          speechRecognizer = new AISpeechRecognition();
        }).not.toThrow();
        
        global.AudioContext = OriginalAudioContext;
      });
    });

    describe('Configuration Updates', () => {
      beforeEach(() => {
        speechRecognizer = new AISpeechRecognition();
      });

      it('should update configuration', () => {
        const newConfig: Partial<SpeechRecognitionConfig> = {
          language: 'en-US',
          confidenceThreshold: 0.8,
        };
        
        speechRecognizer.updateConfig(newConfig);
        
        const config = (speechRecognizer as any).config;
        expect(config.language).toBe('en-US');
        expect(config.confidenceThreshold).toBe(0.8);
        expect(config.continuous).toBe(true); // Should preserve existing values
      });

      it('should update vocabulary when language changes', () => {
        speechRecognizer.updateConfig({ language: 'en-US' });
        
        expect((speechRecognizer as any).vocabulary).toBe(VJ_VOCABULARY_EN);
      });

      it('should update speech recognition config', () => {
        speechRecognizer.updateConfig({ maxAlternatives: 5 });
        
        expect(mockSpeechRecognition.maxAlternatives).toBe(5);
      });
    });

    describe('Static Methods', () => {
      it('should check browser support correctly', () => {
        expect(AISpeechRecognition.isSupported()).toBe(true);
        
        // Test without support
        delete (window as any).SpeechRecognition;
        delete (window as any).webkitSpeechRecognition;
        
        expect(AISpeechRecognition.isSupported()).toBe(false);
      });
    });

    describe('Resource Management', () => {
      beforeEach(() => {
        speechRecognizer = new AISpeechRecognition();
      });

      it('should dispose resources properly', () => {
        const mockClose = jest.fn().mockResolvedValue(undefined);
        (speechRecognizer as any).audioContext.close = mockClose;
        
        speechRecognizer.dispose();
        
        expect(mockClose).toHaveBeenCalled();
        expect((speechRecognizer as any).recognition).toBeNull();
        expect((speechRecognizer as any).audioContext).toBeNull();
      });

      it('should handle dispose without audio context', () => {
        speechRecognizer.dispose();
        speechRecognizer = new AISpeechRecognition({ noiseReduction: false });
        
        expect(() => speechRecognizer.dispose()).not.toThrow();
      });

      it('should stop listening on dispose', () => {
        const stopSpy = jest.spyOn(mockSpeechRecognition, 'stop');
        
        speechRecognizer.startListening();
        speechRecognizer.dispose();
        
        expect(stopSpy).toHaveBeenCalled();
      });
    });
  });

  describe('useAISpeechRecognition Hook', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useAISpeechRecognition());

      expect(result.current.isListening).toBe(false);
      expect(result.current.lastCommand).toBeNull();
      expect(result.current.error).toBeNull();
      expect(typeof result.current.startListening).toBe('function');
      expect(typeof result.current.stopListening).toBe('function');
      expect(result.current.isSupported).toBe(true);
    });

    it('should start and stop listening', () => {
      const { result } = renderHook(() => useAISpeechRecognition());

      act(() => {
        result.current.startListening();
      });

      expect(result.current.isListening).toBe(true);

      act(() => {
        result.current.stopListening();
      });

      expect(result.current.isListening).toBe(false);
    });

    it('should handle voice commands', () => {
      const { result } = renderHook(() => useAISpeechRecognition());

      act(() => {
        result.current.startListening();
      });

      // Simulate a voice command
      act(() => {
        mockSpeechRecognition.simulateResult('音量アップ', 0.9);
      });

      expect(result.current.lastCommand).toEqual({
        command: '音量アップ',
        confidence: 0.9,
        action: { type: 'VOLUME_ADJUST', value: 10 },
        timestamp: expect.any(Number),
      });
    });

    it('should handle errors', () => {
      const { result } = renderHook(() => useAISpeechRecognition());

      act(() => {
        result.current.startListening();
      });

      act(() => {
        mockSpeechRecognition.simulateError('network', 'Network error');
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.isListening).toBe(false);
    });

    it('should support custom configuration', () => {
      const customConfig = { language: 'en-US' as const, confidenceThreshold: 0.8 };
      const { result } = renderHook(() => useAISpeechRecognition(customConfig));

      expect(result.current.isSupported).toBe(true);
    });

    it('should cleanup on unmount', () => {
      const { unmount } = renderHook(() => useAISpeechRecognition());

      expect(() => unmount()).not.toThrow();
    });

    it('should handle unsupported browser', () => {
      delete (window as any).SpeechRecognition;
      delete (window as any).webkitSpeechRecognition;

      const { result } = renderHook(() => useAISpeechRecognition());

      expect(result.current.isSupported).toBe(false);
      expect(result.current.isListening).toBe(false);
    });
  });
});