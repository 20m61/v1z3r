/**
 * iOS Detection Tests
 */

import { IOSDetector } from '../iosDetection';

// Mock globals
const mockGlobals = {
  navigator: {
    userAgent: '',
    platform: '',
    maxTouchPoints: 0,
    mediaDevices: {
      getUserMedia: jest.fn(),
    },
  },
  screen: {
    width: 0,
    height: 0,
    orientation: {
      angle: 0,
      lock: jest.fn(),
      unlock: jest.fn(),
    },
  },
  window: {
    visualViewport: {
      width: 0,
      height: 0,
      scale: 1,
      offsetLeft: 0,
      offsetTop: 0,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    innerWidth: 0,
    innerHeight: 0,
    matchMedia: jest.fn().mockReturnValue({ matches: false }),
    DeviceMotionEvent: class MockDeviceMotionEvent {
      static requestPermission = jest.fn();
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  document: {
    createElement: jest.fn(),
  },
  getComputedStyle: jest.fn(),
};

// Setup global mocks
beforeEach(() => {
  jest.clearAllMocks();
  
  // Mock globals using jest.spyOn
  jest.spyOn(global, 'navigator', 'get').mockReturnValue(mockGlobals.navigator as any);
  jest.spyOn(global, 'screen', 'get').mockReturnValue(mockGlobals.screen as any);
  jest.spyOn(global, 'window', 'get').mockReturnValue(mockGlobals.window as any);
  jest.spyOn(global, 'document', 'get').mockReturnValue(mockGlobals.document as any);
  global.getComputedStyle = mockGlobals.getComputedStyle;
  
  // Reset IOSDetector instance
  (IOSDetector as any).instance = null;
});

describe('IOSDetector', () => {
  describe('iPhone Detection', () => {
    it('should detect iPhone from user agent', () => {
      mockGlobals.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';
      mockGlobals.navigator.platform = 'iPhone';
      mockGlobals.screen.width = 390;
      mockGlobals.screen.height = 844;
      mockGlobals.window.innerWidth = 390;
      mockGlobals.window.innerHeight = 844;
      
      const detector = IOSDetector.getInstance();
      const deviceInfo = detector.detectDevice();
      
      expect(deviceInfo.isIOS).toBe(true);
      expect(deviceInfo.isIPhone).toBe(true);
      expect(deviceInfo.isIPad).toBe(false);
      expect(deviceInfo.model).toContain('iPhone');
    });

    it('should detect iPad from user agent', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';
      mockNavigator.platform = 'iPad';
      mockScreen.width = 1024;
      mockScreen.height = 1366;
      
      const detector = IOSDetector.getInstance();
      const deviceInfo = detector.detectDevice();
      
      expect(deviceInfo.isIOS).toBe(true);
      expect(deviceInfo.isIPhone).toBe(false);
      expect(deviceInfo.isIPad).toBe(true);
    });

    it('should detect iPad with iPadOS 13+ (desktop user agent)', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15';
      mockNavigator.platform = 'MacIntel';
      mockNavigator.maxTouchPoints = 5;
      mockScreen.width = 1024;
      mockScreen.height = 1366;
      
      const detector = IOSDetector.getInstance();
      const deviceInfo = detector.detectDevice();
      
      expect(deviceInfo.isIOS).toBe(true);
      expect(deviceInfo.isIPad).toBe(true);
    });

    it('should not detect iOS on non-iOS devices', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Mobile Safari/537.36';
      mockNavigator.platform = 'Linux armv8l';
      mockNavigator.maxTouchPoints = 5;
      
      const detector = IOSDetector.getInstance();
      const deviceInfo = detector.detectDevice();
      
      expect(deviceInfo.isIOS).toBe(false);
      expect(deviceInfo.isIPhone).toBe(false);
      expect(deviceInfo.isIPad).toBe(false);
    });
  });

  describe('Model Detection', () => {
    it('should detect iPhone 12 by screen dimensions', () => {
      mockNavigator.userAgent = 'iPhone';
      mockScreen.width = 390;
      mockScreen.height = 844;
      mockWindow.innerWidth = 390;
      mockWindow.innerHeight = 844;
      
      const detector = IOSDetector.getInstance();
      const deviceInfo = detector.detectDevice();
      
      expect(deviceInfo.model).toContain('iPhone 12');
    });

    it('should detect iPhone 14 Pro by screen dimensions', () => {
      mockNavigator.userAgent = 'iPhone';
      mockScreen.width = 393;
      mockScreen.height = 852;
      mockWindow.innerWidth = 393;
      mockWindow.innerHeight = 852;
      
      const detector = IOSDetector.getInstance();
      const deviceInfo = detector.detectDevice();
      
      expect(deviceInfo.model).toContain('iPhone 14 Pro');
    });

    it('should detect iPhone SE by screen dimensions', () => {
      mockNavigator.userAgent = 'iPhone';
      mockScreen.width = 320;
      mockScreen.height = 568;
      mockWindow.innerWidth = 320;
      mockWindow.innerHeight = 568;
      
      const detector = IOSDetector.getInstance();
      const deviceInfo = detector.detectDevice();
      
      expect(deviceInfo.model).toContain('iPhone SE');
    });
  });

  describe('Notch Detection', () => {
    it('should detect notch on iPhone X-style devices', () => {
      mockNavigator.userAgent = 'iPhone';
      mockScreen.width = 375;
      mockScreen.height = 812;
      mockWindow.innerWidth = 375;
      mockWindow.innerHeight = 812;
      
      const detector = IOSDetector.getInstance();
      const deviceInfo = detector.detectDevice();
      
      expect(deviceInfo.hasNotch).toBe(true);
    });

    it('should not detect notch on older iPhone models', () => {
      mockNavigator.userAgent = 'iPhone';
      mockScreen.width = 375;
      mockScreen.height = 667;
      mockWindow.innerWidth = 375;
      mockWindow.innerHeight = 667;
      
      const detector = IOSDetector.getInstance();
      const deviceInfo = detector.detectDevice();
      
      expect(deviceInfo.hasNotch).toBe(false);
    });
  });

  describe('Performance Profile', () => {
    it('should assign high performance to iPhone 14 Pro', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
      mockScreen.width = 393;
      mockScreen.height = 852;
      mockWindow.innerWidth = 393;
      mockWindow.innerHeight = 852;
      
      const detector = IOSDetector.getInstance();
      const deviceInfo = detector.detectDevice();
      
      expect(deviceInfo.performanceProfile).toBe('high');
    });

    it('should assign medium performance to iPhone 11', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15';
      mockScreen.width = 414;
      mockScreen.height = 896;
      mockWindow.innerWidth = 414;
      mockWindow.innerHeight = 896;
      
      const detector = IOSDetector.getInstance();
      const deviceInfo = detector.detectDevice();
      
      expect(deviceInfo.performanceProfile).toBe('medium');
    });

    it('should assign low performance to iPhone 6', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15';
      mockScreen.width = 375;
      mockScreen.height = 667;
      mockWindow.innerWidth = 375;
      mockWindow.innerHeight = 667;
      
      const detector = IOSDetector.getInstance();
      const deviceInfo = detector.detectDevice();
      
      expect(deviceInfo.performanceProfile).toBe('low');
    });
  });

  describe('Feature Support', () => {
    it('should detect WebGL support', () => {
      // Mock canvas and WebGL context
      const mockCanvas = {
        getContext: jest.fn().mockReturnValue({}),
      };
      
      global.document = {
        createElement: jest.fn().mockReturnValue(mockCanvas),
      } as any;
      
      const detector = IOSDetector.getInstance();
      const deviceInfo = detector.detectDevice();
      
      expect(deviceInfo.supportsWebGL).toBe(true);
    });

    it('should detect WebAudio support', () => {
      const detector = IOSDetector.getInstance();
      const deviceInfo = detector.detectDevice();
      
      expect(deviceInfo.supportsWebAudio).toBe(true);
    });

    it('should detect touch support', () => {
      Object.defineProperty(global, 'window', {
        value: { ...mockWindow, ontouchstart: true },
        writable: true,
      });
      
      const detector = IOSDetector.getInstance();
      const deviceInfo = detector.detectDevice();
      
      expect(deviceInfo.supportsTouchEvents).toBe(true);
    });
  });

  describe('Audio Constraints', () => {
    it('should provide appropriate audio constraints for iOS 15+', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15';
      
      const detector = IOSDetector.getInstance();
      const deviceInfo = detector.detectDevice();
      
      expect(deviceInfo.audioConstraints.requiresUserInteraction).toBe(true);
      expect(deviceInfo.audioConstraints.maxSampleRate).toBe(48000);
      expect(deviceInfo.audioConstraints.maxChannels).toBe(2);
    });

    it('should provide conservative constraints for older iOS versions', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15';
      
      const detector = IOSDetector.getInstance();
      const deviceInfo = detector.detectDevice();
      
      expect(deviceInfo.audioConstraints.maxSampleRate).toBe(44100);
      expect(deviceInfo.audioConstraints.bufferSizeLimit).toBe(4096);
    });
  });

  describe('Recommended Settings', () => {
    it('should provide high-performance settings for iPhone 14 Pro', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
      mockScreen.width = 393;
      mockScreen.height = 852;
      mockWindow.innerWidth = 393;
      mockWindow.innerHeight = 852;
      
      const detector = IOSDetector.getInstance();
      const settings = detector.getRecommendedSettings();
      
      expect(settings.maxParticles).toBe(500000);
      expect(settings.renderScale).toBe(1.0);
      expect(settings.enabledFeatures).toContain('webgl');
      expect(settings.enabledFeatures).toContain('devicemotion');
    });

    it('should provide conservative settings for iPhone SE', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15';
      mockScreen.width = 320;
      mockScreen.height = 568;
      mockWindow.innerWidth = 320;
      mockWindow.innerHeight = 568;
      
      const detector = IOSDetector.getInstance();
      const settings = detector.getRecommendedSettings();
      
      expect(settings.maxParticles).toBe(100000);
      expect(settings.renderScale).toBe(0.6);
      expect(settings.enabledFeatures).toContain('webgl');
      expect(settings.enabledFeatures).not.toContain('devicemotion');
    });
  });

  describe('Safe Area Insets', () => {
    it('should return zero insets for devices without notch', () => {
      mockNavigator.userAgent = 'iPhone';
      mockScreen.width = 375;
      mockScreen.height = 667;
      mockWindow.innerWidth = 375;
      mockWindow.innerHeight = 667;
      
      const detector = IOSDetector.getInstance();
      const insets = detector.getSafeAreaInsets();
      
      expect(insets.top).toBe(0);
      expect(insets.bottom).toBe(0);
      expect(insets.left).toBe(0);
      expect(insets.right).toBe(0);
    });

    it('should return appropriate insets for devices with notch', () => {
      mockNavigator.userAgent = 'iPhone';
      mockScreen.width = 375;
      mockScreen.height = 812;
      mockWindow.innerWidth = 375;
      mockWindow.innerHeight = 812;
      
      // Mock CSS custom properties
      global.getComputedStyle = jest.fn().mockReturnValue({
        getPropertyValue: jest.fn().mockReturnValue('44'),
      });
      
      const detector = IOSDetector.getInstance();
      const insets = detector.getSafeAreaInsets();
      
      expect(insets.top).toBeGreaterThan(0);
      expect(insets.bottom).toBeGreaterThan(0);
    });
  });

  describe('Feature Support Detection', () => {
    it('should correctly identify WebGL2 support based on iOS version', () => {
      const detector = IOSDetector.getInstance();
      
      // Test iOS 15 - should support WebGL2
      mockNavigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15';
      expect(detector.supportsFeature('webgl2')).toBe(true);
      
      // Test iOS 12 - should not support WebGL2
      mockNavigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15';
      expect(detector.supportsFeature('webgl2')).toBe(false);
    });

    it('should correctly identify fullscreen support', () => {
      const detector = IOSDetector.getInstance();
      
      // Test iOS 12 - should support fullscreen
      mockNavigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15';
      expect(detector.supportsFeature('fullscreen')).toBe(true);
      
      // Test iOS 10 - should not support fullscreen
      mockNavigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_0 like Mac OS X) AppleWebKit/605.1.15';
      expect(detector.supportsFeature('fullscreen')).toBe(false);
    });
  });
});