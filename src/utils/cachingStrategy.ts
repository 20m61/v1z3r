/**
 * Production-grade caching strategies and utilities
 * Implements multi-layer caching for optimal performance
 */

export interface CacheConfig {
  ttl: number;
  maxSize: number;
  enableCompression: boolean;
  enableMetrics: boolean;
}

export interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
  accessCount: number;
  size: number;
  compressed?: boolean;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  totalRequests: number;
  averageAccessTime: number;
  memoryUsage: number;
}

/**
 * In-memory LRU cache with compression support
 */
export class MemoryCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder = new Map<string, number>();
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalRequests: 0,
    averageAccessTime: 0,
    memoryUsage: 0,
  };
  private accessTimes: number[] = [];

  constructor(private config: CacheConfig) {}

  set(key: string, value: T): void {
    const startTime = performance.now();
    
    // Remove old entry if exists
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict if at max size
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    // Create cache entry
    const entry: CacheEntry<T> = {
      value: this.config.enableCompression ? this.compress(value) : value,
      timestamp: Date.now(),
      accessCount: 0,
      size: this.calculateSize(value),
      compressed: this.config.enableCompression,
    };

    this.cache.set(key, entry);
    this.accessOrder.set(key, Date.now());
    this.updateMetrics('set', performance.now() - startTime);
  }

  get(key: string): T | null {
    const startTime = performance.now();
    const entry = this.cache.get(key);

    if (!entry) {
      this.metrics.misses++;
      this.updateMetrics('miss', performance.now() - startTime);
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.config.ttl) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.metrics.misses++;
      this.updateMetrics('miss', performance.now() - startTime);
      return null;
    }

    // Update access info
    entry.accessCount++;
    this.accessOrder.set(key, Date.now());
    this.metrics.hits++;
    this.updateMetrics('hit', performance.now() - startTime);

    return entry.compressed ? this.decompress(entry.value) : entry.value;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check TTL
    if (Date.now() - entry.timestamp > this.config.ttl) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return false;
    }
    
    return true;
  }

  delete(key: string): boolean {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    this.accessOrder.delete(key);
    return existed;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.resetMetrics();
  }

  getMetrics(): CacheMetrics {
    this.metrics.memoryUsage = this.calculateMemoryUsage();
    this.metrics.totalRequests = this.metrics.hits + this.metrics.misses;
    return { ...this.metrics };
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, time] of this.accessOrder) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
      this.metrics.evictions++;
    }
  }

  private compress(value: T): T {
    // Simple JSON compression - in production, use a proper compression library
    if (typeof value === 'object') {
      try {
        const json = JSON.stringify(value);
        // Simulate compression by removing whitespace
        return JSON.parse(json.replace(/\s+/g, '')) as T;
      } catch {
        return value;
      }
    }
    return value;
  }

  private decompress(value: T): T {
    // In a real implementation, this would decompress the value
    return value;
  }

  private calculateSize(value: T): number {
    // Rough size calculation
    if (typeof value === 'string') return value.length * 2;
    if (typeof value === 'number') return 8;
    if (typeof value === 'boolean') return 4;
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value).length * 2;
      } catch {
        return 100; // Fallback
      }
    }
    return 50; // Default
  }

  private calculateMemoryUsage(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  private updateMetrics(operation: string, duration: number): void {
    if (!this.config.enableMetrics) return;

    this.accessTimes.push(duration);
    if (this.accessTimes.length > 1000) {
      this.accessTimes = this.accessTimes.slice(-500); // Keep last 500
    }

    this.metrics.averageAccessTime = 
      this.accessTimes.reduce((sum, time) => sum + time, 0) / this.accessTimes.length;
  }

  private resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0,
      averageAccessTime: 0,
      memoryUsage: 0,
    };
    this.accessTimes = [];
  }
}

/**
 * Redis-compatible cache client for server-side caching
 */
