/**
 * iOS Device Detection and Capability Assessment
 * Handles iOS-specific quirks and limitations
 */

export interface IOSDeviceInfo {
  isIOS: boolean;
  isIPhone: boolean;
  isIPad: boolean;
  isSafari: boolean;
  isWebView: boolean;
  isPWA: boolean;
  version: string;
  model: string;
  hasNotch: boolean;
  supportsTouchEvents: boolean;
  supportsDeviceMotion: boolean;
  supportsWebGL: boolean;
  supportsWebGPU: boolean;
  supportsWebAudio: boolean;
  maxTouchPoints: number;
  screenInfo: {
    width: number;
    height: number;
    pixelRatio: number;
    availableWidth: number;
    availableHeight: number;
  };
  audioConstraints: {
    requiresUserInteraction: boolean;
    maxSampleRate: number;
    maxChannels: number;
    bufferSizeLimit: number;
  };
  performanceProfile: 'low' | 'medium' | 'high';
}

export class IOSDetector {
  private static instance: IOSDetector | null = null;
  private deviceInfo: IOSDeviceInfo | null = null;

  private constructor() {}

  static getInstance(): IOSDetector {
    if (!IOSDetector.instance) {
      IOSDetector.instance = new IOSDetector();
    }
    return IOSDetector.instance;
  }

