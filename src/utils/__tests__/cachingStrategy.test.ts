/**
 * Tests for Production-Grade Caching Strategies
 */

import {
  MemoryCache,
  RedisCache,
  CacheManager,
  presetCache,
  effectCache,
  userSessionCache,
  type CacheConfig,
  type CacheEntry,
  type CacheMetrics,
} from '../cachingStrategy';

// Mock performance.now for consistent testing
let mockNow = 0;
global.performance = {
  now: jest.fn(() => mockNow),
} as any;

describe('Caching Strategy', () => {
  beforeEach(() => {
    mockNow = 0;
    jest.clearAllMocks();
  });

  describe('MemoryCache', () => {
    let cache: MemoryCache<any>;
    let config: CacheConfig;

    beforeEach(() => {
      config = {
        ttl: 5000, // 5 seconds
        maxSize: 3,
        enableCompression: false,
        enableMetrics: true,
      };
      cache = new MemoryCache(config);
    });

    describe('Basic Operations', () => {
      it('should set and get values', () => {
        cache.set('key1', 'value1');
        expect(cache.get('key1')).toBe('value1');
      });

      it('should return null for non-existent keys', () => {
        expect(cache.get('nonexistent')).toBeNull();
      });

      it('should handle different data types', () => {
        const testData = {
          string: 'test',
          number: 42,
          boolean: true,
          object: { nested: 'value' },
          array: [1, 2, 3],
        };

        Object.entries(testData).forEach(([key, value]) => {
          cache.set(key, value);
          expect(cache.get(key)).toEqual(value);
        });
      });

      it('should check if key exists', () => {
        cache.set('test', 'value');
        expect(cache.has('test')).toBe(true);
        expect(cache.has('nonexistent')).toBe(false);
      });

      it('should delete entries', () => {
        cache.set('test', 'value');
        expect(cache.has('test')).toBe(true);
        
        const deleted = cache.delete('test');
        expect(deleted).toBe(true);
        expect(cache.has('test')).toBe(false);
        
        const notDeleted = cache.delete('nonexistent');
        expect(notDeleted).toBe(false);
      });

      it('should clear all entries', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        
        cache.clear();
        
        expect(cache.get('key1')).toBeNull();
        expect(cache.get('key2')).toBeNull();
      });
    });

    describe('TTL (Time To Live)', () => {
      it('should expire entries after TTL', () => {
        const originalDateNow = Date.now;
        let mockTime = 1000;
        Date.now = jest.fn(() => mockTime);

        cache.set('test', 'value');
        expect(cache.get('test')).toBe('value');

        // Advance time beyond TTL
        mockTime += config.ttl + 1000;
        expect(cache.get('test')).toBeNull();
        expect(cache.has('test')).toBe(false);

        Date.now = originalDateNow;
      });

      it('should not expire entries within TTL', () => {
        const originalDateNow = Date.now;
        let mockTime = 1000;
        Date.now = jest.fn(() => mockTime);

        cache.set('test', 'value');
        
        // Advance time but stay within TTL
        mockTime += config.ttl - 1000;
        expect(cache.get('test')).toBe('value');
        expect(cache.has('test')).toBe(true);

        Date.now = originalDateNow;
      });
    });

    describe('LRU Eviction', () => {
      it('should evict least recently used item when at max size', () => {
        // Fill cache to max size
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        cache.set('key3', 'value3');

        // All should be present
        expect(cache.get('key1')).toBe('value1');
        expect(cache.get('key2')).toBe('value2');
        expect(cache.get('key3')).toBe('value3');

        // Add one more - should evict key1 (least recently used)
        cache.set('key4', 'value4');
        
        expect(cache.get('key1')).toBeNull(); // Evicted
        expect(cache.get('key2')).toBe('value2');
        expect(cache.get('key3')).toBe('value3');
        expect(cache.get('key4')).toBe('value4');
      });

      it('should update access order on get', () => {
        const originalDateNow = Date.now;
        let mockTime = 1000;
        Date.now = jest.fn(() => mockTime++);

        cache.set('key1', 'value1'); // time: 1000
        cache.set('key2', 'value2'); // time: 1001
        cache.set('key3', 'value3'); // time: 1002

        // Access key1 to make it most recently used
        cache.get('key1'); // updates access time to 1003

        // Add new item - should evict key2 (oldest access time: 1001)
        cache.set('key4', 'value4'); // time: 1004

        expect(cache.get('key1')).toBe('value1'); // Still present
        expect(cache.get('key2')).toBeNull(); // Evicted
        expect(cache.get('key3')).toBe('value3');
        expect(cache.get('key4')).toBe('value4');

        Date.now = originalDateNow;
      });

      it('should update existing entries without eviction', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        cache.set('key3', 'value3');

        // Update existing key
        cache.set('key2', 'newValue2');

        expect(cache.get('key1')).toBe('value1');
        expect(cache.get('key2')).toBe('newValue2');
        expect(cache.get('key3')).toBe('value3');
      });
    });

    describe('Compression', () => {
      it('should compress objects when enabled', () => {
        const compressionCache = new MemoryCache({
          ...config,
          enableCompression: true,
        });

        const testObject = { key: 'value', nested: { data: 'test' } };
        compressionCache.set('test', testObject);
        
        // Should get back the original object (decompressed)
        expect(compressionCache.get('test')).toEqual(testObject);
      });

      it('should handle compression errors gracefully', () => {
        const compressionCache = new MemoryCache({
          ...config,
          enableCompression: true,
        });

        // Create object that might cause compression issues
        const circularObj: any = { prop: 'value' };
        circularObj.circular = circularObj;

        expect(() => {
          compressionCache.set('test', circularObj);
        }).not.toThrow();
      });

      it('should not compress when disabled', () => {
        const noCompressionCache = new MemoryCache({
          ...config,
          enableCompression: false,
        });

        const testObject = { key: 'value' };
        noCompressionCache.set('test', testObject);
        expect(noCompressionCache.get('test')).toEqual(testObject);
      });
    });

    describe('Metrics', () => {
      it('should track hits and misses', () => {
        cache.set('test', 'value');
        
        // Hit
        cache.get('test');
        
        // Miss
        cache.get('nonexistent');
        
        const metrics = cache.getMetrics();
        expect(metrics.hits).toBe(1);
        expect(metrics.misses).toBe(1);
        expect(metrics.totalRequests).toBe(2);
      });

      it('should track evictions', () => {
        // Fill cache beyond max size to trigger evictions
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        cache.set('key3', 'value3');
        cache.set('key4', 'value4'); // Should trigger eviction

        const metrics = cache.getMetrics();
        expect(metrics.evictions).toBe(1);
      });

      it('should calculate memory usage', () => {
        cache.set('test', 'value');
        
        const metrics = cache.getMetrics();
        expect(metrics.memoryUsage).toBeGreaterThan(0);
      });

      it('should track average access time', () => {
        mockNow = 100;
        cache.set('test', 'value');
        
        mockNow = 110; // 10ms duration
        cache.get('test');
        
        const metrics = cache.getMetrics();
        expect(metrics.averageAccessTime).toBeGreaterThan(0);
      });

      it('should not track metrics when disabled', () => {
        const noMetricsCache = new MemoryCache({
          ...config,
          enableMetrics: false,
        });

        noMetricsCache.set('test', 'value');
        noMetricsCache.get('test');
        
        const metrics = noMetricsCache.getMetrics();
        expect(metrics.averageAccessTime).toBe(0);
      });

      it('should reset metrics on clear', () => {
        cache.set('test', 'value');
        cache.get('test');
        cache.get('nonexistent');
        
        cache.clear();
        
        const metrics = cache.getMetrics();
        expect(metrics.hits).toBe(0);
        expect(metrics.misses).toBe(0);
        expect(metrics.evictions).toBe(0);
        expect(metrics.totalRequests).toBe(0);
        expect(metrics.averageAccessTime).toBe(0);
        expect(metrics.memoryUsage).toBe(0);
      });
    });

    describe('Size Calculation', () => {
      it('should calculate size for different data types', () => {
        const testCases = [
          { value: 'test', expectedMinSize: 8 },
          { value: 42, expectedMinSize: 8 },
          { value: true, expectedMinSize: 4 },
          { value: { key: 'value' }, expectedMinSize: 20 },
        ];

        testCases.forEach(({ value }) => {
          cache.set('test', value);
          const metrics = cache.getMetrics();
          expect(metrics.memoryUsage).toBeGreaterThan(0);
          cache.clear();
        });
      });
    });
  });

  describe('RedisCache', () => {
    let redisCache: RedisCache;
    let mockClient: any;

    beforeEach(() => {
      mockClient = {
        set: jest.fn().mockResolvedValue('OK'),
        setEx: jest.fn().mockResolvedValue('OK'),
        get: jest.fn(),
        del: jest.fn().mockResolvedValue(1),
        flushDb: jest.fn().mockResolvedValue('OK'),
        quit: jest.fn().mockResolvedValue('OK'),
      };

      redisCache = new RedisCache({
        endpoint: 'localhost',
        port: 6379,
        enableMetrics: true,
      });

      // Mock the client
      (redisCache as any).client = mockClient;
    });

    describe('Basic Operations', () => {
      it('should set values', async () => {
        await redisCache.set('key', 'value');
        
        expect(mockClient.set).toHaveBeenCalledWith('key', '"value"');
      });

      it('should set values with TTL', async () => {
        await redisCache.set('key', 'value', 3600);
        
        expect(mockClient.setEx).toHaveBeenCalledWith('key', 3600, '"value"');
      });

      it('should get values', async () => {
        mockClient.get.mockResolvedValue('"value"');
        
        const result = await redisCache.get('key');
        
        expect(result).toBe('value');
        expect(mockClient.get).toHaveBeenCalledWith('key');
      });

      it('should return null for non-existent keys', async () => {
        mockClient.get.mockResolvedValue(null);
        
        const result = await redisCache.get('nonexistent');
        
        expect(result).toBeNull();
      });

      it('should delete keys', async () => {
        const result = await redisCache.delete('key');
        
        expect(result).toBe(true);
        expect(mockClient.del).toHaveBeenCalledWith('key');
      });

      it('should return false when deleting non-existent keys', async () => {
        mockClient.del.mockResolvedValue(0);
        
        const result = await redisCache.delete('nonexistent');
        
        expect(result).toBe(false);
      });

      it('should clear all data', async () => {
        await redisCache.clear();
        
        expect(mockClient.flushDb).toHaveBeenCalled();
      });

      it('should disconnect', async () => {
        await redisCache.disconnect();
        
        expect(mockClient.quit).toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should handle set errors', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        mockClient.set.mockRejectedValue(new Error('Redis error'));
        
        await expect(redisCache.set('key', 'value')).rejects.toThrow('Redis error');
        expect(consoleErrorSpy).toHaveBeenCalled();
        
        consoleErrorSpy.mockRestore();
      });

      it('should handle get errors', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        mockClient.get.mockRejectedValue(new Error('Redis error'));
        
        const result = await redisCache.get('key');
        
        expect(result).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalled();
        
        consoleErrorSpy.mockRestore();
      });

      it('should handle delete errors', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        mockClient.del.mockRejectedValue(new Error('Redis error'));
        
        const result = await redisCache.delete('key');
        
        expect(result).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalled();
        
        consoleErrorSpy.mockRestore();
      });

      it('should handle clear errors', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        mockClient.flushDb.mockRejectedValue(new Error('Redis error'));
        
        await expect(redisCache.clear()).resolves.not.toThrow();
        expect(consoleErrorSpy).toHaveBeenCalled();
        
        consoleErrorSpy.mockRestore();
      });
    });

    describe('Metrics', () => {
      it('should track hits and misses', async () => {
        mockClient.get.mockResolvedValueOnce('"value"');
        await redisCache.get('hit');
        
        mockClient.get.mockResolvedValueOnce(null);
        await redisCache.get('miss');
        
        const metrics = redisCache.getMetrics();
        expect(metrics.hits).toBe(1);
        expect(metrics.misses).toBe(1);
      });
    });

    describe('Without Client', () => {
      it('should handle operations without connected client', async () => {
        const nonclientCache = new RedisCache({
          endpoint: 'localhost',
          port: 6379,
          enableMetrics: true,
        });

        await expect(nonclientCache.set('key', 'value')).resolves.not.toThrow();
        expect(await nonclientCache.get('key')).toBeNull();
        expect(await nonclientCache.delete('key')).toBe(false);
        await expect(nonclientCache.clear()).resolves.not.toThrow();
        await expect(nonclientCache.disconnect()).resolves.not.toThrow();
      });
    });
  });

  describe('CacheManager', () => {
    let cacheManager: CacheManager;
    let mockRedisClient: any;

    beforeEach(() => {
      mockRedisClient = {
        set: jest.fn().mockResolvedValue('OK'),
        setEx: jest.fn().mockResolvedValue('OK'),
        get: jest.fn(),
        del: jest.fn().mockResolvedValue(1),
        flushDb: jest.fn().mockResolvedValue('OK'),
        quit: jest.fn().mockResolvedValue('OK'),
      };

      cacheManager = new CacheManager({
        l1Config: {
          ttl: 5000,
          maxSize: 10,
          enableCompression: false,
          enableMetrics: true,
        },
        l2Config: {
          endpoint: 'localhost',
          port: 6379,
          enableMetrics: true,
        },
        enableL2: true,
      });

      // Mock the Redis client
      if (cacheManager['l2Cache']) {
        (cacheManager['l2Cache'] as any).client = mockRedisClient;
      }
    });

    describe('Initialization', () => {
      it('should initialize with L1 cache only', () => {
        const l1OnlyManager = new CacheManager({
          l1Config: {
            ttl: 5000,
            maxSize: 10,
            enableCompression: false,
            enableMetrics: true,
          },
          enableL2: false,
        });

        expect(l1OnlyManager['l1Cache']).toBeDefined();
        expect(l1OnlyManager['l2Cache']).toBeNull();
      });

      it('should initialize with both L1 and L2 caches', () => {
        expect(cacheManager['l1Cache']).toBeDefined();
        expect(cacheManager['l2Cache']).toBeDefined();
      });

      it('should initialize L2 cache', async () => {
        await cacheManager.initialize();
        // Should complete without error
        expect(true).toBe(true);
      });
    });

    describe('Multi-layer Operations', () => {
      it('should set in both layers', async () => {
        mockRedisClient.set.mockResolvedValue('OK');
        
        await cacheManager.set('key', 'value');
        
        // Should be in L1
        expect(cacheManager['l1Cache'].get('key')).toBe('value');
        
        // Should call L2
        expect(mockRedisClient.set).toHaveBeenCalledWith('key', '"value"');
      });

      it('should get from L1 first', async () => {
        // Set directly in L1
        cacheManager['l1Cache'].set('key', 'value');
        
        const result = await cacheManager.get('key');
        
        expect(result).toBe('value');
        // Should not call L2
        expect(mockRedisClient.get).not.toHaveBeenCalled();
      });

      it('should fall back to L2 when L1 miss', async () => {
        mockRedisClient.get.mockResolvedValue('"l2value"');
        
        const result = await cacheManager.get('key');
        
        expect(result).toBe('l2value');
        expect(mockRedisClient.get).toHaveBeenCalledWith('key');
        
        // Should now be in L1 too
        expect(cacheManager['l1Cache'].get('key')).toBe('l2value');
      });

      it('should return null when both layers miss', async () => {
        mockRedisClient.get.mockResolvedValue(null);
        
        const result = await cacheManager.get('nonexistent');
        
        expect(result).toBeNull();
      });

      it('should delete from both layers', async () => {
        cacheManager['l1Cache'].set('key', 'value');
        
        await cacheManager.delete('key');
        
        expect(cacheManager['l1Cache'].get('key')).toBeNull();
        expect(mockRedisClient.del).toHaveBeenCalledWith('key');
      });

      it('should clear both layers', async () => {
        cacheManager['l1Cache'].set('key', 'value');
        
        await cacheManager.clear();
        
        expect(cacheManager['l1Cache'].get('key')).toBeNull();
        expect(mockRedisClient.flushDb).toHaveBeenCalled();
      });
    });

    describe('Metrics', () => {
      it('should return metrics from both layers', () => {
        const metrics = cacheManager.getMetrics();
        
        expect(metrics.l1).toBeDefined();
        expect(metrics.l2).toBeDefined();
      });

      it('should return only L1 metrics when L2 disabled', () => {
        const l1OnlyManager = new CacheManager({
          l1Config: {
            ttl: 5000,
            maxSize: 10,
            enableCompression: false,
            enableMetrics: true,
          },
          enableL2: false,
        });

        const metrics = l1OnlyManager.getMetrics();
        
        expect(metrics.l1).toBeDefined();
        expect(metrics.l2).toBeUndefined();
      });
    });

    describe('Disposal', () => {
      it('should dispose L2 cache', async () => {
        await cacheManager.dispose();
        
        expect(mockRedisClient.quit).toHaveBeenCalled();
      });

      it('should handle disposal without L2 cache', async () => {
        const l1OnlyManager = new CacheManager({
          l1Config: {
            ttl: 5000,
            maxSize: 10,
            enableCompression: false,
            enableMetrics: true,
          },
          enableL2: false,
        });

        await expect(l1OnlyManager.dispose()).resolves.not.toThrow();
      });
    });
  });

  describe('Global Cache Instances', () => {
    it('should create preset cache instance', () => {
      expect(presetCache).toBeInstanceOf(CacheManager);
    });

    it('should create effect cache instance', () => {
      expect(effectCache).toBeInstanceOf(CacheManager);
    });

    it('should create user session cache instance', () => {
      expect(userSessionCache).toBeInstanceOf(CacheManager);
    });

    it('should configure L2 cache based on environment', () => {
      // In test environment, L2 should be disabled
      expect(presetCache['l2Cache']).toBeNull();
      expect(effectCache['l2Cache']).toBeNull();
      expect(userSessionCache['l2Cache']).toBeNull();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complex caching scenarios', async () => {
      const cache = new CacheManager({
        l1Config: {
          ttl: 5000,
          maxSize: 2,
          enableCompression: false,
          enableMetrics: true,
        },
        enableL2: false,
      });

      // Fill L1 cache
      await cache.set('key1', { data: 'value1' });
      await cache.set('key2', { data: 'value2' });
      
      // Verify both are retrievable
      expect(await cache.get('key1')).toEqual({ data: 'value1' });
      expect(await cache.get('key2')).toEqual({ data: 'value2' });
      
      // Add third item - should evict key1
      await cache.set('key3', { data: 'value3' });
      
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toEqual({ data: 'value2' });
      expect(await cache.get('key3')).toEqual({ data: 'value3' });
      
      // Check metrics
      const metrics = cache.getMetrics();
      expect(metrics.l1.hits).toBeGreaterThan(0);
      expect(metrics.l1.evictions).toBe(1);
    });

    it('should handle TTL expiration in complex scenarios', async () => {
      const originalDateNow = Date.now;
      let mockTime = 1000;
      Date.now = jest.fn(() => mockTime);

      const cache = new CacheManager({
        l1Config: {
          ttl: 2000, // 2 seconds
          maxSize: 10,
          enableCompression: false,
          enableMetrics: true,
        },
        enableL2: false,
      });

      await cache.set('temp', 'value');
      expect(await cache.get('temp')).toBe('value');
      
      // Advance time beyond TTL
      mockTime += 3000;
      expect(await cache.get('temp')).toBeNull();

      Date.now = originalDateNow;
    });
  });
});