export class RedisCache {
  private client: any = null;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalRequests: 0,
    averageAccessTime: 0,
    memoryUsage: 0,
  };

  constructor(private config: { 
    endpoint: string; 
    port: number; 
    enableMetrics: boolean;
  }) {}

  async connect(): Promise<void> {
    // In a real implementation, connect to Redis
    // const redis = require('redis');
    // this.client = redis.createClient({
    //   host: this.config.endpoint,
    //   port: this.config.port,
    // });
    // await this.client.connect();
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Simulate Redis set operation
      if (this.client) {
        const serialized = JSON.stringify(value);
        if (ttl) {
          await this.client.setEx(key, ttl, serialized);
        } else {
          await this.client.set(key, serialized);
        }
      }
      
      this.updateMetrics('set', performance.now() - startTime);
    } catch (error) {
      console.error('Redis set error:', error);
      throw error;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now();
    
    try {
      // Simulate Redis get operation
      if (this.client) {
        const value = await this.client.get(key);
        if (value) {
          this.metrics.hits++;
          this.updateMetrics('hit', performance.now() - startTime);
          return JSON.parse(value);
        }
      }
      
      this.metrics.misses++;
      this.updateMetrics('miss', performance.now() - startTime);
      return null;
    } catch (error) {
      console.error('Redis get error:', error);
      this.metrics.misses++;
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      if (this.client) {
        const result = await this.client.del(key);
        return result > 0;
      }
      return false;
    } catch (error) {
      console.error('Redis delete error:', error);
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      if (this.client) {
        await this.client.flushDb();
      }
    } catch (error) {
      console.error('Redis clear error:', error);
    }
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  private updateMetrics(operation: string, duration: number): void {
    if (!this.config.enableMetrics) return;
    // Update metrics similar to MemoryCache
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }
}

/**
 * Multi-layer cache manager
 */
export class CacheManager {
  private l1Cache: MemoryCache;
  private l2Cache: RedisCache | null = null;

  constructor(
    private config: {
      l1Config: CacheConfig;
      l2Config?: { endpoint: string; port: number; enableMetrics: boolean };
      enableL2: boolean;
    }
  ) {
    this.l1Cache = new MemoryCache(config.l1Config);
    
    if (config.enableL2 && config.l2Config) {
      this.l2Cache = new RedisCache(config.l2Config);
    }
  }

  async initialize(): Promise<void> {
    if (this.l2Cache) {
      await this.l2Cache.connect();
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    // Set in L1 cache
    this.l1Cache.set(key, value);
    
    // Set in L2 cache if available
    if (this.l2Cache) {
      await this.l2Cache.set(key, value, ttl);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    // Try L1 cache first
    let value = this.l1Cache.get(key) as T | null;
    if (value !== null) {
      return value;
    }

    // Try L2 cache
    if (this.l2Cache) {
      value = await this.l2Cache.get<T>(key);
      if (value !== null) {
        // Populate L1 cache
        this.l1Cache.set(key, value);
        return value;
      }
    }

    return null;
  }

  async delete(key: string): Promise<void> {
    this.l1Cache.delete(key);
    if (this.l2Cache) {
      await this.l2Cache.delete(key);
    }
  }

  async clear(): Promise<void> {
    this.l1Cache.clear();
    if (this.l2Cache) {
      await this.l2Cache.clear();
    }
  }

  getMetrics(): { l1: CacheMetrics; l2?: CacheMetrics } {
    return {
      l1: this.l1Cache.getMetrics(),
      l2: this.l2Cache?.getMetrics(),
    };
  }

  async dispose(): Promise<void> {
    if (this.l2Cache) {
      await this.l2Cache.disconnect();
    }
  }
}

// Global cache instances
export const presetCache = new CacheManager({
  l1Config: {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 100,
    enableCompression: true,
    enableMetrics: true,
  },
  enableL2: process.env.NODE_ENV === 'production',
  l2Config: process.env.REDIS_ENDPOINT ? {
    endpoint: process.env.REDIS_ENDPOINT,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    enableMetrics: true,
  } : undefined,
});

export const effectCache = new CacheManager({
  l1Config: {
    ttl: 10 * 60 * 1000, // 10 minutes
    maxSize: 50,
    enableCompression: false, // Effects are typically small
    enableMetrics: true,
  },
  enableL2: process.env.NODE_ENV === 'production',
  l2Config: process.env.REDIS_ENDPOINT ? {
    endpoint: process.env.REDIS_ENDPOINT,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    enableMetrics: true,
  } : undefined,
});

export const userSessionCache = new CacheManager({
  l1Config: {
    ttl: 30 * 60 * 1000, // 30 minutes
    maxSize: 200,
    enableCompression: true,
    enableMetrics: true,
  },
  enableL2: process.env.NODE_ENV === 'production',
  l2Config: process.env.REDIS_ENDPOINT ? {
    endpoint: process.env.REDIS_ENDPOINT,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    enableMetrics: true,
  } : undefined,
});