  /**
   * Detect iOS device information
   */
  detectDevice(): IOSDeviceInfo {
    if (this.deviceInfo) {
      return this.deviceInfo;
    }

    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    
    // iOS Detection
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) || 
                  (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    const isIPhone = /iPhone/.test(userAgent);
    const isIPad = /iPad/.test(userAgent) || 
                   (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    // Safari Detection
    const isSafari = /Safari/.test(userAgent) && !/Chrome|CriOS|FxiOS/.test(userAgent);
    const isWebView = isIOS && !isSafari && !/Safari/.test(userAgent);
    
    // PWA Detection
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  (window.navigator as any).standalone === true;

    // Version Detection
    const versionMatch = userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
    const version = versionMatch ? `${versionMatch[1]}.${versionMatch[2]}${versionMatch[3] ? `.${versionMatch[3]}` : ''}` : 'unknown';

    // Model Detection (approximation)
    const model = this.detectModel(userAgent);

    // Screen Information
    const screenInfo = {
      width: window.screen.width,
      height: window.screen.height,
      pixelRatio: window.devicePixelRatio || 1,
      availableWidth: window.screen.availWidth,
      availableHeight: window.screen.availHeight,
    };

    // Notch Detection (approximation based on screen dimensions)
    const hasNotch = this.detectNotch(screenInfo);

    // Feature Detection
    const supportsTouchEvents = 'ontouchstart' in window;
    const supportsDeviceMotion = 'DeviceMotionEvent' in window;
    const supportsWebGL = this.detectWebGL();
    const supportsWebGPU = this.detectWebGPU();
    const supportsWebAudio = this.detectWebAudio();

    // Audio Constraints
    const audioConstraints = this.getAudioConstraints(version, model);

    // Performance Profile
    const performanceProfile = this.assessPerformanceProfile(model, version);

    this.deviceInfo = {
      isIOS,
      isIPhone,
      isIPad,
      isSafari,
      isWebView,
      isPWA,
      version,
      model,
      hasNotch,
      supportsTouchEvents,
      supportsDeviceMotion,
      supportsWebGL,
      supportsWebGPU,
      supportsWebAudio,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      screenInfo,
      audioConstraints,
      performanceProfile,
    };

    return this.deviceInfo;
  }

  private detectModel(userAgent: string): string {
    // iPhone models based on screen dimensions and user agent
    const models = {
      // iPhone SE (1st gen)
      'iPhone SE': /iPhone SE/.test(userAgent) || 
                   (window.screen.width === 320 && window.screen.height === 568),
      
      // iPhone 6/7/8 series
      'iPhone 6/7/8': window.screen.width === 375 && window.screen.height === 667,
      'iPhone 6/7/8 Plus': window.screen.width === 414 && window.screen.height === 736,
      
      // iPhone X series
      'iPhone X': window.screen.width === 375 && window.screen.height === 812,
      'iPhone XR': window.screen.width === 414 && window.screen.height === 896,
      'iPhone XS Max': window.screen.width === 414 && window.screen.height === 896,
      
      // iPhone 11 series
      'iPhone 11': window.screen.width === 414 && window.screen.height === 896,
      'iPhone 11 Pro': window.screen.width === 375 && window.screen.height === 812,
      'iPhone 11 Pro Max': window.screen.width === 414 && window.screen.height === 896,
      
      // iPhone 12 series
      'iPhone 12/13 mini': window.screen.width === 375 && window.screen.height === 812,
      'iPhone 12/13': window.screen.width === 390 && window.screen.height === 844,
      'iPhone 12/13 Pro': window.screen.width === 390 && window.screen.height === 844,
      'iPhone 12/13 Pro Max': window.screen.width === 428 && window.screen.height === 926,
      
      // iPhone 14 series
      'iPhone 14': window.screen.width === 390 && window.screen.height === 844,
      'iPhone 14 Plus': window.screen.width === 428 && window.screen.height === 926,
      'iPhone 14 Pro': window.screen.width === 393 && window.screen.height === 852,
      'iPhone 14 Pro Max': window.screen.width === 430 && window.screen.height === 932,
      
      // iPhone 15 series
      'iPhone 15': window.screen.width === 393 && window.screen.height === 852,
      'iPhone 15 Plus': window.screen.width === 430 && window.screen.height === 932,
      'iPhone 15 Pro': window.screen.width === 393 && window.screen.height === 852,
      'iPhone 15 Pro Max': window.screen.width === 430 && window.screen.height === 932,
    };

    for (const [model, condition] of Object.entries(models)) {
      if (condition) {
        return model;
      }
    }

    return 'iPhone Unknown';
  }

  private detectNotch(screenInfo: IOSDeviceInfo['screenInfo']): boolean {
    // Devices with notches have specific height/width ratios
    const { width, height } = screenInfo;
    
    // iPhone X and later (with notch) have these dimensions
    const notchDevices = [
      { w: 375, h: 812 }, // iPhone X, XS, 11 Pro, 12 mini, 13 mini
      { w: 414, h: 896 }, // iPhone XR, XS Max, 11, 11 Pro Max
      { w: 390, h: 844 }, // iPhone 12, 13, 14
      { w: 428, h: 926 }, // iPhone 12 Pro Max, 13 Pro Max, 14 Plus
      { w: 393, h: 852 }, // iPhone 14 Pro, 15
      { w: 430, h: 932 }, // iPhone 14 Pro Max, 15 Plus, 15 Pro, 15 Pro Max
    ];

    return notchDevices.some(device => 
      (device.w === width && device.h === height) ||
      (device.w === height && device.h === width)
    );
  }

  private detectWebGL(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    } catch (e) {
      return false;
    }
  }

  private detectWebGPU(): boolean {
    return 'gpu' in navigator;
  }

  private detectWebAudio(): boolean {
    return 'AudioContext' in window || 'webkitAudioContext' in window;
  }

  private getAudioConstraints(version: string, model: string): IOSDeviceInfo['audioConstraints'] {
    const versionNum = parseFloat(version);
    
    // iOS audio constraints
    const constraints = {
      requiresUserInteraction: true, // Always true on iOS
      maxSampleRate: 48000,
      maxChannels: 2,
      bufferSizeLimit: 8192,
    };

    // Older iOS versions have more restrictions
    if (versionNum < 14) {
      constraints.maxSampleRate = 44100;
      constraints.bufferSizeLimit = 4096;
    }

    // iPhone SE and older models have lower limits
    if (model.includes('SE') || model.includes('6') || model.includes('7') || model.includes('8')) {
      constraints.bufferSizeLimit = 2048;
    }

    return constraints;
  }

