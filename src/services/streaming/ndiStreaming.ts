/**
 * NDI (Network Device Interface) Streaming Service
 * Handles professional video streaming over IP networks
 */

import { errorHandler } from '@/utils/errorHandler';
import { advancedFeaturesErrorHandler } from '@/utils/advancedFeaturesErrorHandler';

export interface NDIConfig {
  enabled: boolean;
  sourceName: string;
  groupName: string;
  resolution: '1080p' | '720p' | '480p' | 'custom';
  customWidth?: number;
  customHeight?: number;
  frameRate: 30 | 60 | 120;
  quality: 'high' | 'medium' | 'low';
  enableAudio: boolean;
  audioSampleRate: 48000 | 44100 | 32000;
  enableAlpha: boolean;
  clockSync: boolean;
  enableDiscovery: boolean;
  multicast: boolean;
  bandwidth: number; // Mbps
}

export interface NDISource {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  resolution: string;
  frameRate: number;
  hasAudio: boolean;
  lastSeen: number;
  active: boolean;
}

export interface NDIMetrics {
  isStreaming: boolean;
  connectedClients: number;
  bandwidth: number;
  droppedFrames: number;
  latency: number;
  quality: number;
  framesSent: number;
  audioSamplesSent: number;
  uptime: number;
}

// Export aliases for browser test page compatibility
export interface StreamConfig extends NDIConfig {
  width: number;
  height: number;
  bitrate: number;
  protocol: 'ndi' | 'webrtc' | 'rtmp';
}

export interface StreamMetrics extends NDIMetrics {
  fps: number;
  bitrate: number;
  packetsSent: number;
  packetsLost: number;
  activeStreams: number;
}

export interface NDIReceiver {
  id: string;
  name: string;
  ipAddress: string;
  connected: boolean;
  bandwidth: number;
  quality: number;
}

export class NDIStreamingService {
  private static instance: NDIStreamingService | null = null;
  private isInitialized = false;
  private isStreaming = false;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private websocket: WebSocket | null = null;
  private discoveredSources: Map<string, NDISource> = new Map();
  private connectedReceivers: Map<string, NDIReceiver> = new Map();
  private frameBuffer: ArrayBuffer[] = [];
  private audioBuffer: Float32Array[] = [];
  private lastFrameTime = 0;
  private startTime = 0;
  
  private config: NDIConfig = {
    enabled: false,
    sourceName: 'v1z3r VJ Application',
    groupName: 'default',
    resolution: '1080p',
    frameRate: 30,
    quality: 'high',
    enableAudio: true,
    audioSampleRate: 48000,
    enableAlpha: false,
    clockSync: true,
    enableDiscovery: true,
    multicast: false,
    bandwidth: 100,
  };

  private metrics: NDIMetrics = {
    isStreaming: false,
    connectedClients: 0,
    bandwidth: 0,
    droppedFrames: 0,
    latency: 0,
    quality: 100,
    framesSent: 0,
    audioSamplesSent: 0,
    uptime: 0,
  };

  private callbacks: {
    onStreamStart?: () => void;
    onStreamStop?: () => void;
    onSourceDiscovered?: (source: NDISource) => void;
    onReceiverConnected?: (receiver: NDIReceiver) => void;
    onReceiverDisconnected?: (receiver: NDIReceiver) => void;
    onMetricsUpdate?: (metrics: NDIMetrics) => void;
  } = {};

  private constructor() {}

  static getInstance(): NDIStreamingService {
    if (!NDIStreamingService.instance) {
      NDIStreamingService.instance = new NDIStreamingService();
    }
    return NDIStreamingService.instance;
  }

  /**
   * Initialize NDI streaming service
   */
  async initialize(): Promise<void> {
    try {
      errorHandler.info('Initializing NDI streaming service...');

      // Check for WebRTC support (needed for streaming)
      if (!window.RTCPeerConnection) {
        throw new Error('WebRTC not supported - required for NDI streaming');
      }

      // Initialize canvas for video capture
      this.initializeCanvas();

      // Initialize audio context
      await this.initializeAudio();

      // Set up WebSocket for NDI discovery and communication
      await this.setupWebSocket();

      // Start discovery if enabled
      if (this.config.enableDiscovery) {
        this.startDiscovery();
      }

      this.isInitialized = true;
      errorHandler.info('NDI streaming service initialized');
    } catch (error) {
      errorHandler.error('Failed to initialize NDI streaming service', error as Error);
      throw error;
    }
  }

