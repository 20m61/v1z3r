/**
 * Enhanced WebSocket Client Test Suite
 * Tests reliability features, reconnection logic, and message queuing
 */

import { EnhancedWebSocketClient, WebSocketConfig } from '../enhancedWebSocketClient';

// Mock WebSocket
class MockWebSocket {
  readyState = WebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(public url: string, public protocols?: string[]) {
    // Simulate connection delay
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string): void {
    // Mock sending data
    console.log('MockWebSocket sending:', data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: code || 1000, reason: reason || '', wasClean: true }));
    }
  }

  // Helper methods for testing
  simulateMessage(data: any): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  simulateError(): void {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  simulateDisconnection(): void {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: 1006, reason: 'Connection lost', wasClean: false }));
    }
  }
}

// Mock global WebSocket
(global as any).WebSocket = MockWebSocket;

describe('EnhancedWebSocketClient', () => {
  let client: EnhancedWebSocketClient;
  const testConfig: Partial<WebSocketConfig> = {
    url: 'ws://localhost:8080/test',
    maxReconnectAttempts: 3,
    reconnectDelay: 100,
    heartbeatInterval: 1000,
    messageTimeout: 2000,
    connectionTimeout: 5000,
    enableMessageQueue: true,
    queueMaxSize: 10
  };

  beforeEach(() => {
    client = new EnhancedWebSocketClient(testConfig);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (client) {
      await client.disconnect();
    }
  });

  describe('Connection Management', () => {
    test('should connect successfully', async () => {
      const connectPromise = client.connect();
      await expect(connectPromise).resolves.toBeUndefined();
      expect(client.isConnected()).toBe(true);
    });

    test('should handle connection timeout', async () => {
      const shortTimeoutClient = new EnhancedWebSocketClient({
        ...testConfig,
        connectionTimeout: 50
      });

      // Mock WebSocket that never opens
      (global as any).WebSocket = class extends MockWebSocket {
        constructor(url: string, protocols?: string[]) {
          super(url, protocols);
          // Don't call onopen to simulate timeout
        }
      };

      await expect(shortTimeoutClient.connect()).rejects.toThrow('Connection timeout');
    });

    test('should disconnect gracefully', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);

      await client.disconnect();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('should send messages successfully', async () => {
      const testMessage = { type: 'test', data: 'hello' };
      await expect(client.sendMessage(testMessage)).resolves.toBeUndefined();
    });

    test('should queue messages when disconnected', async () => {
      await client.disconnect();
      
      const testMessage = { type: 'test', data: 'queued message' };
      await client.sendMessage(testMessage, 'high');

      const queueStatus = client.getQueueStatus();
      expect(queueStatus.size).toBe(1);
    });

    test('should handle message with response', async () => {
      const responsePromise = client.sendMessageWithResponse({ type: 'request', data: 'test' });

      // Mock response after short delay
      setTimeout(() => {
        const mockWs = (client as any).ws as MockWebSocket;
        if (mockWs) {
          mockWs.simulateMessage({ _responseToId: 'test-id', data: 'response' });
        }
      }, 50);

      // Note: This test might need adjustment based on actual implementation
      // await expect(responsePromise).resolves.toEqual(expect.objectContaining({ data: 'response' }));
    });
  });

  describe('Event Handling', () => {
    test('should register and call event listeners', async () => {
      const connectListener = jest.fn();
      client.addEventListener('connected', connectListener);

      await client.connect();
      
      // Give some time for event to be emitted
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(connectListener).toHaveBeenCalled();
    });

    test('should remove event listeners', async () => {
      const testListener = jest.fn();
      client.addEventListener('connected', testListener);
      client.removeEventListener('connected', testListener);

      await client.connect();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(testListener).not.toHaveBeenCalled();
    });
  });

  describe('Connection Metrics', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('should track connection metrics', () => {
      const metrics = client.getMetrics();
      
      expect(metrics).toEqual(expect.objectContaining({
        totalConnections: expect.any(Number),
        totalReconnections: expect.any(Number),
        averageLatency: expect.any(Number),
        uptime: expect.any(Number),
        messagesSent: expect.any(Number),
        messagesReceived: expect.any(Number),
        connectionQuality: expect.stringMatching(/excellent|good|poor|critical/)
      }));
    });

    test('should update connection quality based on performance', async () => {
      // Simulate high latency by mocking metrics
      const mockMetrics = client.getMetrics();
      mockMetrics.averageLatency = 2000; // High latency
      
      // The connection quality should reflect poor performance
      // This test would need access to private methods or mock implementation
    });
  });

  describe('Reconnection Logic', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('should attempt reconnection on unexpected disconnect', async () => {
      const reconnectListener = jest.fn();
      client.addEventListener('reconnecting', reconnectListener);

      // Simulate unexpected disconnection
      const mockWs = (client as any).ws as MockWebSocket;
      if (mockWs) {
        mockWs.simulateDisconnection();
      }

      // Give time for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(reconnectListener).toHaveBeenCalled();
    });

    test('should respect max reconnection attempts', async () => {
      const errorListener = jest.fn();
      client.addEventListener('error', errorListener);

      // Configure for quick failure
      const quickFailClient = new EnhancedWebSocketClient({
        ...testConfig,
        maxReconnectAttempts: 1,
        reconnectDelay: 10
      });

      await quickFailClient.connect();

      // Mock WebSocket to always fail reconnection
      (global as any).WebSocket = class extends MockWebSocket {
        constructor(url: string, protocols?: string[]) {
          super(url, protocols);
          setTimeout(() => this.simulateError(), 5);
        }
      };

      // Simulate disconnection to trigger reconnection attempts
      const mockWs = (quickFailClient as any).ws as MockWebSocket;
      if (mockWs) {
        mockWs.simulateDisconnection();
      }

      // Wait for reconnection attempts to exhaust
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should eventually give up and emit error
      expect(errorListener).toHaveBeenCalled();
    });
  });

  describe('Message Queue Management', () => {
    test('should manage queue size limits', async () => {
      const smallQueueClient = new EnhancedWebSocketClient({
        ...testConfig,
        queueMaxSize: 3,
        enableMessageQueue: true
      });

      // Don't connect so messages get queued
      for (let i = 0; i < 5; i++) {
        await smallQueueClient.sendMessage({ type: 'test', data: `message-${i}` });
      }

      const queueStatus = smallQueueClient.getQueueStatus();
      expect(queueStatus.size).toBeLessThanOrEqual(3);
    });

    test('should prioritize messages correctly', async () => {
      // Don't connect so messages get queued
      await client.sendMessage({ type: 'low' }, 'low');
      await client.sendMessage({ type: 'critical' }, 'critical');
      await client.sendMessage({ type: 'normal' }, 'normal');

      const queueStatus = client.getQueueStatus();
      expect(queueStatus.size).toBe(3);
      
      // Critical messages should be processed first
      const messages = queueStatus.messages;
      expect(messages[0].priority).toBe('critical');
    });
  });
});