  private assessPerformanceProfile(model: string, version: string): 'low' | 'medium' | 'high' {
    const versionNum = parseFloat(version);
    
    // High performance: iPhone 12 and later, iOS 15+
    if ((model.includes('12') || model.includes('13') || model.includes('14') || model.includes('15')) &&
        versionNum >= 15) {
      return 'high';
    }
    
    // Medium performance: iPhone X series, 11 series
    if ((model.includes('X') || model.includes('11')) && versionNum >= 13) {
      return 'medium';
    }
    
    // Low performance: older models or iOS versions
    return 'low';
  }

  /**
   * Get safe area insets for devices with notches
   */
  getSafeAreaInsets(): { top: number; bottom: number; left: number; right: number } {
    const deviceInfo = this.detectDevice();
    
    if (!deviceInfo.hasNotch) {
      return { top: 0, bottom: 0, left: 0, right: 0 };
    }

    // Try to get CSS env() values
    const computedStyle = getComputedStyle(document.documentElement);
    
    const safeAreaInsets = {
      top: parseInt(computedStyle.getPropertyValue('--safe-area-inset-top')) || 44,
      bottom: parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom')) || 34,
      left: parseInt(computedStyle.getPropertyValue('--safe-area-inset-left')) || 0,
      right: parseInt(computedStyle.getPropertyValue('--safe-area-inset-right')) || 0,
    };

    return safeAreaInsets;
  }

  /**
   * Get recommended settings for iOS performance
   */
  getRecommendedSettings(): {
    maxParticles: number;
    audioBufferSize: number;
    renderScale: number;
    enabledFeatures: string[];
  } {
    const deviceInfo = this.detectDevice();
    
    switch (deviceInfo.performanceProfile) {
      case 'high':
        return {
          maxParticles: 500000,
          audioBufferSize: 2048,
          renderScale: 1.0,
          enabledFeatures: ['webgl', 'webaudio', 'devicemotion', 'fullscreen'],
        };
      
      case 'medium':
        return {
          maxParticles: 250000,
          audioBufferSize: 1024,
          renderScale: 0.8,
          enabledFeatures: ['webgl', 'webaudio', 'devicemotion'],
        };
      
      case 'low':
      default:
        return {
          maxParticles: 100000,
          audioBufferSize: 512,
          renderScale: 0.6,
          enabledFeatures: ['webgl', 'webaudio'],
        };
    }
  }

  /**
   * Check if current iOS version supports specific features
   */
  supportsFeature(feature: string): boolean {
    const deviceInfo = this.detectDevice();
    const versionNum = parseFloat(deviceInfo.version);
    
    const featureSupport = {
      'webgl2': versionNum >= 15,
      'webgpu': false, // Not yet supported on iOS
      'offscreencanvas': versionNum >= 16,
      'webaudio-worklet': versionNum >= 14,
      'devicemotion-permission': versionNum >= 13,
      'fullscreen': versionNum >= 12,
      'pwa-install': versionNum >= 11.3,
    };

    return featureSupport[feature as keyof typeof featureSupport] || false;
  }

  /**
   * Initialize iOS-specific optimizations
   */
  initializeIOSOptimizations(): void {
    const deviceInfo = this.detectDevice();
    
    if (!deviceInfo.isIOS) return;

    // Disable elastic scrolling on body
    document.body.style.overscrollBehavior = 'none';
    
    // Prevent zoom on double tap
    document.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });

    // Handle viewport changes
    this.handleViewportChanges();
    
    // Set up safe area CSS variables
    this.setupSafeAreaVariables();
  }

  private handleViewportChanges(): void {
    const updateViewport = () => {
      // Update CSS custom properties for viewport dimensions
      document.documentElement.style.setProperty('--viewport-width', `${window.innerWidth}px`);
      document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
    };

    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', () => {
      // Delay to ensure dimensions are updated
      setTimeout(updateViewport, 100);
    });
    
    updateViewport();
  }

  private setupSafeAreaVariables(): void {
    // Set CSS custom properties for safe area insets
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --safe-area-inset-top: env(safe-area-inset-top, 0px);
        --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
        --safe-area-inset-left: env(safe-area-inset-left, 0px);
        --safe-area-inset-right: env(safe-area-inset-right, 0px);
      }
    `;
    document.head.appendChild(style);
  }
}

// Export singleton instance
export const iosDetector = IOSDetector.getInstance();