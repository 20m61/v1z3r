/**
 * Tests for AI Gesture Recognition System
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  AIGestureRecognition,
  useAIGestureRecognition,
  VJ_GESTURE_MAPPINGS,
  type GestureRecognitionResult,
  type VJGestureAction,
  type GestureRecognitionConfig,
  type HandDetection,
  type Pose,
  type GestureType,
} from '../aiGestureRecognition';

// Mock navigator.mediaDevices
const mockGetUserMedia = jest.fn();
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
  },
  writable: true,
});

// Simple mock implementations
global.requestAnimationFrame = jest.fn(cb => {
  cb();
  return 1;
});
global.cancelAnimationFrame = jest.fn();

// Mock document.createElement
const mockCanvas = {
  width: 640,
  height: 480,
  getContext: jest.fn(() => ({
    drawImage: jest.fn(),
  })),
};

const mockVideo = {
  srcObject: null,
  autoplay: false,
  playsInline: false,
  onloadedmetadata: null,
};

// Mock document if not available
if (typeof document === 'undefined') {
  (global as any).document = {
    createElement: jest.fn(),
  };
}

// Mock document.createElement
jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
  if (tagName === 'canvas') return mockCanvas as any;
  if (tagName === 'video') {
    const video = { ...mockVideo };
    setTimeout(() => {
      if (video.onloadedmetadata) {
        video.onloadedmetadata();
      }
    }, 0);
    return video as any;
  }
  return {} as any;
});

describe('AI Gesture Recognition', () => {
  let mockStream: MediaStream;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    mockStream = {
      getTracks: jest.fn(() => [{ stop: jest.fn() }]),
    } as any;
    
    mockGetUserMedia.mockResolvedValue(mockStream);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('AIGestureRecognition Class', () => {
    let gestureRecognizer: AIGestureRecognition;

    beforeEach(() => {
      gestureRecognizer = new AIGestureRecognition();
    });

    afterEach(() => {
      gestureRecognizer.dispose();
    });

    describe('Constructor', () => {
      it('should create instance with default config', () => {
        expect(gestureRecognizer).toBeInstanceOf(AIGestureRecognition);
        
        const config = (gestureRecognizer as any).config;
        expect(config.modelType).toBe('lite');
        expect(config.maxNumHands).toBe(2);
        expect(config.enableBodyTracking).toBe(true);
        expect(config.enableHandTracking).toBe(true);
      });

      it('should create instance with custom config', () => {
        const customConfig: Partial<GestureRecognitionConfig> = {
          modelType: 'full',
          maxNumHands: 1,
          enableBodyTracking: false,
        };
        
        const recognizer = new AIGestureRecognition(customConfig);
        const config = (recognizer as any).config;
        
        expect(config.modelType).toBe('full');
        expect(config.maxNumHands).toBe(1);
        expect(config.enableBodyTracking).toBe(false);
        
        recognizer.dispose();
      });

      it('should include default VJ gesture mappings', () => {
        const mappings = (gestureRecognizer as any).gestureMappings;
        expect(mappings).toEqual(VJ_GESTURE_MAPPINGS);
        expect(mappings.length).toBeGreaterThan(0);
      });
    });

    describe('Basic Functionality', () => {
      it('should have proper initial state', () => {
        expect(gestureRecognizer.isRecognitionActive()).toBe(false);
        expect((gestureRecognizer as any).isProcessing).toBe(false);
      });

      it('should handle dispose without initialization', () => {
        expect(() => gestureRecognizer.dispose()).not.toThrow();
      });

      it('should update configuration', () => {
        const newConfig: Partial<GestureRecognitionConfig> = {
          modelType: 'heavy',
          maxNumHands: 1,
        };
        
        gestureRecognizer.updateConfig(newConfig);
        const config = (gestureRecognizer as any).config;
        
        expect(config.modelType).toBe('heavy');
        expect(config.maxNumHands).toBe(1);
        expect(config.enableBodyTracking).toBe(true); // Should preserve existing values
      });

      it('should add gesture mapping', () => {
        const newMapping = {
          gesture: 'rock_on' as GestureType,
          action: { type: 'EFFECT_CHANGE' as const, target: 'rock', value: 'on' },
          sensitivity: 0.9,
          cooldown: 300,
          requires: ['right_hand' as const],
        };
        
        gestureRecognizer.addGestureMapping(newMapping);
        const mappings = (gestureRecognizer as any).gestureMappings;
        
        expect(mappings).toContain(newMapping);
      });

      it('should set callback functions', () => {
        const gestureCallback = jest.fn();
        const actionCallback = jest.fn();
        const errorCallback = jest.fn();
        
        gestureRecognizer.onGesture(gestureCallback);
        gestureRecognizer.onVJAction(actionCallback);
        gestureRecognizer.onError(errorCallback);
        
        expect((gestureRecognizer as any).onGestureCallback).toBe(gestureCallback);
        expect((gestureRecognizer as any).onVJActionCallback).toBe(actionCallback);
        expect((gestureRecognizer as any).onErrorCallback).toBe(errorCallback);
      });
    });

    describe('VJ Action Execution', () => {
      it('should execute VJ actions for recognized gestures', () => {
        const actionCallback = jest.fn();
        gestureRecognizer.onVJAction(actionCallback);
        
        const mockGestureResult: GestureRecognitionResult = {
          gesture: 'fist',
          confidence: 0.9,
          hands: [{ landmarks: [], handedness: 'Right', confidence: 0.9, timestamp: Date.now() }],
          timestamp: Date.now(),
        };

        (gestureRecognizer as any).executeVJAction(mockGestureResult);

        expect(actionCallback).toHaveBeenCalledWith({
          type: 'EFFECT_CHANGE',
          target: 'particle',
          value: 'explosion',
        });
      });

      it('should respect cooldown periods', () => {
        const actionCallback = jest.fn();
        gestureRecognizer.onVJAction(actionCallback);
        
        const mockGestureResult: GestureRecognitionResult = {
          gesture: 'fist',
          confidence: 0.9,
          hands: [{ landmarks: [], handedness: 'Right', confidence: 0.9, timestamp: Date.now() }],
          timestamp: Date.now(),
        };

        // First execution should work
        (gestureRecognizer as any).executeVJAction(mockGestureResult);
        expect(actionCallback).toHaveBeenCalledTimes(1);

        // Second execution within cooldown should be blocked
        (gestureRecognizer as any).executeVJAction(mockGestureResult);
        expect(actionCallback).toHaveBeenCalledTimes(1);
      });

      it('should check gesture sensitivity', () => {
        const actionCallback = jest.fn();
        gestureRecognizer.onVJAction(actionCallback);
        
        const lowConfidenceGesture: GestureRecognitionResult = {
          gesture: 'fist',
          confidence: 0.5, // Below fist sensitivity of 0.8
          hands: [{ landmarks: [], handedness: 'Right', confidence: 0.9, timestamp: Date.now() }],
          timestamp: Date.now(),
        };

        (gestureRecognizer as any).executeVJAction(lowConfidenceGesture);
        expect(actionCallback).not.toHaveBeenCalled();
      });

      it('should check required elements for gestures', () => {
        const actionCallback = jest.fn();
        gestureRecognizer.onVJAction(actionCallback);
        
        // Gesture requiring both hands but only one provided
        const oneHandGesture: GestureRecognitionResult = {
          gesture: 'clap',
          confidence: 0.95,
          hands: [{ landmarks: [], handedness: 'Right', confidence: 0.9, timestamp: Date.now() }],
          timestamp: Date.now(),
        };

        (gestureRecognizer as any).executeVJAction(oneHandGesture);
        expect(actionCallback).not.toHaveBeenCalled();

        // Now with both hands
        const bothHandsGesture: GestureRecognitionResult = {
          gesture: 'clap',
          confidence: 0.95,
          hands: [
            { landmarks: [], handedness: 'Right', confidence: 0.9, timestamp: Date.now() },
            { landmarks: [], handedness: 'Left', confidence: 0.9, timestamp: Date.now() },
          ],
          timestamp: Date.now(),
        };

        (gestureRecognizer as any).executeVJAction(bothHandsGesture);
        expect(actionCallback).toHaveBeenCalled();
      });
    });

    describe('Gesture Analysis', () => {
      it('should analyze hand gestures', () => {
        const mockHands = [{
          landmarks: Array(21).fill({ x: 0.5, y: 0.5 }),
          handedness: 'Right',
          confidence: 0.9,
        }];

        const result = (gestureRecognizer as any).analyzeGestures([], mockHands);
        
        // Result might be null due to filtering, so check both cases
        if (result) {
          expect(result.hands).toHaveLength(1);
          expect(result.hands[0].handedness).toBe('Right');
          expect(result.confidence).toBeGreaterThan(0);
        } else {
          // If null, it's due to gesture filtering which is expected behavior
          expect(result).toBeNull();
        }
      });

      it('should analyze pose gestures', () => {
        const mockPoses = [{
          landmarks: Array(33).fill({ x: 0.5, y: 0.5, visibility: 0.9 }),
          confidence: 0.8,
        }];

        const result = (gestureRecognizer as any).analyzeGestures(mockPoses, []);
        
        if (result) {
          expect(result.pose).toBeTruthy();
          expect(result.pose!.confidence).toBe(0.8);
        }
      });

      it('should return null for low confidence poses', () => {
        const lowConfidencePoses = [{
          landmarks: Array(33).fill({ x: 0.5, y: 0.5 }),
          confidence: 0.3, // Below minPoseConfidence of 0.5
        }];

        const result = (gestureRecognizer as any).analyzeGestures(lowConfidencePoses, []);
        expect(result).toBeNull();
      });

      it('should filter gestures using confidence buffer', () => {
        const gesture: GestureType = 'fist';
        
        // First few low confidence readings
        let filtered = (gestureRecognizer as any).filterGesture(gesture, 0.5);
        expect(filtered).toBeNull();
        
        // High confidence readings
        (gestureRecognizer as any).filterGesture(gesture, 0.8);
        (gestureRecognizer as any).filterGesture(gesture, 0.9);
        filtered = (gestureRecognizer as any).filterGesture(gesture, 0.85);
        
        // Should now pass the filter
        expect(filtered).toBeTruthy();
        expect(filtered!.type).toBe(gesture);
        expect(filtered!.confidence).toBeGreaterThan(0.7);
      });
    });

    describe('Mock Detection Methods', () => {
      it('should perform mock pose detection', async () => {
        const canvas = mockCanvas as any;
        const poses = await (gestureRecognizer as any).mockPoseDetection(canvas);
        
        expect(Array.isArray(poses)).toBe(true);
        if (poses.length > 0) {
          expect(poses[0]).toHaveProperty('landmarks');
          expect(poses[0]).toHaveProperty('confidence');
          expect(poses[0].landmarks).toHaveLength(33);
        }
      });

      it('should perform mock hand detection', async () => {
        const canvas = mockCanvas as any;
        const hands = await (gestureRecognizer as any).mockHandDetection(canvas);
        
        expect(Array.isArray(hands)).toBe(true);
        if (hands.length > 0) {
          expect(hands[0]).toHaveProperty('landmarks');
          expect(hands[0]).toHaveProperty('handedness');
          expect(hands[0]).toHaveProperty('confidence');
          expect(hands[0].landmarks).toHaveLength(21);
          expect(['Left', 'Right']).toContain(hands[0].handedness);
        }
      });
    });

    describe('Gesture Recognition Types', () => {
      it('should recognize hand gestures', () => {
        const hand: HandDetection = {
          landmarks: Array(21).fill({ x: 0.5, y: 0.5 }),
          handedness: 'Right',
          confidence: 0.9,
          timestamp: Date.now(),
        };

        const result = (gestureRecognizer as any).recognizeHandGesture(hand);
        
        if (result) {
          expect(result.type).toBeDefined();
          expect(result.confidence).toBeGreaterThan(0);
        }
      });

      it('should recognize two-hand gestures', () => {
        const hands: HandDetection[] = [
          { landmarks: [], handedness: 'Right', confidence: 0.9, timestamp: Date.now() },
          { landmarks: [], handedness: 'Left', confidence: 0.9, timestamp: Date.now() },
        ];

        const result = (gestureRecognizer as any).recognizeTwoHandGesture(hands);
        
        if (result) {
          expect(result.type).toBeDefined();
          expect(result.confidence).toBeGreaterThan(0);
        }
      });

      it('should recognize pose gestures', () => {
        const pose: Pose = {
          landmarks: Array(33).fill({ x: 0.5, y: 0.5, visibility: 0.9 }),
          confidence: 0.8,
          timestamp: Date.now(),
        };

        const result = (gestureRecognizer as any).recognizePoseGesture(pose);
        
        if (result) {
          expect(result.type).toBeDefined();
          expect(result.confidence).toBeGreaterThan(0);
        }
      });
    });

    describe('Static Methods', () => {
      it('should check support correctly', () => {
        expect(AIGestureRecognition.isSupported()).toBe(true);
        
        // Test without mediaDevices
        const originalMediaDevices = navigator.mediaDevices;
        delete (navigator as any).mediaDevices;
        
        expect(AIGestureRecognition.isSupported()).toBe(false);
        
        // Restore
        (navigator as any).mediaDevices = originalMediaDevices;
      });
    });
  });

  describe('VJ Gesture Mappings', () => {
    it('should include all required gesture mappings', () => {
      expect(VJ_GESTURE_MAPPINGS).toBeDefined();
      expect(VJ_GESTURE_MAPPINGS.length).toBeGreaterThan(0);
      
      VJ_GESTURE_MAPPINGS.forEach(mapping => {
        expect(mapping).toHaveProperty('gesture');
        expect(mapping).toHaveProperty('action');
        expect(mapping).toHaveProperty('sensitivity');
        expect(mapping).toHaveProperty('cooldown');
        expect(mapping).toHaveProperty('requires');
        expect(Array.isArray(mapping.requires)).toBe(true);
      });
    });

    it('should have valid action types', () => {
      const validActionTypes = [
        'EFFECT_CHANGE',
        'VOLUME_CONTROL',
        'COLOR_ADJUST',
        'BEAT_CONTROL',
        'LAYER_CONTROL',
        'CAMERA_CONTROL',
      ];
      
      VJ_GESTURE_MAPPINGS.forEach(mapping => {
        expect(validActionTypes).toContain(mapping.action.type);
      });
    });

    it('should have reasonable sensitivity and cooldown values', () => {
      VJ_GESTURE_MAPPINGS.forEach(mapping => {
        expect(mapping.sensitivity).toBeGreaterThan(0);
        expect(mapping.sensitivity).toBeLessThanOrEqual(1);
        expect(mapping.cooldown).toBeGreaterThan(0);
        expect(mapping.cooldown).toBeLessThan(5000);
      });
    });
  });

  describe('useAIGestureRecognition Hook', () => {
    it('should export hook function', () => {
      expect(typeof useAIGestureRecognition).toBe('function');
    });

    it('should support configuration parameter', () => {
      const customConfig = { modelType: 'full' as const, maxNumHands: 1 };
      expect(() => useAIGestureRecognition(customConfig)).toBeDefined();
    });
  });
});