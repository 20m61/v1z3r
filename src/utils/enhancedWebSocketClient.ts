/**
 * Enhanced WebSocket Client with Advanced Reliability Features
 * Provides robust connection management, intelligent reconnection, and message queuing
 */

import { errorHandler } from './errorHandler';

export interface WebSocketConfig {
  url: string;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  maxReconnectDelay: number;
  heartbeatInterval: number;
  messageTimeout: number;
  enableMessageQueue: boolean;
  queueMaxSize: number;
  connectionTimeout: number;
  protocols?: string[];
}

export interface QueuedMessage {
  id: string;
  data: any;
  timestamp: number;
  retryCount: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export interface ConnectionMetrics {
  totalConnections: number;
  totalReconnections: number;
  averageLatency: number;
  uptime: number;
  messagesSent: number;
  messagesReceived: number;
  lastError?: Error;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'critical';
}

export type WebSocketEvent = 
  | 'connecting'
  | 'connected' 
  | 'disconnected'
  | 'reconnecting'
  | 'error'
  | 'message'
  | 'heartbeat'
  | 'queue_processed';

export class EnhancedWebSocketClient {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private isConnecting = false;
  private isManualDisconnect = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connectionTimer: NodeJS.Timeout | null = null;
  
  // Message queuing
  private messageQueue: QueuedMessage[] = [];
  private pendingMessages: Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  
  // Event handling
  private eventListeners: Map<WebSocketEvent, Set<Function>> = new Map();
  
  // Metrics and monitoring
  private metrics: ConnectionMetrics = {
    totalConnections: 0,
    totalReconnections: 0,
    averageLatency: 0,
    uptime: 0,
    messagesSent: 0,
    messagesReceived: 0,
    connectionQuality: 'good'
  };
  private connectionStartTime = 0;
  private latencyMeasurements: number[] = [];
  
  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      url: '',
      maxReconnectAttempts: 10,
      reconnectDelay: 1000,
      maxReconnectDelay: 30000,
      heartbeatInterval: 30000,
      messageTimeout: 5000,
      enableMessageQueue: true,
      queueMaxSize: 100,
      connectionTimeout: 10000,
      ...config
    };
    
