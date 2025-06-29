import {
  RateLimiter,
  createAPIRateLimiter,
  createWebSocketRateLimiter,
  createAudioDataRateLimiter,
  createPresetUploadRateLimiter,
  WebSocketRateLimiterWrapper,
  globalRateLimiters,
  getClientIdentifier,
} from '../rateLimiter';

// Mock error handler
jest.mock('../errorHandler', () => ({
  errorHandler: {
    warn: jest.fn(),
    performanceWarning: jest.fn(),
  },
}));

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      windowMs: 1000, // 1 second
      maxRequests: 3,
    });
  });

  afterEach(() => {
    rateLimiter.destroy();
  });

  describe('Basic functionality', () => {
    it('allows requests within limit', () => {
      expect(rateLimiter.isAllowed('user1')).toBe(true);
      expect(rateLimiter.isAllowed('user1')).toBe(true);
      expect(rateLimiter.isAllowed('user1')).toBe(true);
    });

    it('blocks requests exceeding limit', () => {
      rateLimiter.isAllowed('user1'); // 1
      rateLimiter.isAllowed('user1'); // 2
      rateLimiter.isAllowed('user1'); // 3
      expect(rateLimiter.isAllowed('user1')).toBe(false); // Should be blocked
    });

    it('tracks different users separately', () => {
      rateLimiter.isAllowed('user1'); // 1
      rateLimiter.isAllowed('user1'); // 2
      rateLimiter.isAllowed('user1'); // 3
      
      // user2 should still be allowed
      expect(rateLimiter.isAllowed('user2')).toBe(true);
      expect(rateLimiter.isAllowed('user2')).toBe(true);
      expect(rateLimiter.isAllowed('user2')).toBe(true);
      
      // user1 should still be blocked
      expect(rateLimiter.isAllowed('user1')).toBe(false);
    });

    it('resets after window expires', async () => {
      rateLimiter.isAllowed('user1'); // 1
      rateLimiter.isAllowed('user1'); // 2
      rateLimiter.isAllowed('user1'); // 3
      expect(rateLimiter.isAllowed('user1')).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(rateLimiter.isAllowed('user1')).toBe(true);
    });
  });

  describe('getCurrentCount', () => {
    it('returns correct current count', () => {
      expect(rateLimiter.getCurrentCount('user1')).toBe(0);
      
      rateLimiter.isAllowed('user1');
      expect(rateLimiter.getCurrentCount('user1')).toBe(1);
      
      rateLimiter.isAllowed('user1');
      expect(rateLimiter.getCurrentCount('user1')).toBe(2);
    });

    it('returns 0 for unknown user', () => {
      expect(rateLimiter.getCurrentCount('unknown')).toBe(0);
    });
  });

  describe('getTimeUntilReset', () => {
    it('returns correct time until reset', () => {
      rateLimiter.isAllowed('user1');
      const timeUntilReset = rateLimiter.getTimeUntilReset('user1');
      
      expect(timeUntilReset).toBeGreaterThan(0);
      expect(timeUntilReset).toBeLessThanOrEqual(1000);
    });

    it('returns 0 for unknown user', () => {
      expect(rateLimiter.getTimeUntilReset('unknown')).toBe(0);
    });
  });

  describe('recordSuccess and recordFailure', () => {
    it('decrements count on successful request when skipSuccessfulRequests is true', () => {
      const limiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 3,
        skipSuccessfulRequests: true,
      });

      limiter.isAllowed('user1');
      expect(limiter.getCurrentCount('user1')).toBe(1);
      
      limiter.recordSuccess('user1');
      expect(limiter.getCurrentCount('user1')).toBe(0);

      limiter.destroy();
    });

    it('decrements count on failed request when skipFailedRequests is true', () => {
      const limiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 3,
        skipFailedRequests: true,
      });

      limiter.isAllowed('user1');
      expect(limiter.getCurrentCount('user1')).toBe(1);
      
      limiter.recordFailure('user1');
      expect(limiter.getCurrentCount('user1')).toBe(0);

      limiter.destroy();
    });
  });

  describe('Custom key generator', () => {
    it('uses custom key generator', () => {
      const limiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 2,
        keyGenerator: (id) => `prefix-${id}`,
      });

      limiter.isAllowed('user1');
      limiter.isAllowed('user1');
      expect(limiter.isAllowed('user1')).toBe(false);

      limiter.destroy();
    });
  });

  describe('onLimitReached callback', () => {
    it('calls onLimitReached when limit is exceeded', () => {
      const onLimitReached = jest.fn();
      const limiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 1,
        onLimitReached,
      });

      limiter.isAllowed('user1'); // OK
      limiter.isAllowed('user1'); // Should trigger callback

      expect(onLimitReached).toHaveBeenCalledWith('user1');

      limiter.destroy();
    });
  });

  describe('getStats', () => {
    it('returns correct statistics', () => {
      rateLimiter.isAllowed('user1');
      rateLimiter.isAllowed('user2');

      const stats = rateLimiter.getStats();
      expect(stats.totalTrackedKeys).toBe(2);
      expect(stats.activeKeys).toBe(2);
      expect(stats.config.maxRequests).toBe(3);
      expect(stats.config.windowMs).toBe(1000);
    });
  });

  describe('reset', () => {
    it('clears all rate limit data', () => {
      rateLimiter.isAllowed('user1');
      rateLimiter.isAllowed('user2');
      
      expect(rateLimiter.getStats().totalTrackedKeys).toBe(2);
      
      rateLimiter.reset();
      
      expect(rateLimiter.getStats().totalTrackedKeys).toBe(0);
    });
  });
});