  /**
   * Initialize canvas for video capture
   */
  private initializeCanvas(): void {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Set canvas size based on resolution
    const { width, height } = this.getResolution();
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Initialize audio context
   */
  private async initializeAudio(): Promise<void> {
    try {
      this.audioContext = new AudioContext({
        sampleRate: this.config.audioSampleRate,
        latencyHint: 'interactive',
      });
      
      errorHandler.info('Audio context initialized for NDI streaming');
    } catch (error) {
      errorHandler.error('Failed to initialize audio context', error as Error);
    }
  }

  /**
   * Setup WebSocket for NDI communication
   */
  private async setupWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // In a real implementation, this would connect to an NDI gateway server
        // For now, we simulate the connection
        const wsUrl = process.env.NEXT_PUBLIC_NDI_GATEWAY_URL || 'ws://localhost:8080/ndi';
        
        this.websocket = new WebSocket(wsUrl);
        
        this.websocket.onopen = () => {
          errorHandler.info('Connected to NDI gateway');
          this.sendHandshake();
          resolve();
        };
        
        this.websocket.onmessage = (event) => {
          this.handleWebSocketMessage(event);
        };
        
        this.websocket.onclose = () => {
          errorHandler.warn('Disconnected from NDI gateway');
          // Attempt reconnection
          setTimeout(() => this.setupWebSocket(), 5000);
        };
        
        this.websocket.onerror = (error) => {
          errorHandler.error('NDI WebSocket error', error as any);
          reject(error);
        };
        
        // Fallback for when NDI gateway is not available
        setTimeout(() => {
          if (this.websocket?.readyState !== WebSocket.OPEN) {
            errorHandler.warn('NDI gateway not available, using fallback mode');
            this.websocket = null;
            resolve();
          }
        }, 3000);
      } catch (error) {
        errorHandler.error('Failed to setup WebSocket', error as Error);
        reject(error);
      }
    });
  }

  /**
   * Send handshake to NDI gateway
   */
  private sendHandshake(): void {
    if (!this.websocket) return;

    const handshake = {
      type: 'handshake',
      version: '1.0',
      sourceName: this.config.sourceName,
      groupName: this.config.groupName,
      capabilities: {
        video: true,
        audio: this.config.enableAudio,
        alpha: this.config.enableAlpha,
        multicast: this.config.multicast,
      },
    };

    this.websocket.send(JSON.stringify(handshake));
  }

  /**
   * Handle WebSocket messages
   */
  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'source_discovered':
          this.handleSourceDiscovered(message.source);
          break;
        case 'receiver_connected':
          this.handleReceiverConnected(message.receiver);
          break;
        case 'receiver_disconnected':
          this.handleReceiverDisconnected(message.receiver);
          break;
        case 'metrics':
          this.updateMetrics(message.metrics);
          break;
        case 'error':
          errorHandler.error('NDI gateway error', new Error(message.error));
          break;
      }
    } catch (error) {
      errorHandler.error('Failed to parse WebSocket message', error as Error);
    }
  }

  /**
   * Handle discovered NDI source
   */
  private handleSourceDiscovered(sourceData: any): void {
    const source: NDISource = {
      id: sourceData.id,
      name: sourceData.name,
      ipAddress: sourceData.ip,
      port: sourceData.port,
      resolution: sourceData.resolution,
      frameRate: sourceData.frameRate,
      hasAudio: sourceData.hasAudio,
      lastSeen: Date.now(),
      active: true,
    };

    this.discoveredSources.set(source.id, source);
    this.callbacks.onSourceDiscovered?.(source);
  }

  /**
   * Handle receiver connection
   */
  private handleReceiverConnected(receiverData: any): void {
    const receiver: NDIReceiver = {
      id: receiverData.id,
      name: receiverData.name,
      ipAddress: receiverData.ip,
      connected: true,
      bandwidth: receiverData.bandwidth || 0,
      quality: receiverData.quality || 100,
    };

    this.connectedReceivers.set(receiver.id, receiver);
    this.metrics.connectedClients = this.connectedReceivers.size;
    this.callbacks.onReceiverConnected?.(receiver);
  }

  /**
   * Handle receiver disconnection
   */
  private handleReceiverDisconnected(receiverData: any): void {
    const receiver = this.connectedReceivers.get(receiverData.id);
    if (receiver) {
      this.connectedReceivers.delete(receiverData.id);
      this.metrics.connectedClients = this.connectedReceivers.size;
      this.callbacks.onReceiverDisconnected?.(receiver);
    }
  }

  /**
   * Start NDI discovery
   */
  private startDiscovery(): void {
    if (this.websocket) {
      this.websocket.send(JSON.stringify({
        type: 'start_discovery',
        group: this.config.groupName,
      }));
    }

    // Also start local discovery simulation
    this.simulateDiscovery();
  }

  /**
   * Simulate NDI discovery (for development)
   */
  private simulateDiscovery(): void {
    const mockSources = [
      {
        id: 'mock_1',
        name: 'OBS Studio',
        ip: '192.168.1.100',
        port: 5960,
        resolution: '1920x1080',
        frameRate: 30,
        hasAudio: true,
      },
      {
        id: 'mock_2',
        name: 'Camera 1',
        ip: '192.168.1.101',
        port: 5961,
        resolution: '1280x720',
        frameRate: 60,
        hasAudio: false,
      },
    ];

    setTimeout(() => {
      mockSources.forEach(source => {
        this.handleSourceDiscovered(source);
      });
    }, 1000);
  }

  /**
   * Start streaming
   */
  async startStreaming(): Promise<void> {
    if (this.isStreaming) return;

    try {
      errorHandler.info('Starting NDI stream...');

      // Create media stream from canvas
      if (!this.canvas) {
        throw new Error('Canvas not initialized');
      }

      this.mediaStream = this.canvas.captureStream(this.config.frameRate);

      // Add audio track if enabled
      if (this.config.enableAudio && this.audioContext) {
        const audioStream = await this.createAudioStream();
        audioStream.getAudioTracks().forEach(track => {
          this.mediaStream?.addTrack(track);
        });
      }

      // Start frame capture loop
      this.startFrameCapture();

      this.isStreaming = true;
      this.startTime = Date.now();
      this.metrics.isStreaming = true;

      // Notify WebSocket
      if (this.websocket) {
        this.websocket.send(JSON.stringify({
          type: 'start_stream',
          config: this.config,
        }));
      }

      this.callbacks.onStreamStart?.();
      errorHandler.info('NDI streaming started');
    } catch (error) {
      errorHandler.error('Failed to start NDI streaming', error as Error);
      throw error;
    }
  }

  /**
   * Stop streaming
   */
  stopStreaming(): void {
    if (!this.isStreaming) return;

    this.isStreaming = false;
    this.metrics.isStreaming = false;

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Notify WebSocket
    if (this.websocket) {
      this.websocket.send(JSON.stringify({
        type: 'stop_stream',
      }));
    }

    this.callbacks.onStreamStop?.();
    errorHandler.info('NDI streaming stopped');
  }

  /**
   * Start frame capture loop
   */
  private startFrameCapture(): void {
    const captureFrame = () => {
      if (!this.isStreaming || !this.canvas || !this.ctx) return;

      const now = performance.now();
      const frameDuration = 1000 / this.config.frameRate;

      if (now - this.lastFrameTime >= frameDuration) {
        // Capture frame would be implemented here
        // For now, we simulate the frame capture
        this.captureFrame();
        this.lastFrameTime = now;
      }

      requestAnimationFrame(captureFrame);
    };

    requestAnimationFrame(captureFrame);
  }

  /**
   * Capture frame for NDI streaming
   */
  private captureFrame(): void {
    if (!this.canvas || !this.ctx) return;

    try {
      // Get image data from canvas
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      
      // Convert to appropriate format for NDI
      const frame = this.convertFrameForNDI(imageData);
      
      // Send frame via WebSocket (in real implementation, this would be more efficient)
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({
          type: 'frame',
          timestamp: Date.now(),
          width: this.canvas.width,
          height: this.canvas.height,
          format: 'rgba',
          data: Array.from(frame),
        }));
      }

      // Update metrics
      this.metrics.framesSent++;
      this.metrics.uptime = Date.now() - this.startTime;
    } catch (error) {
      errorHandler.error('Failed to capture frame', error as Error);
      this.metrics.droppedFrames++;
    }
  }

  /**
   * Convert frame for NDI transmission
   */
  private convertFrameForNDI(imageData: ImageData): Uint8Array {
    // In a real implementation, this would convert to YUV422 or other NDI formats
    // For now, we just return the RGBA data
    return new Uint8Array(imageData.data);
  }

  /**
   * Create audio stream
   */
  private async createAudioStream(): Promise<MediaStream> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    // Create destination for audio capture
    const destination = this.audioContext.createMediaStreamDestination();
    
    // Connect audio sources to destination
    // This would be connected to the actual audio processing graph
    
    return destination.stream;
  }

  /**
   * Update streaming canvas
   */
  updateCanvas(sourceCanvas: HTMLCanvasElement): void {
    if (!this.canvas || !this.ctx) return;

    // Copy source canvas to streaming canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(sourceCanvas, 0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Get resolution dimensions
   */
  private getResolution(): { width: number; height: number } {
    switch (this.config.resolution) {
      case '1080p':
        return { width: 1920, height: 1080 };
      case '720p':
        return { width: 1280, height: 720 };
      case '480p':
        return { width: 854, height: 480 };
      case 'custom':
        return { 
          width: this.config.customWidth || 1920, 
          height: this.config.customHeight || 1080 
        };
      default:
        return { width: 1920, height: 1080 };
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(newMetrics: Partial<NDIMetrics>): void {
    this.metrics = { ...this.metrics, ...newMetrics };
    this.callbacks.onMetricsUpdate?.(this.metrics);
  }

  /**
   * Get discovered sources
   */
  getDiscoveredSources(): NDISource[] {
    return Array.from(this.discoveredSources.values());
  }

  /**
   * Get connected receivers
   */
  getConnectedReceivers(): NDIReceiver[] {
    return Array.from(this.connectedReceivers.values());
  }

  /**
   * Get NDI configuration
   */
  getNDIConfig(): NDIConfig {
    return { ...this.config };
  }

  /**
   * Set configuration
   */
  setConfig(config: Partial<NDIConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update canvas resolution if changed
    if (config.resolution || config.customWidth || config.customHeight) {
      this.initializeCanvas();
    }
    
    // Update audio sample rate if changed
    if (config.audioSampleRate && this.audioContext) {
      this.initializeAudio();
    }
  }

  /**
   * Get metrics
   */
  getMetrics(): NDIMetrics {
    return { ...this.metrics };
  }

  /**
   * Set callbacks
   */
  setCallbacks(callbacks: Partial<typeof this.callbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Check if initialized
   */
  isInitializedState(): boolean {
    return this.isInitialized;
  }

  /**
   * Check if streaming
   */
  isStreamingState(): boolean {
    return this.isStreaming;
  }

  /**
   * Get health status
   */
  getHealthStatus(): 'healthy' | 'degraded' | 'unavailable' {
    return advancedFeaturesErrorHandler.getFeatureHealth('NDI');
  }

  /**
   * Get configuration (browser test page compatibility)
   */
  getConfig(): StreamConfig {
    const { width, height } = this.getResolution();
    return {
      ...this.config,
      width,
      height,
      bitrate: this.config.bandwidth * 1000000, // Convert Mbps to bps
      protocol: 'ndi' as const,
    };
  }

  /**
   * Set canvas for streaming
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  /**
   * Start stream (alias for browser test page)
   */
  async startStream(canvas: HTMLCanvasElement): Promise<boolean> {
    try {
      this.setCanvas(canvas);
      await this.startStreaming();
      return true;
    } catch (error) {
      errorHandler.error('Failed to start stream', error as Error);
      return false;
    }
  }

  /**
   * Stop stream (alias for browser test page)
   */
  async stopStream(): Promise<void> {
    await this.stopStreaming();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stopStreaming();
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.discoveredSources.clear();
    this.connectedReceivers.clear();
    this.frameBuffer = [];
    this.audioBuffer = [];
    this.isInitialized = false;
    
    errorHandler.info('NDI streaming service disposed');
  }
}

// Export singleton instance
export const ndiStreamingService = NDIStreamingService.getInstance();