/**
 * Database and WebSocket connection pooling utilities
 * Optimizes connection management for production scalability
 */

export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  maxLifetimeMs: number;
  enableHealthCheck: boolean;
  healthCheckIntervalMs: number;
  enableMetrics: boolean;
}

export interface ConnectionMetrics {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  connectionRequests: number;
  connectionFailures: number;
  averageAcquireTime: number;
  averageConnectionLifetime: number;
}

export interface PooledConnection {
  id: string;
  connection: any;
  createdAt: number;
  lastUsedAt: number;
  inUse: boolean;
  isHealthy: boolean;
}

/**
 * Generic connection pool implementation
 */
export class ConnectionPool<T> {
  private connections: PooledConnection[] = [];
  private waitingQueue: Array<{
    resolve: (connection: T) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  
  private metrics: ConnectionMetrics = {
    activeConnections: 0,
    idleConnections: 0,
    totalConnections: 0,
    connectionRequests: 0,
    connectionFailures: 0,
    averageAcquireTime: 0,
    averageConnectionLifetime: 0,
  };

  private acquireTimes: number[] = [];
  private lifetimes: number[] = [];
  private healthCheckInterval?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(
    private config: ConnectionPoolConfig,
    private connectionFactory: () => Promise<T>,
    private connectionValidator?: (connection: T) => Promise<boolean>,
    private connectionDestroyer?: (connection: T) => Promise<void>
  ) {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Create minimum connections
    for (let i = 0; i < this.config.minConnections; i++) {
      try {
        await this.createConnection();
      } catch (error) {
        console.error('Failed to create initial connection:', error);
      }
    }

    // Start health check if enabled
    if (this.config.enableHealthCheck) {
      this.startHealthCheck();
    }
  }

  async acquire(): Promise<T> {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down');
    }

    const startTime = performance.now();
    this.metrics.connectionRequests++;

    // Try to get an idle connection
    const idleConnection = this.findIdleConnection();
    if (idleConnection) {
      idleConnection.inUse = true;
      idleConnection.lastUsedAt = Date.now();
      this.updateMetrics();
      this.recordAcquireTime(performance.now() - startTime);
      return idleConnection.connection;
    }

    // Create new connection if under max limit
    if (this.connections.length < this.config.maxConnections) {
      try {
        const pooledConnection = await this.createConnection();
        pooledConnection.inUse = true;
        pooledConnection.lastUsedAt = Date.now();
        this.updateMetrics();
        this.recordAcquireTime(performance.now() - startTime);
        return pooledConnection.connection;
      } catch (error) {
        this.metrics.connectionFailures++;
        throw error;
      }
    }

    // Wait for connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Remove from waiting queue
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        this.metrics.connectionFailures++;
        reject(new Error('Connection acquire timeout'));
      }, this.config.acquireTimeoutMs);

      this.waitingQueue.push({
        resolve: (connection: T) => {
          clearTimeout(timeout);
          this.recordAcquireTime(performance.now() - startTime);
          resolve(connection);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          this.metrics.connectionFailures++;
          reject(error);
        },
        timestamp: Date.now(),
      });
    });
  }

  async release(connection: T): Promise<void> {
    const pooledConnection = this.connections.find(
      conn => conn.connection === connection
    );

    if (!pooledConnection) {
      console.warn('Attempting to release unknown connection');
      return;
    }

    pooledConnection.inUse = false;
    pooledConnection.lastUsedAt = Date.now();

    // Check if connection should be destroyed due to age
    if (Date.now() - pooledConnection.createdAt > this.config.maxLifetimeMs) {
      await this.destroyConnection(pooledConnection);
      this.updateMetrics();
      return;
    }

    // Process waiting queue
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift();
      if (waiter) {
        pooledConnection.inUse = true;
        pooledConnection.lastUsedAt = Date.now();
        waiter.resolve(connection);
      }
    }

    this.updateMetrics();
  }

  private findIdleConnection(): PooledConnection | null {
    return this.connections.find(
      conn => !conn.inUse && conn.isHealthy
    ) || null;
  }

  private async createConnection(): Promise<PooledConnection> {
    try {
      const connection = await this.connectionFactory();
      const pooledConnection: PooledConnection = {
        id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        connection,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        inUse: false,
        isHealthy: true,
      };

      this.connections.push(pooledConnection);
      return pooledConnection;
    } catch (error) {
      console.error('Failed to create connection:', error);
      throw error;
    }
  }

  private async destroyConnection(pooledConnection: PooledConnection): Promise<void> {
    try {
      if (this.connectionDestroyer) {
        await this.connectionDestroyer(pooledConnection.connection);
      }
      
      this.recordLifetime(Date.now() - pooledConnection.createdAt);
      
      const index = this.connections.indexOf(pooledConnection);
      if (index !== -1) {
        this.connections.splice(index, 1);
      }
    } catch (error) {
      console.error('Failed to destroy connection:', error);
    }
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);
  }

  private async performHealthCheck(): Promise<void> {
    const promises = this.connections.map(async (pooledConnection) => {
      if (pooledConnection.inUse) return; // Skip connections in use

      try {
        if (this.connectionValidator) {
          pooledConnection.isHealthy = await this.connectionValidator(
            pooledConnection.connection
          );
        }

        // Check for idle timeout
        const idleTime = Date.now() - pooledConnection.lastUsedAt;
        if (idleTime > this.config.idleTimeoutMs && 
            this.connections.length > this.config.minConnections) {
          await this.destroyConnection(pooledConnection);
        }
      } catch (error) {
        console.error('Health check failed for connection:', error);
        pooledConnection.isHealthy = false;
        await this.destroyConnection(pooledConnection);
      }
    });

    await Promise.allSettled(promises);
    this.updateMetrics();
  }

  private updateMetrics(): void {
    if (!this.config.enableMetrics) return;

    this.metrics.totalConnections = this.connections.length;
    this.metrics.activeConnections = this.connections.filter(conn => conn.inUse).length;
    this.metrics.idleConnections = this.connections.filter(conn => !conn.inUse).length;
  }

  private recordAcquireTime(time: number): void {
    if (!this.config.enableMetrics) return;

    this.acquireTimes.push(time);
    if (this.acquireTimes.length > 1000) {
      this.acquireTimes = this.acquireTimes.slice(-500);
    }

    this.metrics.averageAcquireTime = 
      this.acquireTimes.reduce((sum, t) => sum + t, 0) / this.acquireTimes.length;
  }

  private recordLifetime(time: number): void {
    if (!this.config.enableMetrics) return;

    this.lifetimes.push(time);
    if (this.lifetimes.length > 1000) {
      this.lifetimes = this.lifetimes.slice(-500);
    }

    this.metrics.averageConnectionLifetime = 
      this.lifetimes.reduce((sum, t) => sum + t, 0) / this.lifetimes.length;
  }

  getMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Stop health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Reject all waiting requests
    this.waitingQueue.forEach(waiter => {
      waiter.reject(new Error('Connection pool is shutting down'));
    });
    this.waitingQueue = [];

    // Close all connections
    const closePromises = this.connections.map(pooledConnection => 
      this.destroyConnection(pooledConnection)
    );
    
    await Promise.allSettled(closePromises);
    this.connections = [];
  }
}