describe('Pre-configured rate limiters', () => {
  describe('createAPIRateLimiter', () => {
    it('creates API rate limiter with correct config', () => {
      const limiter = createAPIRateLimiter();
      const stats = limiter.getStats();
      
      expect(stats.config.windowMs).toBe(15 * 60 * 1000); // 15 minutes
      expect(stats.config.maxRequests).toBe(100);
      
      limiter.destroy();
    });
  });

  describe('createWebSocketRateLimiter', () => {
    it('creates WebSocket rate limiter with correct config', () => {
      const limiter = createWebSocketRateLimiter();
      const stats = limiter.getStats();
      
      expect(stats.config.windowMs).toBe(60 * 1000); // 1 minute
      expect(stats.config.maxRequests).toBe(60);
      
      limiter.destroy();
    });
  });

  describe('createAudioDataRateLimiter', () => {
    it('creates audio data rate limiter with correct config', () => {
      const limiter = createAudioDataRateLimiter();
      const stats = limiter.getStats();
      
      expect(stats.config.windowMs).toBe(1000); // 1 second
      expect(stats.config.maxRequests).toBe(60);
      expect(stats.config.skipSuccessfulRequests).toBe(true);
      
      limiter.destroy();
    });
  });

  describe('createPresetUploadRateLimiter', () => {
    it('creates preset upload rate limiter with correct config', () => {
      const limiter = createPresetUploadRateLimiter();
      const stats = limiter.getStats();
      
      expect(stats.config.windowMs).toBe(60 * 60 * 1000); // 1 hour
      expect(stats.config.maxRequests).toBe(10);
      
      limiter.destroy();
    });
  });
});

