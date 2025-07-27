/**
 * NDI Streaming Service Tests
 * Tests for NDI streaming functionality
 */

import { ndiStreamingService, NDIConfig } from '../ndiStreaming';

// Mock WebRTC API
const mockRTCPeerConnection = jest.fn().mockImplementation(() => ({
  createOffer: jest.fn().mockResolvedValue({}),
  createAnswer: jest.fn().mockResolvedValue({}),
  setLocalDescription: jest.fn().mockResolvedValue(undefined),
  setRemoteDescription: jest.fn().mockResolvedValue(undefined),
  addIceCandidate: jest.fn().mockResolvedValue(undefined),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
}));

Object.defineProperty(window, 'RTCPeerConnection', {
  value: mockRTCPeerConnection,
  writable: true,
  configurable: true
});

Object.defineProperty(global, 'RTCPeerConnection', {
  value: mockRTCPeerConnection,
  writable: true,
  configurable: true
});

// Mock WebSocket
const mockWebSocket = {
  send: jest.fn(),
  close: jest.fn(),
  readyState: WebSocket.OPEN,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

Object.defineProperty(window, 'WebSocket', {
  value: jest.fn().mockImplementation(() => mockWebSocket),
  writable: true
});

// Mock Canvas API
const mockCanvas = {
  width: 1920,
  height: 1080,
  getContext: jest.fn().mockReturnValue({
    clearRect: jest.fn(),
    drawImage: jest.fn(),
    getImageData: jest.fn().mockReturnValue({
      data: new Uint8ClampedArray(1920 * 1080 * 4)
    })
  }),
  captureStream: jest.fn().mockReturnValue({
    getVideoTracks: jest.fn().mockReturnValue([{
      stop: jest.fn()
    }]),
    getAudioTracks: jest.fn().mockReturnValue([{
      stop: jest.fn()
    }]),
    getTracks: jest.fn().mockReturnValue([{
      stop: jest.fn()
    }]),
    addTrack: jest.fn()
  })
};

Object.defineProperty(document, 'createElement', {
  value: jest.fn().mockImplementation((tag) => {
    if (tag === 'canvas') {
      return mockCanvas;
    }
    return {};
  }),
  writable: true
});

// Mock AudioContext
const mockAudioContext = {
  createMediaStreamDestination: jest.fn().mockReturnValue({
    stream: {
      getAudioTracks: jest.fn().mockReturnValue([{
        stop: jest.fn()
      }])
    }
  }),
  close: jest.fn()
};

Object.defineProperty(window, 'AudioContext', {
  value: jest.fn().mockImplementation(() => mockAudioContext),
  writable: true
});

// Mock performance
Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn().mockReturnValue(1000)
  },
  writable: true
});

