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
  metadata?: Record<string, unknown>;
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
export interface RUMConfig {
  endpoint: string;
  batchSize?: number;
  interval?: number;
  enableTracking?: boolean;
  privacyMode?: boolean;
  sanitizePII?: boolean;
}

export class RealUserMonitoring {
  private metrics: Partial<PerformanceMetrics> = {};
  private userActions: UserAction[] = [];
  private sessionId: string;
  private isInitialized = false;
  private observers: PerformanceObserver[] = [];
  private eventListeners: Array<{ element: EventTarget; event: string; handler: EventListener }> = [];
  private reportingEndpoint: string;
  private batchSize = 10;
  private reportingInterval = 30000; // 30 seconds
  private reportingTimer: NodeJS.Timeout | null = null;
  private actionCheckTimer: NodeJS.Timeout | null = null;
  private config: RUMConfig;
  private userConsent = false;

  constructor(config: RUMConfig) {
    this.config = {
      enableTracking: false, // Disabled by default for privacy
      privacyMode: true,
      sanitizePII: true,
      ...config
    };
    this.reportingEndpoint = config.endpoint;
    this.batchSize = config.batchSize || 10;
    this.reportingInterval = config.interval || 30000;
    this.sessionId = this.generateSessionId();
    
    // Check for user consent before initializing
    if (typeof window !== 'undefined') {
      this.checkUserConsent();
    }
  }

  /**
   * Initialize RUM tracking
   */
  /**
   * Check for user consent before tracking
   */
  private checkUserConsent(): void {
    // Check localStorage for consent
    const consent = localStorage.getItem('rum-consent');
    this.userConsent = consent === 'true';
    
    if (this.userConsent && this.config.enableTracking) {
      this.initialize();
    }
  }
  
  /**
   * Request user consent for tracking
   */
  requestConsent(): Promise<boolean> {
    return new Promise((resolve) => {
      // In a real implementation, this would show a consent dialog
      const consent = window.confirm('Allow performance monitoring to improve your experience?');
      this.userConsent = consent;
      localStorage.setItem('rum-consent', consent.toString());
      
      if (consent && this.config.enableTracking) {
        this.initialize();
      }
      
      resolve(consent);
    });
  }
  
  private initialize(): void {
    if (this.isInitialized || !this.userConsent || !this.config.enableTracking) return;

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
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
        if (lastEntry) {
          this.metrics.LCP = lastEntry.startTime;
        }
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);

