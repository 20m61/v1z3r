/**
 * Rate Limiter for VJ Application
 * 
 * This module provides rate limiting functionality for WebSocket connections,
 * API endpoints, and other resources to prevent abuse and ensure stability.
 */

import { errorHandler } from './errorHandler';

// Rate limiter configuration
export interface RateLimiterConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests allowed in the window
  keyGenerator?: (identifier: string) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Skip counting successful requests
  skipFailedRequests?: boolean; // Skip counting failed requests
  onLimitReached?: (identifier: string) => void; // Callback when limit is reached
}

// Request tracking
interface RequestLog {
  count: number;
  resetTime: number;
  firstRequestTime: number;
}

// Rate limiter implementation
export class RateLimiter {
  private requests = new Map<string, RequestLog>();
  private config: RateLimiterConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimiterConfig) {
    this.config = {
      keyGenerator: (id) => id,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config,
    };

    // Start cleanup interval to remove expired entries
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, Math.min(this.config.windowMs, 60000)); // Cleanup every minute or window, whichever is smaller
  }

  /**
   * Check if a request is allowed
   */
  public isAllowed(identifier: string): boolean {
    const key = this.config.keyGenerator!(identifier);
    const now = Date.now();
    const requestLog = this.requests.get(key);

    // If no previous requests, allow and track
    if (!requestLog) {
      this.requests.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs,
        firstRequestTime: now,
      });
      return true;
    }

    // If window has expired, reset
    if (now >= requestLog.resetTime) {
      this.requests.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs,
        firstRequestTime: now,
      });
      return true;
    }

    // Check if limit is reached
    if (requestLog.count >= this.config.maxRequests) {
      if (this.config.onLimitReached) {
        this.config.onLimitReached(identifier);
      }
      
      errorHandler.warn('Rate limit exceeded', undefined, {
        identifier,
        count: requestLog.count,
        limit: this.config.maxRequests,
        windowMs: this.config.windowMs,
      });
      
      return false;
    }

    // Increment count and allow
    requestLog.count++;
    return true;
  }

  /**
   * Record a successful request (if not skipping successful requests)
   */
  public recordSuccess(identifier: string): void {
    if (this.config.skipSuccessfulRequests) {
      this.removeRequest(identifier);
    }
  }

  /**
   * Record a failed request (if not skipping failed requests)
   */
  public recordFailure(identifier: string): void {
    if (this.config.skipFailedRequests) {
      this.removeRequest(identifier);
    }
  }

  /**
   * Get current request count for identifier
   */
  public getCurrentCount(identifier: string): number {
    const key = this.config.keyGenerator!(identifier);
    const requestLog = this.requests.get(key);
    
    if (!requestLog) return 0;
    
    const now = Date.now();
    if (now >= requestLog.resetTime) return 0;
    
    return requestLog.count;
  }

  /**
   * Get time until reset for identifier
   */
  public getTimeUntilReset(identifier: string): number {
    const key = this.config.keyGenerator!(identifier);
    const requestLog = this.requests.get(key);
    
    if (!requestLog) return 0;
    
    const now = Date.now();
    return Math.max(0, requestLog.resetTime - now);
  }

  /**
   * Remove a request from tracking
   */
  private removeRequest(identifier: string): void {
    const key = this.config.keyGenerator!(identifier);
    const requestLog = this.requests.get(key);
    
    if (requestLog && requestLog.count > 0) {
      requestLog.count--;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, requestLog] of this.requests) {
      if (now >= requestLog.resetTime) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.requests.delete(key);
    }
  }

  /**
   * Reset all rate limits
   */
  public reset(): void {
    this.requests.clear();
  }

  /**
   * Get statistics
   */
  public getStats(): {
    totalTrackedKeys: number;
    activeKeys: number;
    config: RateLimiterConfig;
  } {
    const now = Date.now();
    let activeKeys = 0;

    for (const [, requestLog] of this.requests) {
      if (now < requestLog.resetTime) {
        activeKeys++;
      }
    }

    return {
      totalTrackedKeys: this.requests.size,
      activeKeys,
      config: this.config,
    };
  }

  /**
   * Destroy the rate limiter and cleanup resources
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.requests.clear();
  }
}

// Pre-configured rate limiters for common use cases
export const createAPIRateLimiter = (): RateLimiter => {
  return new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // 100 requests per 15 minutes
    onLimitReached: (identifier) => {
      errorHandler.warn('API rate limit exceeded', undefined, { identifier });
    },
  });
};

export const createWebSocketRateLimiter = (): RateLimiter => {
  return new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 messages per minute
    onLimitReached: (identifier) => {
      errorHandler.warn('WebSocket rate limit exceeded', undefined, { identifier });
    },
  });
};

export const createAudioDataRateLimiter = (): RateLimiter => {
  return new RateLimiter({
    windowMs: 1000, // 1 second
    maxRequests: 60, // 60 FPS max
    skipSuccessfulRequests: true, // Don't count successful audio data updates
    onLimitReached: (identifier) => {
      errorHandler.performanceWarning('Audio data update rate limit exceeded', { identifier });
    },
  });
};

export const createPresetUploadRateLimiter = (): RateLimiter => {
  return new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 uploads per hour
    onLimitReached: (identifier) => {
      errorHandler.warn('Preset upload rate limit exceeded', undefined, { identifier });
    },
  });
};

// Rate limiter middleware for Express-like APIs
export const rateLimiterMiddleware = (rateLimiter: RateLimiter) => {
  return (req: any, res: any, next: any) => {
    // Extract identifier (IP address, user ID, etc.)
    const identifier = req.ip || req.connection?.remoteAddress || 'unknown';
    
    if (!rateLimiter.isAllowed(identifier)) {
      const timeUntilReset = rateLimiter.getTimeUntilReset(identifier);
      
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(timeUntilReset / 1000),
        message: 'Too many requests, please try again later.',
      });
      return;
    }

    // Add rate limit info to response headers
    res.set({
      'X-RateLimit-Limit': rateLimiter.getStats().config.maxRequests.toString(),
      'X-RateLimit-Remaining': (
        rateLimiter.getStats().config.maxRequests - rateLimiter.getCurrentCount(identifier)
      ).toString(),
      'X-RateLimit-Reset': new Date(
        Date.now() + rateLimiter.getTimeUntilReset(identifier)
      ).toISOString(),
    });

    next();
  };
};

// WebSocket rate limiter wrapper
export class WebSocketRateLimiterWrapper {
  private rateLimiter: RateLimiter;
  private connections = new Map<string, WebSocket>();

  constructor(rateLimiter: RateLimiter) {
    this.rateLimiter = rateLimiter;
  }

  /**
   * Register a WebSocket connection
   */
  public registerConnection(connectionId: string, socket: WebSocket): void {
    this.connections.set(connectionId, socket);
  }

  /**
   * Unregister a WebSocket connection
   */
  public unregisterConnection(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  /**
   * Check if a WebSocket message is allowed
   */
  public isMessageAllowed(connectionId: string): boolean {
    return this.rateLimiter.isAllowed(connectionId);
  }

  /**
   * Handle rate limit exceeded for WebSocket
   */
  public handleRateLimitExceeded(connectionId: string): void {
    const socket = this.connections.get(connectionId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'error',
        error: 'Rate limit exceeded',
        message: 'Too many messages, please slow down.',
        retryAfter: Math.ceil(this.rateLimiter.getTimeUntilReset(connectionId) / 1000),
      }));
    }
  }

  /**
   * Process WebSocket message with rate limiting
   */
  public processMessage(connectionId: string, message: any, handler: (message: any) => void): void {
    if (!this.isMessageAllowed(connectionId)) {
      this.handleRateLimitExceeded(connectionId);
      return;
    }

    try {
      handler(message);
      this.rateLimiter.recordSuccess(connectionId);
    } catch (error) {
      this.rateLimiter.recordFailure(connectionId);
      throw error;
    }
  }
}

// Global rate limiters (can be configured per environment)
export const globalRateLimiters = {
  api: createAPIRateLimiter(),
  websocket: createWebSocketRateLimiter(),
  audioData: createAudioDataRateLimiter(),
  presetUpload: createPresetUploadRateLimiter(),
};

// Utility function to get client identifier
export function getClientIdentifier(req: any): string {
  // Try to get user ID first, fall back to IP
  return req.user?.id || req.ip || req.connection?.remoteAddress || 'anonymous';
}

// Export rate limiter for specific use cases
export { RateLimiter };

// For testing purposes
export const __testing = {
  RateLimiter,
  createAPIRateLimiter,
  createWebSocketRateLimiter,
  createAudioDataRateLimiter,
  createPresetUploadRateLimiter,
};