    // Initialize event listener maps
    Object.values(['connecting', 'connected', 'disconnected', 'reconnecting', 'error', 'message', 'heartbeat', 'queue_processed']).forEach(event => {
      this.eventListeners.set(event as WebSocketEvent, new Set());
    });
  }

  /**
   * Connect to WebSocket server with intelligent retry logic
   */
  async connect(url?: string): Promise<void> {
    if (url) {
      this.config.url = url;
    }

    if (!this.config.url) {
      throw new Error('WebSocket URL is required');
    }

    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    this.isManualDisconnect = false;
    this.emit('connecting');

    return new Promise((resolve, reject) => {
      try {
        this.connectionStartTime = Date.now();
        
        // Create WebSocket with protocols if specified
        this.ws = this.config.protocols 
          ? new WebSocket(this.config.url, this.config.protocols)
          : new WebSocket(this.config.url);

        // Connection timeout
        this.connectionTimer = setTimeout(() => {
          this.cleanup();
          const error = new Error(`Connection timeout after ${this.config.connectionTimeout}ms`);
          this.metrics.lastError = error;
          this.updateConnectionQuality();
          reject(error);
        }, this.config.connectionTimeout);

        this.ws.onopen = () => {
          this.clearConnectionTimer();
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.metrics.totalConnections++;
          
          this.startHeartbeat();
          this.processMessageQueue();
          
          errorHandler.info('WebSocket connected successfully');
          this.emit('connected');
          resolve();
        };

        this.ws.onclose = (event) => {
          this.clearConnectionTimer();
          this.isConnecting = false;
          this.stopHeartbeat();
          
          errorHandler.info(`WebSocket closed: ${event.code} - ${event.reason}`);
          this.emit('disconnected', { code: event.code, reason: event.reason });
          
          // Auto-reconnect if not manual disconnect
          if (!this.isManualDisconnect && !event.wasClean) {
            this.handleReconnection();
          }
        };

        this.ws.onerror = (error) => {
          this.clearConnectionTimer();
          this.isConnecting = false;
          const wsError = new Error('WebSocket connection error');
          this.metrics.lastError = wsError;
          this.updateConnectionQuality();
          
          errorHandler.error('WebSocket error', wsError);
          this.emit('error', wsError);
          
          if (this.reconnectAttempts === 0) {
            reject(wsError);
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

      } catch (error) {
        this.clearConnectionTimer();
        this.isConnecting = false;
        const connectionError = error instanceof Error ? error : new Error('Unknown connection error');
        this.metrics.lastError = connectionError;
        reject(connectionError);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  async disconnect(): Promise<void> {
    this.isManualDisconnect = true;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.clearConnectionTimer();
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'Manual disconnect');
    }
    
    this.cleanup();
    errorHandler.info('WebSocket manually disconnected');
  }

  /**
   * Send message with reliability features
   */
  async sendMessage(data: any, priority: QueuedMessage['priority'] = 'normal'): Promise<void> {
    const messageId = this.generateMessageId();
    const message: QueuedMessage = {
      id: messageId,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      priority
    };

    // If not connected, queue the message
    if (!this.isConnected()) {
      if (this.config.enableMessageQueue) {
        this.queueMessage(message);
        return;
      } else {
        throw new Error('WebSocket is not connected and message queuing is disabled');
      }
    }

    return this.sendMessageNow(message);
  }

  /**
   * Send message with response expectation
   */
  async sendMessageWithResponse(data: any, timeout?: number): Promise<any> {
    const messageId = this.generateMessageId();
    const timeoutMs = timeout || this.config.messageTimeout;

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(new Error(`Message response timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingMessages.set(messageId, {
        resolve,
        reject,
        timeout: timeoutHandle
      });

      const messageWithId = { ...data, _id: messageId };
      this.sendMessage(messageWithId).catch(error => {
        clearTimeout(timeoutHandle);
        this.pendingMessages.delete(messageId);
        reject(error);
      });
    });
  }

  /**
   * Add event listener
   */
  addEventListener(event: WebSocketEvent, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.add(listener);
    }
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: WebSocketEvent, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get current metrics
   */
  getMetrics(): ConnectionMetrics {
    if (this.connectionStartTime > 0) {
      this.metrics.uptime = Date.now() - this.connectionStartTime;
    }
    return { ...this.metrics };
  }

  /**
   * Get message queue status
   */
  getQueueStatus(): { size: number; messages: QueuedMessage[] } {
    return {
      size: this.messageQueue.length,
      messages: [...this.messageQueue]
    };
  }

  // Private methods

  private async sendMessageNow(message: QueuedMessage): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    try {
      const serializedData = JSON.stringify(message.data);
      this.ws.send(serializedData);
      this.metrics.messagesSent++;
      
      errorHandler.info(`Message sent: ${message.id}`);
    } catch (error) {
      // If send fails, requeue the message if queuing is enabled
      if (this.config.enableMessageQueue && message.retryCount < 3) {
        message.retryCount++;
        this.queueMessage(message);
      } else {
        throw error;
      }
    }
  }

  private queueMessage(message: QueuedMessage): void {
    // Remove oldest messages if queue is full
    if (this.messageQueue.length >= this.config.queueMaxSize) {
      // Sort by priority (critical > high > normal > low) and timestamp
      this.messageQueue.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
        const aPriority = priorityOrder[a.priority];
        const bPriority = priorityOrder[b.priority];
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        return a.timestamp - b.timestamp;
      });
      
      // Remove lowest priority, oldest messages
      this.messageQueue.splice(Math.floor(this.config.queueMaxSize * 0.8));
    }

    this.messageQueue.push(message);
    errorHandler.info(`Message queued: ${message.id} (queue size: ${this.messageQueue.length})`);
  }

  private async processMessageQueue(): Promise<void> {
    if (!this.isConnected() || this.messageQueue.length === 0) {
      return;
    }

    const messagesToProcess = [...this.messageQueue];
    this.messageQueue = [];

    for (const message of messagesToProcess) {
      try {
        await this.sendMessageNow(message);
      } catch (error) {
        errorHandler.error(`Failed to send queued message: ${message.id}`, error as Error);
        
        // Requeue if retry count allows
        if (message.retryCount < 3) {
          message.retryCount++;
          this.queueMessage(message);
        }
      }
    }

    if (messagesToProcess.length > 0) {
      this.emit('queue_processed', { processedCount: messagesToProcess.length });
    }
  }

  private handleMessage(data: string): void {
    try {
      const parsedData = JSON.parse(data);
      this.metrics.messagesReceived++;

      // Handle response to pending message
      if (parsedData._responseToId) {
        const pendingMessage = this.pendingMessages.get(parsedData._responseToId);
        if (pendingMessage) {
          clearTimeout(pendingMessage.timeout);
          this.pendingMessages.delete(parsedData._responseToId);
          pendingMessage.resolve(parsedData);
          return;
        }
      }

      // Handle heartbeat response
      if (parsedData.type === 'pong') {
        this.handleHeartbeatResponse(parsedData);
        return;
      }

      this.emit('message', parsedData);
      
    } catch (error) {
      errorHandler.error('Failed to parse WebSocket message', error as Error);
      this.emit('error', new Error('Message parsing failed'));
    }
  }

  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      const error = new Error(`Max reconnection attempts (${this.config.maxReconnectAttempts}) reached`);
      this.metrics.lastError = error;
      this.updateConnectionQuality();
      this.emit('error', error);
      return;
    }

    this.reconnectAttempts++;
    this.metrics.totalReconnections++;
    
    // Exponential backoff with jitter
    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.config.maxReconnectDelay
    );
    const jitter = Math.random() * 0.3 * delay;
    const actualDelay = delay + jitter;

    errorHandler.info(`Attempting reconnection ${this.reconnectAttempts}/${this.config.maxReconnectAttempts} in ${Math.round(actualDelay)}ms`);
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay: actualDelay });

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        errorHandler.error(`Reconnection attempt ${this.reconnectAttempts} failed`, error);
        this.handleReconnection();
      });
    }, actualDelay);
  }

  private startHeartbeat(): void {
    if (this.config.heartbeatInterval <= 0) return;

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        const heartbeatData = {
          type: 'ping',
          timestamp: Date.now()
        };
        
        this.sendMessage(heartbeatData, 'critical').catch(error => {
          errorHandler.warn('Heartbeat failed', error);
        });
        
        this.emit('heartbeat', heartbeatData);
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private handleHeartbeatResponse(data: any): void {
    if (data.originalTimestamp) {
      const latency = Date.now() - data.originalTimestamp;
      this.latencyMeasurements.push(latency);
      
      // Keep only last 10 measurements
      if (this.latencyMeasurements.length > 10) {
        this.latencyMeasurements.shift();
      }
      
      // Calculate average latency
      this.metrics.averageLatency = this.latencyMeasurements.reduce((a, b) => a + b, 0) / this.latencyMeasurements.length;
      this.updateConnectionQuality();
    }
  }

  private updateConnectionQuality(): void {
    const avgLatency = this.metrics.averageLatency;
    const hasErrors = !!this.metrics.lastError;
    const reconnectRatio = this.metrics.totalReconnections / Math.max(1, this.metrics.totalConnections);

    if (hasErrors || reconnectRatio > 0.5) {
      this.metrics.connectionQuality = 'critical';
    } else if (avgLatency > 1000 || reconnectRatio > 0.2) {
      this.metrics.connectionQuality = 'poor';
    } else if (avgLatency > 500 || reconnectRatio > 0.1) {
      this.metrics.connectionQuality = 'good';
    } else {
      this.metrics.connectionQuality = 'excellent';
    }
  }

  private emit(event: WebSocketEvent, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          errorHandler.error(`Event listener error for ${event}`, error as Error);
        }
      });
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearConnectionTimer(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  private cleanup(): void {
    this.clearReconnectTimer();
    this.clearConnectionTimer();
    this.stopHeartbeat();
    
    // Clear pending messages
    this.pendingMessages.forEach(({ timeout, reject }) => {
      clearTimeout(timeout);
      reject(new Error('Connection closed'));
    });
    this.pendingMessages.clear();
    
    this.ws = null;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}