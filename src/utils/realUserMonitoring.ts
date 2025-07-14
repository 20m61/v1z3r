/**
 * Real User Monitoring (RUM) for Performance Tracking
 * Collects and analyzes real user performance data
 */

import { errorHandler } from './errorHandler';

export interface PerformanceMetrics {
  // Core Web Vitals
  LCP: number | null; // Largest Contentful Paint
  FID: number | null; // First Input Delay
  CLS: number | null; // Cumulative Layout Shift
  
  // Other metrics
  FCP: number | null; // First Contentful Paint
  TTFB: number | null; // Time to First Byte
  TTI: number | null; // Time to Interactive
  
  // Custom metrics
  audioInitTime: number | null;
  visualEffectsLoadTime: number | null;
  serviceWorkerCacheHit: number | null;
  
  // Device info
  deviceType: 'mobile' | 'tablet' | 'desktop';
  connectionType: string;
  browserInfo: string;
  
  // Session info
  sessionId: string;
  userId?: string;
  timestamp: number;
  url: string;
}

export interface UserAction {
  type: string;
  target: string;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface ErrorReport {
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  timestamp: number;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId: string;
}

/**
 * Real User Monitoring class
 */
export class RealUserMonitoring {
  private metrics: Partial<PerformanceMetrics> = {};
  private userActions: UserAction[] = [];
  private sessionId: string;
  private isInitialized = false;
  private observer: PerformanceObserver | null = null;
  private reportingEndpoint: string;
  private batchSize = 10;
  private reportingInterval = 30000; // 30 seconds

  constructor(config: { endpoint: string; batchSize?: number; interval?: number }) {
    this.reportingEndpoint = config.endpoint;
    this.batchSize = config.batchSize || 10;
    this.reportingInterval = config.interval || 30000;
    this.sessionId = this.generateSessionId();
    
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  /**
   * Initialize RUM tracking
   */
  private initialize(): void {
    if (this.isInitialized) return;

    try {
      // Initialize basic metrics
      this.metrics = {
        sessionId: this.sessionId,
        timestamp: Date.now(),
        url: window.location.href,
        deviceType: this.getDeviceType(),
        connectionType: this.getConnectionType(),
        browserInfo: navigator.userAgent,
        LCP: null,
        FID: null,
        CLS: null,
        FCP: null,
        TTFB: null,
        TTI: null,
        audioInitTime: null,
        visualEffectsLoadTime: null,
        serviceWorkerCacheHit: null
      };

      // Set up performance observers
      this.setupPerformanceObservers();
      
      // Set up error tracking
      this.setupErrorTracking();
      
      // Set up user interaction tracking
      this.setupUserActionTracking();
      
      // Set up reporting
      this.setupReporting();
      
      // Track initial page load metrics
      this.trackPageLoadMetrics();

      this.isInitialized = true;
      errorHandler.info('Real User Monitoring initialized', { sessionId: this.sessionId });

    } catch (error) {
      errorHandler.error('Failed to initialize RUM', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Set up performance observers for Core Web Vitals
   */
  private setupPerformanceObservers(): void {
    if (!('PerformanceObserver' in window)) return;

    try {
      // Largest Contentful Paint (LCP)
      this.observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        if (lastEntry) {
          this.metrics.LCP = lastEntry.startTime;
        }
      });
      this.observer.observe({ entryTypes: ['largest-contentful-paint'] });

      // First Input Delay (FID)
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.name === 'first-input') {
            this.metrics.FID = entry.processingStart - entry.startTime;
          }
        });
      }).observe({ entryTypes: ['first-input'] });

