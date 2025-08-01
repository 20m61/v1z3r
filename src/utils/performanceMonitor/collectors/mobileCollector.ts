/**
 * Mobile Performance Collector
 * Monitors mobile-specific metrics: battery, touch latency, network, device motion
 */

import { MetricCollector, MobileMetrics, PerformanceSnapshot } from '../types';

export class MobileCollector implements MetricCollector {
  name = 'mobile';
  enabled = true;

  private batteryManager?: any;
  private touchLatencyHistory: number[] = [];
  private networkInfo?: any;
  private orientationHistory: string[] = [];
  private touchStartTime: number = 0;

  constructor() {
    // Only enable on mobile devices
    this.enabled = this.isMobileDevice();
  }

  async initialize(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    console.log('Initializing mobile performance collector...');
    
    await this.initializeBatteryAPI();
    this.initializeNetworkInfo();
    this.initializeTouchTracking();
    this.initializeOrientationTracking();
  }

  cleanup(): void {
    // Clear histories and remove event listeners
    this.touchLatencyHistory = [];
    this.orientationHistory = [];
    
    // Remove touch event listeners
    if (typeof document !== 'undefined') {
      document.removeEventListener('touchstart', this.handleTouchStart);
      document.removeEventListener('touchend', this.handleTouchEnd);
    }
    
    // Remove orientation listener
    if (typeof window !== 'undefined') {
      window.removeEventListener('orientationchange', this.handleOrientationChange);
    }
  }

  async collect(): Promise<Partial<PerformanceSnapshot>> {
    if (!this.enabled) {
      return {};
    }

    const mobileMetrics = await this.collectMobileMetrics();

    return {
      mobile: mobileMetrics,
    };
  }

  /**
   * Check if running on mobile device
   */
  private isMobileDevice(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }

    // Check user agent
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
    const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));

    // Check for touch support
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Check screen size (rough mobile detection)
    const isSmallScreen = window.innerWidth <= 768;

    return isMobileUA || (hasTouch && isSmallScreen);
  }

  /**
   * Initialize Battery API
   */
  private async initializeBatteryAPI(): Promise<void> {
    if (typeof navigator === 'undefined') {
      return;
    }

    try {
      // Try to get battery manager
      if ('getBattery' in navigator) {
        this.batteryManager = await (navigator as any).getBattery();
        console.log('Battery API initialized');
      } else if ('battery' in navigator) {
        this.batteryManager = (navigator as any).battery;
        console.log('Battery API (legacy) initialized');
      } else {
        console.log('Battery API not available');
      }
    } catch (error) {
      console.warn('Failed to initialize battery API:', error);
    }
  }

  /**
   * Initialize network information
   */
  private initializeNetworkInfo(): void {
    if (typeof navigator === 'undefined') {
      return;
    }

    try {
      // Get network connection info
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection;
      
      if (connection) {
        this.networkInfo = connection;
        console.log('Network info initialized');
      }
    } catch (error) {
      console.warn('Failed to initialize network info:', error);
    }
  }

  /**
   * Initialize touch latency tracking
   */
  private initializeTouchTracking(): void {
    if (typeof document === 'undefined') {
      return;
    }

    document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
    document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
  }

  /**
   * Initialize orientation tracking
   */
  private initializeOrientationTracking(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('orientationchange', this.handleOrientationChange.bind(this));
    
    // Record initial orientation
    this.recordCurrentOrientation();
  }

  /**
   * Handle touch start event
   */
  private handleTouchStart(event: TouchEvent): void {
    this.touchStartTime = performance.now();
  }

  /**
   * Handle touch end event
   */
  private handleTouchEnd(event: TouchEvent): void {
    if (this.touchStartTime > 0) {
      const touchLatency = performance.now() - this.touchStartTime;
      this.trackTouchLatency(touchLatency);
      this.touchStartTime = 0;
    }
  }

  /**
   * Handle orientation change
   */
  private handleOrientationChange(): void {
    setTimeout(() => {
      this.recordCurrentOrientation();
    }, 100); // Small delay to ensure orientation has changed
  }

  /**
   * Record current device orientation
   */
  private recordCurrentOrientation(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const orientation = window.screen?.orientation?.type || 
                       (window.orientation !== undefined ? `${window.orientation}deg` : 'unknown');
    
    this.orientationHistory.push(orientation);
    
    // Keep only last 10 orientation changes
    if (this.orientationHistory.length > 10) {
      this.orientationHistory.shift();
    }
  }

  /**
   * Track touch latency
   */
  private trackTouchLatency(latency: number): void {
    this.touchLatencyHistory.push(latency);
    
    // Keep only last 60 measurements
    if (this.touchLatencyHistory.length > 60) {
      this.touchLatencyHistory.shift();
    }
  }

  /**
   * Collect comprehensive mobile metrics
   */
  private async collectMobileMetrics(): Promise<MobileMetrics> {
    const battery = await this.getBatteryInfo();
    const network = this.getNetworkInfo();
    const touchLatency = this.getAverageTouchLatency();
    const deviceMotion = this.hasDeviceMotion();
    const orientation = this.getCurrentOrientation();

    return {
      battery,
      network,
      touchLatency,
      deviceMotion,
      orientation,
    };
  }

  /**
   * Get battery information
   */
  private async getBatteryInfo(): Promise<{ level: number; charging: boolean } | undefined> {
    if (!this.batteryManager) {
      return undefined;
    }

    try {
      return {
        level: Math.round(this.batteryManager.level * 100),
        charging: this.batteryManager.charging,
      };
    } catch (error) {
      console.warn('Failed to get battery info:', error);
      return undefined;
    }
  }

  /**
   * Get network information
   */
  private getNetworkInfo(): { type: string; downlink?: number } | undefined {
    if (!this.networkInfo) {
      return undefined;
    }

    try {
      return {
        type: this.networkInfo.effectiveType || this.networkInfo.type || 'unknown',
        downlink: this.networkInfo.downlink,
      };
    } catch (error) {
      console.warn('Failed to get network info:', error);
      return undefined;
    }
  }

  /**
   * Get average touch latency
   */
  private getAverageTouchLatency(): number {
    if (this.touchLatencyHistory.length === 0) {
      return 0;
    }

    return this.touchLatencyHistory.reduce((a, b) => a + b, 0) / this.touchLatencyHistory.length;
  }

  /**
   * Check if device motion is available
   */
  private hasDeviceMotion(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return 'DeviceMotionEvent' in window && 'DeviceOrientationEvent' in window;
  }

  /**
   * Get current orientation
   */
  private getCurrentOrientation(): string | undefined {
    if (this.orientationHistory.length === 0) {
      return undefined;
    }

    return this.orientationHistory[this.orientationHistory.length - 1];
  }

  /**
   * Get mobile performance statistics
   */
  getMobilePerformanceStats(): {
    batteryEfficiency: number; // 0-100 score
    touchResponsiveness: number; // 0-100 score
    networkQuality: number; // 0-100 score
    deviceStability: number; // 0-100 score
  } {
    let batteryEfficiency = 100;
    let touchResponsiveness = 100;
    let networkQuality = 100;
    let deviceStability = 100;

    // Battery efficiency score
    if (this.batteryManager) {
      const level = this.batteryManager.level * 100;
      if (level < 20) batteryEfficiency = 30;
      else if (level < 50) batteryEfficiency = 70;
      
      // Bonus for charging
      if (this.batteryManager.charging) batteryEfficiency = Math.min(100, batteryEfficiency + 20);
    }

    // Touch responsiveness score
    if (this.touchLatencyHistory.length > 0) {
      const avgLatency = this.getAverageTouchLatency();
      if (avgLatency > 100) touchResponsiveness = 40;
      else if (avgLatency > 50) touchResponsiveness = 70;
      else if (avgLatency > 25) touchResponsiveness = 85;
    }

    // Network quality score
    if (this.networkInfo) {
      const effectiveType = this.networkInfo.effectiveType;
      switch (effectiveType) {
        case '4g':
          networkQuality = 100;
          break;
        case '3g':
          networkQuality = 70;
          break;
        case '2g':
          networkQuality = 40;
          break;
        case 'slow-2g':
          networkQuality = 20;
          break;
        default:
          networkQuality = 60;
      }
    }

    // Device stability score (based on orientation changes)
    const recentOrientationChanges = this.orientationHistory.length;
    if (recentOrientationChanges > 5) {
      deviceStability = 60; // Frequent orientation changes may indicate instability
    } else if (recentOrientationChanges > 2) {
      deviceStability = 80;
    }

    return {
      batteryEfficiency,
      touchResponsiveness,
      networkQuality,
      deviceStability,
    };
  }

  /**
   * Get mobile optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.getMobilePerformanceStats();

    if (stats.batteryEfficiency < 50) {
      recommendations.push('Low battery detected - enable power saving mode');
    }

    if (stats.touchResponsiveness < 70) {
      recommendations.push('High touch latency - optimize touch event handling');
    }

    if (stats.networkQuality < 50) {
      recommendations.push('Poor network quality - reduce network requests and optimize assets');
    }

    if (stats.deviceStability < 70) {
      recommendations.push('Device instability detected - implement orientation change handling');
    }

    // Battery-specific recommendations
    if (this.batteryManager) {
      const level = this.batteryManager.level * 100;
      if (level < 20 && !this.batteryManager.charging) {
        recommendations.push('Critical battery level - reduce CPU and GPU intensive operations');
      }
    }

    // Network-specific recommendations
    if (this.networkInfo && this.networkInfo.effectiveType === 'slow-2g') {
      recommendations.push('Very slow network - consider offline mode or minimal functionality');
    }

    // Touch-specific recommendations
    const avgTouchLatency = this.getAverageTouchLatency();
    if (avgTouchLatency > 100) {
      recommendations.push('High touch latency - use passive event listeners and optimize render cycles');
    }

    return recommendations;
  }

  /**
   * Check if device is in power saving mode
   */
  isPowerSavingMode(): boolean {
    if (!this.batteryManager) {
      return false;
    }

    const level = this.batteryManager.level * 100;
    const isCharging = this.batteryManager.charging;

    // Consider power saving if battery is low and not charging
    return level < 20 && !isCharging;
  }

  /**
   * Get device thermal state estimation
   */
  estimateThermalState(): 'normal' | 'warm' | 'hot' | 'critical' {
    // This is an estimation based on performance degradation
    // Real thermal API is limited in browsers
    
    const avgTouchLatency = this.getAverageTouchLatency();
    const orientationChanges = this.orientationHistory.length;

    // High touch latency might indicate thermal throttling
    if (avgTouchLatency > 150) return 'critical';
    if (avgTouchLatency > 100) return 'hot';
    if (avgTouchLatency > 75) return 'warm';
    
    // Frequent orientation changes might indicate user trying to cool device
    if (orientationChanges > 8) return 'hot';
    if (orientationChanges > 5) return 'warm';

    return 'normal';
  }

  /**
   * Get mobile device capabilities
   */
  getDeviceCapabilities(): {
    touchPoints: number;
    orientationSupport: boolean;
    motionSupport: boolean;
    batteryAPI: boolean;
    networkAPI: boolean;
    vibrationSupport: boolean;
  } {
    return {
      touchPoints: navigator.maxTouchPoints || 0,
      orientationSupport: typeof window !== 'undefined' && 'orientation' in window,
      motionSupport: this.hasDeviceMotion(),
      batteryAPI: !!this.batteryManager,
      networkAPI: !!this.networkInfo,
      vibrationSupport: typeof navigator !== 'undefined' && 'vibrate' in navigator,
    };
  }

  /**
   * Test touch responsiveness
   */
  async testTouchResponsiveness(): Promise<number> {
    return new Promise((resolve) => {
      if (typeof document === 'undefined') {
        resolve(0);
        return;
      }

      const testElement = document.createElement('div');
      testElement.style.position = 'fixed';
      testElement.style.top = '50%';
      testElement.style.left = '50%';
      testElement.style.width = '100px';
      testElement.style.height = '100px';
      testElement.style.zIndex = '9999';
      testElement.style.opacity = '0';
      testElement.style.pointerEvents = 'auto';
      
      document.body.appendChild(testElement);

      let startTime: number;
      let responseTime: number;

      const touchStart = () => {
        startTime = performance.now();
      };

      const touchEnd = () => {
        responseTime = performance.now() - startTime;
        cleanup();
        resolve(responseTime);
      };

      const cleanup = () => {
        testElement.removeEventListener('touchstart', touchStart);
        testElement.removeEventListener('touchend', touchEnd);
        document.body.removeChild(testElement);
      };

      testElement.addEventListener('touchstart', touchStart, { passive: true });
      testElement.addEventListener('touchend', touchEnd, { passive: true });

      // Simulate touch after a short delay
      setTimeout(() => {
        const touch = new Touch({
          identifier: 1,
          target: testElement,
          clientX: 50,
          clientY: 50,
        });

        const touchStartEvent = new TouchEvent('touchstart', {
          touches: [touch],
          changedTouches: [touch],
        });

        const touchEndEvent = new TouchEvent('touchend', {
          touches: [],
          changedTouches: [touch],
        });

        testElement.dispatchEvent(touchStartEvent);
        setTimeout(() => {
          testElement.dispatchEvent(touchEndEvent);
        }, 10);
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        cleanup();
        resolve(0);
      }, 5000);
    });
  }
}