/**
 * DynamoDB connection pool
 */
export class DynamoDBPool extends ConnectionPool<any> {
  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    const fullConfig: ConnectionPoolConfig = {
      minConnections: 2,
      maxConnections: 10,
      acquireTimeoutMs: 5000,
      idleTimeoutMs: 30000,
      maxLifetimeMs: 300000, // 5 minutes
      enableHealthCheck: true,
      healthCheckIntervalMs: 60000,
      enableMetrics: true,
      ...config,
    };

    super(
      fullConfig,
      async () => {
        // In real implementation, create DynamoDB client
        // const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        // return new DynamoDBClient({ region: process.env.AWS_REGION });
        return {}; // Mock for now
      },
      async (client) => {
        // Health check - try a simple operation
        try {
          // await client.send(new ListTablesCommand({}));
          return true;
        } catch {
          return false;
        }
      },
      async (client) => {
        // Cleanup if needed
        if (client && typeof client.destroy === 'function') {
          client.destroy();
        }
      }
    );
  }
}

/**
 * WebSocket connection pool for real-time features
 */
export class WebSocketPool extends ConnectionPool<WebSocket> {
  constructor(
    private wsUrl: string,
    config: Partial<ConnectionPoolConfig> = {}
  ) {
    const fullConfig: ConnectionPoolConfig = {
      minConnections: 1,
      maxConnections: 5,
      acquireTimeoutMs: 10000,
      idleTimeoutMs: 60000,
      maxLifetimeMs: 600000, // 10 minutes
      enableHealthCheck: true,
      healthCheckIntervalMs: 30000,
      enableMetrics: true,
      ...config,
    };

    super(
      fullConfig,
      async () => {
        return new Promise<WebSocket>((resolve, reject) => {
          const ws = new WebSocket(this.wsUrl);
          
          ws.onopen = () => resolve(ws);
          ws.onerror = (error) => reject(error);
          
          setTimeout(() => {
            if (ws.readyState === WebSocket.CONNECTING) {
              ws.close();
              reject(new Error('WebSocket connection timeout'));
            }
          }, 5000);
        });
      },
      async (ws) => {
        return ws.readyState === WebSocket.OPEN;
      },
      async (ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }
    );
  }
}

// Global connection pools
export const dynamoPool = new DynamoDBPool({
  minConnections: process.env.NODE_ENV === 'production' ? 3 : 1,
  maxConnections: process.env.NODE_ENV === 'production' ? 15 : 5,
});

export const createWebSocketPool = (url: string) => new WebSocketPool(url, {
  minConnections: 1,
  maxConnections: process.env.NODE_ENV === 'production' ? 3 : 2,
});

// Cleanup function for graceful shutdown
export async function shutdownConnectionPools(): Promise<void> {
  await Promise.allSettled([
    dynamoPool.shutdown(),
  ]);
}

// Initialize connection pools
if (typeof window === 'undefined') {
  // Server-side initialization
  process.on('SIGTERM', shutdownConnectionPools);
  process.on('SIGINT', shutdownConnectionPools);
}