      // Cumulative Layout Shift (CLS)
      let clsValue = 0;
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            this.metrics.CLS = clsValue;
          }
        });
      }).observe({ entryTypes: ['layout-shift'] });

      // First Contentful Paint (FCP)
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.FCP = entry.startTime;
          }
        });
      }).observe({ entryTypes: ['paint'] });

      // Long Tasks (for TTI calculation)
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.trackUserAction({
            type: 'long-task',
            target: 'main-thread',
            timestamp: Date.now(),
            duration: entry.duration,
            metadata: {
              startTime: entry.startTime,
              attribution: entry.attribution
            }
          });
        });
      }).observe({ entryTypes: ['longtask'] });

    } catch (error) {
      errorHandler.warn('Failed to setup performance observers', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Set up error tracking
   */
  private setupErrorTracking(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.reportError({
        message: event.message,
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        sessionId: this.sessionId
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        sessionId: this.sessionId
      });
    });
  }

  /**
   * Set up user action tracking
   */
  private setupUserActionTracking(): void {
    // Click tracking
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      this.trackUserAction({
        type: 'click',
        target: this.getElementSelector(target),
        timestamp: Date.now(),
        metadata: {
          x: event.clientX,
          y: event.clientY,
          button: event.button
        }
      });
    });

    // Key interactions
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        this.trackUserAction({
          type: 'keydown',
          target: this.getElementSelector(event.target as HTMLElement),
          timestamp: Date.now(),
          metadata: {
            key: event.key,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey
          }
        });
      }
    });

    // Visibility changes
    document.addEventListener('visibilitychange', () => {
      this.trackUserAction({
        type: 'visibility-change',
        target: 'document',
        timestamp: Date.now(),
        metadata: {
          hidden: document.hidden
        }
      });
    });
  }

  /**
   * Set up periodic reporting
   */
  private setupReporting(): void {
    // Report on page unload
    window.addEventListener('beforeunload', () => {
      this.sendReport(true);
    });

    // Periodic reporting
    setInterval(() => {
      this.sendReport();
    }, this.reportingInterval);

    // Report when user actions reach batch size
    setInterval(() => {
      if (this.userActions.length >= this.batchSize) {
        this.sendReport();
      }
    }, 5000);
  }

  /**
   * Track initial page load metrics
   */
  private trackPageLoadMetrics(): void {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        if (navigation) {
          this.metrics.TTFB = navigation.responseStart - navigation.fetchStart;
          
          // Calculate TTI (simplified version)
          const loadEventEnd = navigation.loadEventEnd;
          this.metrics.TTI = loadEventEnd - navigation.fetchStart;
        }

        // Check service worker cache hit
        this.checkServiceWorkerCacheHit();
        
      }, 100);
    });
  }

  /**
   * Track custom performance metrics
   */
  trackCustomMetric(name: keyof PerformanceMetrics, value: number): void {
    this.metrics[name] = value as any;
  }

  /**
   * Track user actions
   */
  trackUserAction(action: UserAction): void {
    this.userActions.push(action);
    
    // Limit stored actions to prevent memory issues
    if (this.userActions.length > 100) {
      this.userActions = this.userActions.slice(-50);
    }
  }

  /**
   * Report error
   */
  private reportError(error: ErrorReport): void {
    // Send error immediately
    this.sendData({
      type: 'error',
      data: error
    });
  }

  /**
   * Send performance report
   */
  private sendReport(immediate = false): void {
    const report = {
      type: 'performance',
      data: {
        metrics: { ...this.metrics },
        userActions: [...this.userActions],
        timestamp: Date.now()
      }
    };

    this.sendData(report, immediate);
    
    // Clear user actions after reporting
    this.userActions = [];
  }

  /**
   * Send data to reporting endpoint
   */
  private sendData(data: any, immediate = false): void {
    try {
      const payload = JSON.stringify(data);

      if (immediate && 'sendBeacon' in navigator) {
        // Use sendBeacon for reliable delivery on page unload
        navigator.sendBeacon(this.reportingEndpoint, payload);
      } else {
        // Use fetch for regular reporting
        fetch(this.reportingEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: payload,
          keepalive: true
        }).catch(error => {
          errorHandler.warn('Failed to send RUM data', error instanceof Error ? error : new Error(String(error)));
        });
      }
    } catch (error) {
      errorHandler.error('Failed to serialize RUM data', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Utility methods
   */
  private generateSessionId(): string {
    return `rum_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  private getConnectionType(): string {
    const connection = (navigator as any).connection;
    return connection?.effectiveType || 'unknown';
  }

  private getElementSelector(element: HTMLElement): string {
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(' ')[0]}`;
    return element.tagName.toLowerCase();
  }

  private checkServiceWorkerCacheHit(): void {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // Check if resources were served from cache
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const cacheHits = resources.filter(resource => 
        resource.transferSize === 0 && resource.decodedBodySize > 0
      );
      
      this.metrics.serviceWorkerCacheHit = cacheHits.length;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): Partial<PerformanceMetrics> {
    return { ...this.metrics };
  }

  /**
   * Set user ID for tracking
   */
  setUserId(userId: string): void {
    this.metrics.userId = userId;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.sendReport(true);
  }
}

// Export singleton instance
export const rum = new RealUserMonitoring({
  endpoint: '/api/rum',
  batchSize: 10,
  interval: 30000
});