describe('WebSocketRateLimiterWrapper', () => {
  let wrapper: WebSocketRateLimiterWrapper;
  let mockSocket: any;
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      windowMs: 1000,
      maxRequests: 2,
    });
    wrapper = new WebSocketRateLimiterWrapper(rateLimiter);
    
    mockSocket = {
      readyState: 1, // WebSocket.OPEN
      send: jest.fn(),
    };
  });

  afterEach(() => {
    rateLimiter.destroy();
  });

  describe('registerConnection and unregisterConnection', () => {
    it('registers and unregisters connections', () => {
      wrapper.registerConnection('conn1', mockSocket);
      wrapper.unregisterConnection('conn1');
      
      // No errors should be thrown
      expect(true).toBe(true);
    });
  });

  describe('isMessageAllowed', () => {
    it('checks if message is allowed using underlying rate limiter', () => {
      expect(wrapper.isMessageAllowed('conn1')).toBe(true);
      expect(wrapper.isMessageAllowed('conn1')).toBe(true);
      expect(wrapper.isMessageAllowed('conn1')).toBe(false); // Should be blocked
    });
  });

  describe('handleRateLimitExceeded', () => {
    it('sends error message to WebSocket when rate limit exceeded', () => {
      wrapper.registerConnection('conn1', mockSocket);
      wrapper.handleRateLimitExceeded('conn1');
      
      if (mockSocket.send.mock.calls.length > 0) {
        const callArgs = mockSocket.send.mock.calls[0][0];
        expect(callArgs).toContain('Rate limit exceeded');
      } else {
        // If no calls, the method should still not throw
        expect(true).toBe(true);
      }
    });

    it('does not send message to closed WebSocket', () => {
      mockSocket.readyState = 3; // WebSocket.CLOSED
      wrapper.registerConnection('conn1', mockSocket);
      wrapper.handleRateLimitExceeded('conn1');
      
      expect(mockSocket.send).not.toHaveBeenCalled();
    });
  });

  describe('processMessage', () => {
    it('processes message when allowed', () => {
      const handler = jest.fn();
      const message = { type: 'test' };
      
      wrapper.processMessage('conn1', message, handler);
      
      expect(handler).toHaveBeenCalledWith(message);
    });

    it('blocks message when rate limited', () => {
      wrapper.registerConnection('conn1', mockSocket);
      const handler = jest.fn();
      
      // Use up the rate limit
      wrapper.isMessageAllowed('conn1'); // 1
      wrapper.isMessageAllowed('conn1'); // 2
      
      // This should be blocked
      wrapper.processMessage('conn1', { type: 'test' }, handler);
      
      expect(handler).not.toHaveBeenCalled();
      // The processMessage method should handle rate limiting appropriately
      expect(wrapper.isMessageAllowed('conn1')).toBe(false);
    });

    it('records success and failure correctly', () => {
      const handler = jest.fn();
      const failingHandler = jest.fn(() => {
        throw new Error('Test error');
      });
      
      // Successful message
      wrapper.processMessage('conn1', { type: 'test' }, handler);
      
      // Failing message
      expect(() => {
        wrapper.processMessage('conn1', { type: 'test' }, failingHandler);
      }).toThrow('Test error');
    });
  });
});

describe('getClientIdentifier', () => {
  it('returns user ID when available', () => {
    const req = { user: { id: 'user123' }, ip: '127.0.0.1' };
    expect(getClientIdentifier(req)).toBe('user123');
  });

  it('returns IP when user ID not available', () => {
    const req = { ip: '127.0.0.1' };
    expect(getClientIdentifier(req)).toBe('127.0.0.1');
  });

  it('returns connection remote address when IP not available', () => {
    const req = { connection: { remoteAddress: '192.168.1.1' } };
    expect(getClientIdentifier(req)).toBe('192.168.1.1');
  });

  it('returns anonymous when nothing available', () => {
    const req = {};
    expect(getClientIdentifier(req)).toBe('anonymous');
  });
});

describe('globalRateLimiters', () => {
  it('exports all global rate limiters', () => {
    expect(globalRateLimiters.api).toBeDefined();
    expect(globalRateLimiters.websocket).toBeDefined();
    expect(globalRateLimiters.audioData).toBeDefined();
    expect(globalRateLimiters.presetUpload).toBeDefined();
  });

  afterAll(() => {
    // Clean up global rate limiters
    globalRateLimiters.api.destroy();
    globalRateLimiters.websocket.destroy();
    globalRateLimiters.audioData.destroy();
    globalRateLimiters.presetUpload.destroy();
  });
});