      // First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const fidEntry = entry as PerformanceEntry & { processingStart: number; startTime: number };
          if (entry.name === 'first-input') {
            this.metrics.FID = fidEntry.processingStart - fidEntry.startTime;
          }
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);

      // Cumulative Layout Shift (CLS)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const layoutEntry = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
          if (!layoutEntry.hadRecentInput) {
            clsValue += layoutEntry.value;
            this.metrics.CLS = clsValue;
          }
        });
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);

      // First Contentful Paint (FCP)
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const paintEntry = entry as PerformanceEntry & { startTime: number };
          if (entry.name === 'first-contentful-paint') {
            this.metrics.FCP = paintEntry.startTime;
          }
        });
      });
      fcpObserver.observe({ entryTypes: ['paint'] });
      this.observers.push(fcpObserver);

      // Long Tasks (for TTI calculation)
      const longTaskObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const taskEntry = entry as PerformanceEntry & { 
            duration: number; 
            startTime: number; 
            attribution?: unknown 
          };
          this.trackUserAction({
            type: 'long-task',
            target: 'main-thread',
            timestamp: Date.now(),
            duration: taskEntry.duration,
            metadata: {
              startTime: taskEntry.startTime,
              attribution: taskEntry.attribution
            }
          });
        });
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
      this.observers.push(longTaskObserver);

    } catch (error) {
      errorHandler.warn('Failed to setup performance observers', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Set up error tracking
   */
  private setupErrorTracking(): void {
    // Global error handler
    const errorHandler = (event: ErrorEvent) => {
      const sanitizedError = this.sanitizeError({
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
      this.reportError(sanitizedError);
    };
    
    window.addEventListener('error', errorHandler);
    this.eventListeners.push({ element: window, event: 'error', handler: errorHandler as EventListener });

    // Unhandled promise rejections
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      const sanitizedError = this.sanitizeError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        sessionId: this.sessionId
      });
      this.reportError(sanitizedError);
    };
    
    window.addEventListener('unhandledrejection', rejectionHandler);
    this.eventListeners.push({ element: window, event: 'unhandledrejection', handler: rejectionHandler as EventListener });
  }

  /**
   * Set up user action tracking
   */
  private setupUserActionTracking(): void {
    // Click tracking
    const clickHandler = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const selector = this.getSanitizedElementSelector(target);
      if (selector) {
        this.trackUserAction({
          type: 'click',
          target: selector,
          timestamp: Date.now(),
          metadata: {
            x: event.clientX,
            y: event.clientY,
            button: event.button
          }
        });
      }
    };
    
    document.addEventListener('click', clickHandler);
    this.eventListeners.push({ element: document, event: 'click', handler: clickHandler as EventListener });

    // Key interactions
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        const selector = this.getSanitizedElementSelector(event.target as HTMLElement);
        if (selector) {
          this.trackUserAction({
            type: 'keydown',
            target: selector,
            timestamp: Date.now(),
            metadata: {
              key: event.key,
              ctrlKey: event.ctrlKey,
              shiftKey: event.shiftKey
            }
          });
        }
      }
    };
    
    document.addEventListener('keydown', keyHandler);
    this.eventListeners.push({ element: document, event: 'keydown', handler: keyHandler as EventListener });

    // Visibility changes
    const visibilityHandler = () => {
      this.trackUserAction({
        type: 'visibility-change',
        target: 'document',
        timestamp: Date.now(),
        metadata: {
          hidden: document.hidden
        }
      });
    };
    
    document.addEventListener('visibilitychange', visibilityHandler);
    this.eventListeners.push({ element: document, event: 'visibilitychange', handler: visibilityHandler });
  }

  /**
   * Set up periodic reporting
   */
  private setupReporting(): void {
    // Report on page unload
    const unloadHandler = () => {
      this.sendReport(true);
    };
    
    window.addEventListener('beforeunload', unloadHandler);
    this.eventListeners.push({ element: window, event: 'beforeunload', handler: unloadHandler });

    // Periodic reporting
    this.reportingTimer = setInterval(() => {
      this.sendReport();
    }, this.reportingInterval);

    // Report when user actions reach batch size
    this.actionCheckTimer = setInterval(() => {
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
  private sendData(data: unknown, immediate = false): void {
    if (!this.isValidEndpoint(this.reportingEndpoint)) {
      errorHandler.error('Invalid RUM endpoint URL');
      return;
    }
    
    try {
      const payload = JSON.stringify(data);

      if (immediate && 'sendBeacon' in navigator) {
        // Use sendBeacon for reliable delivery on page unload
        navigator.sendBeacon(this.reportingEndpoint, payload);
      } else {
        // Use fetch for regular reporting with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        fetch(this.reportingEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: payload,
          keepalive: true,
          signal: controller.signal
        })
        .then(() => clearTimeout(timeoutId))
        .catch(error => {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            errorHandler.warn('RUM data send timeout');
          } else {
            errorHandler.warn('Failed to send RUM data', error instanceof Error ? error : new Error(String(error)));
          }
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
    const nav = navigator as Navigator & { connection?: { effectiveType?: string } };
    return nav.connection?.effectiveType || 'unknown';
  }

  private getSanitizedElementSelector(element: HTMLElement): string {
    if (!this.config.sanitizePII) {
      return this.getElementSelector(element);
    }
    
    // Sanitize potentially sensitive selectors
    if (element.id && !this.isSensitiveId(element.id)) {
      return `#${element.id}`;
    }
    
    if (element.className) {
      const classes = element.className.split(' ');
      const safeClass = classes.find(cls => !this.isSensitiveClass(cls));
      if (safeClass) return `.${safeClass}`;
    }
    
    return element.tagName.toLowerCase();
  }
  
  private getElementSelector(element: HTMLElement): string {
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(' ')[0]}`;
    return element.tagName.toLowerCase();
  }
  
  private isSensitiveId(id: string): boolean {
    const sensitivePatterns = ['email', 'password', 'ssn', 'credit', 'phone', 'address'];
    return sensitivePatterns.some(pattern => id.toLowerCase().includes(pattern));
  }
  
  private isSensitiveClass(className: string): boolean {
    const sensitivePatterns = ['email', 'password', 'private', 'sensitive', 'personal'];
    return sensitivePatterns.some(pattern => className.toLowerCase().includes(pattern));
  }
  
  private sanitizeError(error: ErrorReport): ErrorReport {
    if (!this.config.sanitizePII) {
      return error;
    }
    
    // Remove potential PII from error messages
    const sanitized = { ...error };
    sanitized.message = this.sanitizeString(error.message);
    if (error.stack) {
      sanitized.stack = this.sanitizeString(error.stack);
    }
    
    return sanitized;
  }
  
  private sanitizeString(str: string): string {
    // Remove email addresses
    str = str.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
    
    // Remove potential credit card numbers
    str = str.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');
    
    // Remove potential phone numbers
    str = str.replace(/\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/g, '[PHONE]');
    
    return str;
  }
  
  private isValidEndpoint(url: string): boolean {
    try {
      const parsed = new URL(url, window.location.origin);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
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
    // Disconnect all observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    
    // Remove all event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
    
    // Clear timers
    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
      this.reportingTimer = null;
    }
    
    if (this.actionCheckTimer) {
      clearInterval(this.actionCheckTimer);
      this.actionCheckTimer = null;
    }
    
    // Send final report
    this.sendReport(true);
    
    this.isInitialized = false;
  }
}

// Export singleton instance (disabled by default)
export const rum = new RealUserMonitoring({
  endpoint: process.env.NEXT_PUBLIC_RUM_ENDPOINT || '/api/rum',
  batchSize: 10,
  interval: 30000,
  enableTracking: process.env.NEXT_PUBLIC_RUM_ENABLED === 'true',
  privacyMode: true,
  sanitizePII: true
});