describe.skip('NDIStreamingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton
    (ndiStreamingService as any).isInitialized = false;
    (ndiStreamingService as any).isStreaming = false;
    (ndiStreamingService as any).websocket = null;
    (ndiStreamingService as any).discoveredSources.clear();
    (ndiStreamingService as any).connectedReceivers.clear();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(ndiStreamingService.initialize()).resolves.not.toThrow();
      expect(ndiStreamingService.isInitializedState()).toBe(true);
    });

    it('should handle missing WebRTC support', async () => {
      Object.defineProperty(window, 'RTCPeerConnection', {
        value: undefined,
        writable: true
      });

      await expect(ndiStreamingService.initialize()).rejects.toThrow('WebRTC not supported');
    });

    it('should initialize canvas with correct resolution', async () => {
      await ndiStreamingService.initialize();
      
      expect(document.createElement).toHaveBeenCalledWith('canvas');
      expect(mockCanvas.width).toBe(1920);
      expect(mockCanvas.height).toBe(1080);
    });

    it('should initialize audio context', async () => {
      await ndiStreamingService.initialize();
      
      expect(window.AudioContext).toHaveBeenCalledWith({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });
    });
  });

  describe('configuration', () => {
    beforeEach(async () => {
      await ndiStreamingService.initialize();
    });

    it('should get default configuration', () => {
      const config = ndiStreamingService.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.sourceName).toBe('v1z3r VJ Application');
      expect(config.resolution).toBe('1080p');
      expect(config.frameRate).toBe(30);
      expect(config.enableAudio).toBe(true);
    });

    it('should update configuration', () => {
      const newConfig: Partial<NDIConfig> = {
        enabled: true,
        sourceName: 'Custom Source',
        resolution: '720p',
        frameRate: 60,
        enableAudio: false
      };

      ndiStreamingService.setConfig(newConfig);
      const config = ndiStreamingService.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.sourceName).toBe('Custom Source');
      expect(config.resolution).toBe('720p');
      expect(config.frameRate).toBe(60);
      expect(config.enableAudio).toBe(false);
    });

    it('should reinitialize canvas when resolution changes', () => {
      const createElementSpy = jest.spyOn(document, 'createElement');
      
      ndiStreamingService.setConfig({ resolution: '720p' });
      
      expect(createElementSpy).toHaveBeenCalledWith('canvas');
      expect(mockCanvas.width).toBe(1280);
      expect(mockCanvas.height).toBe(720);
    });

    it('should handle custom resolution', () => {
      ndiStreamingService.setConfig({
        resolution: 'custom',
        customWidth: 1600,
        customHeight: 900
      });

      expect(mockCanvas.width).toBe(1600);
      expect(mockCanvas.height).toBe(900);
    });
  });

  describe('streaming control', () => {
    beforeEach(async () => {
      await ndiStreamingService.initialize();
    });

    it('should start streaming', async () => {
      await ndiStreamingService.startStreaming();
      
      expect(ndiStreamingService.isStreamingState()).toBe(true);
      expect(mockCanvas.captureStream).toHaveBeenCalledWith(30);
    });

    it('should stop streaming', async () => {
      await ndiStreamingService.startStreaming();
      ndiStreamingService.stopStreaming();
      
      expect(ndiStreamingService.isStreamingState()).toBe(false);
    });

    it('should not start streaming if already streaming', async () => {
      await ndiStreamingService.startStreaming();
      const captureStreamCallCount = (mockCanvas.captureStream as jest.Mock).mock.calls.length;
      
      await ndiStreamingService.startStreaming();
      
      expect((mockCanvas.captureStream as jest.Mock).mock.calls.length).toBe(captureStreamCallCount);
    });

    it('should handle streaming errors gracefully', async () => {
      mockCanvas.captureStream.mockImplementationOnce(() => {
        throw new Error('Canvas capture failed');
      });

      await expect(ndiStreamingService.startStreaming()).rejects.toThrow('Canvas capture failed');
      expect(ndiStreamingService.isStreamingState()).toBe(false);
    });
  });

  describe('canvas management', () => {
    beforeEach(async () => {
      await ndiStreamingService.initialize();
    });

    it('should update canvas content', () => {
      const sourceCanvas = document.createElement('canvas') as HTMLCanvasElement;
      const ctx = mockCanvas.getContext('2d');
      
      ndiStreamingService.updateCanvas(sourceCanvas);
      
      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, mockCanvas.width, mockCanvas.height);
      expect(ctx.drawImage).toHaveBeenCalledWith(sourceCanvas, 0, 0, mockCanvas.width, mockCanvas.height);
    });

    it('should handle missing canvas context', () => {
      mockCanvas.getContext.mockReturnValueOnce(null);
      const sourceCanvas = document.createElement('canvas') as HTMLCanvasElement;
      
      expect(() => ndiStreamingService.updateCanvas(sourceCanvas)).not.toThrow();
    });
  });

  describe('source discovery', () => {
    beforeEach(async () => {
      await ndiStreamingService.initialize();
    });

    it('should discover sources', () => {
      const sources = ndiStreamingService.getDiscoveredSources();
      expect(Array.isArray(sources)).toBe(true);
    });

    it('should handle source discovery messages', () => {
      const sourceData = {
        id: 'test-source',
        name: 'Test Source',
        ip: '192.168.1.100',
        port: 5960,
        resolution: '1920x1080',
        frameRate: 30,
        hasAudio: true
      };

      (ndiStreamingService as any).handleSourceDiscovered(sourceData);
      
      const sources = ndiStreamingService.getDiscoveredSources();
      expect(sources).toHaveLength(1);
      expect(sources[0].name).toBe('Test Source');
    });
  });

  describe('receiver management', () => {
    beforeEach(async () => {
      await ndiStreamingService.initialize();
    });

    it('should handle receiver connections', () => {
      const receiverData = {
        id: 'test-receiver',
        name: 'Test Receiver',
        ip: '192.168.1.101',
        bandwidth: 1000,
        quality: 95
      };

      (ndiStreamingService as any).handleReceiverConnected(receiverData);
      
      const receivers = ndiStreamingService.getConnectedReceivers();
      expect(receivers).toHaveLength(1);
      expect(receivers[0].name).toBe('Test Receiver');
    });

    it('should handle receiver disconnections', () => {
      const receiverData = {
        id: 'test-receiver',
        name: 'Test Receiver',
        ip: '192.168.1.101'
      };

      (ndiStreamingService as any).handleReceiverConnected(receiverData);
      (ndiStreamingService as any).handleReceiverDisconnected(receiverData);
      
      const receivers = ndiStreamingService.getConnectedReceivers();
      expect(receivers).toHaveLength(0);
    });
  });

  describe('metrics', () => {
    beforeEach(async () => {
      await ndiStreamingService.initialize();
    });

    it('should provide metrics', () => {
      const metrics = ndiStreamingService.getMetrics();
      expect(metrics).toHaveProperty('isStreaming');
      expect(metrics).toHaveProperty('connectedClients');
      expect(metrics).toHaveProperty('bandwidth');
      expect(metrics).toHaveProperty('framesSent');
      expect(metrics).toHaveProperty('uptime');
    });

    it('should update metrics during streaming', async () => {
      await ndiStreamingService.startStreaming();
      
      const metrics = ndiStreamingService.getMetrics();
      expect(metrics.isStreaming).toBe(true);
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('WebSocket communication', () => {
    beforeEach(async () => {
      await ndiStreamingService.initialize();
    });

    it('should handle WebSocket messages', () => {
      const message = {
        type: 'source_discovered',
        source: {
          id: 'ws-source',
          name: 'WebSocket Source',
          ip: '192.168.1.102',
          port: 5961,
          resolution: '1280x720',
          frameRate: 60,
          hasAudio: false
        }
      };

      (ndiStreamingService as any).handleWebSocketMessage({
        data: JSON.stringify(message)
      });

      const sources = ndiStreamingService.getDiscoveredSources();
      const wsSource = sources.find(s => s.id === 'ws-source');
      expect(wsSource).toBeDefined();
    });

    it('should handle invalid WebSocket messages', () => {
      expect(() => {
        (ndiStreamingService as any).handleWebSocketMessage({
          data: 'invalid json'
        });
      }).not.toThrow();
    });

    it('should send handshake on WebSocket connection', () => {
      (ndiStreamingService as any).sendHandshake();
      
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('handshake')
      );
    });
  });

  describe('callbacks', () => {
    beforeEach(async () => {
      await ndiStreamingService.initialize();
    });

    it('should call stream start callback', async () => {
      const onStreamStart = jest.fn();
      
      ndiStreamingService.setCallbacks({ onStreamStart });
      await ndiStreamingService.startStreaming();
      
      expect(onStreamStart).toHaveBeenCalled();
    });

    it('should call stream stop callback', async () => {
      const onStreamStop = jest.fn();
      
      ndiStreamingService.setCallbacks({ onStreamStop });
      await ndiStreamingService.startStreaming();
      ndiStreamingService.stopStreaming();
      
      expect(onStreamStop).toHaveBeenCalled();
    });

    it('should call source discovery callback', () => {
      const onSourceDiscovered = jest.fn();
      
      ndiStreamingService.setCallbacks({ onSourceDiscovered });
      
      const sourceData = {
        id: 'callback-source',
        name: 'Callback Source',
        ip: '192.168.1.103',
        port: 5962,
        resolution: '1920x1080',
        frameRate: 30,
        hasAudio: true
      };

      (ndiStreamingService as any).handleSourceDiscovered(sourceData);
      
      expect(onSourceDiscovered).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Callback Source' })
      );
    });
  });

  describe('audio stream creation', () => {
    beforeEach(async () => {
      await ndiStreamingService.initialize();
    });

    it('should create audio stream when enabled', async () => {
      ndiStreamingService.setConfig({ enableAudio: true });
      
      const audioStream = await (ndiStreamingService as any).createAudioStream();
      
      expect(audioStream).toBeDefined();
      expect(mockAudioContext.createMediaStreamDestination).toHaveBeenCalled();
    });

    it('should handle missing audio context', async () => {
      (ndiStreamingService as any).audioContext = null;
      
      await expect((ndiStreamingService as any).createAudioStream()).rejects.toThrow('Audio context not initialized');
    });
  });

  describe('frame capture', () => {
    beforeEach(async () => {
      await ndiStreamingService.initialize();
    });

    it('should capture frames when streaming', async () => {
      await ndiStreamingService.startStreaming();
      
      const ctx = mockCanvas.getContext('2d');
      (ndiStreamingService as any).captureFrame();
      
      expect(ctx.getImageData).toHaveBeenCalledWith(0, 0, mockCanvas.width, mockCanvas.height);
    });

    it('should handle frame capture errors', async () => {
      await ndiStreamingService.startStreaming();
      
      const ctx = mockCanvas.getContext('2d');
      ctx.getImageData.mockImplementationOnce(() => {
        throw new Error('Canvas access failed');
      });
      
      expect(() => {
        (ndiStreamingService as any).captureFrame();
      }).not.toThrow();
    });
  });

  describe('resource cleanup', () => {
    beforeEach(async () => {
      await ndiStreamingService.initialize();
    });

    it('should dispose resources', () => {
      ndiStreamingService.dispose();
      
      expect(ndiStreamingService.isInitializedState()).toBe(false);
      expect(ndiStreamingService.isStreamingState()).toBe(false);
      expect(mockWebSocket.close).toHaveBeenCalled();
      expect(mockAudioContext.close).toHaveBeenCalled();
    });

    it('should stop streaming before disposal', async () => {
      await ndiStreamingService.startStreaming();
      
      ndiStreamingService.dispose();
      
      expect(ndiStreamingService.isStreamingState()).toBe(false);
    });
  });
});