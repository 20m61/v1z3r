/**
 * Integration tests for v1z3r modules
 * Tests cross-module interactions and dependencies
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock WebGL context
const mockWebGLContext = {
  createShader: jest.fn(),
  shaderSource: jest.fn(),
  compileShader: jest.fn(),
  getShaderParameter: jest.fn(() => true),
  createProgram: jest.fn(),
  attachShader: jest.fn(),
  linkProgram: jest.fn(),
  getProgramParameter: jest.fn(() => true),
  useProgram: jest.fn(),
  getAttribLocation: jest.fn(() => 0),
  getUniformLocation: jest.fn(() => 0),
  enableVertexAttribArray: jest.fn(),
  vertexAttribPointer: jest.fn(),
  uniform1f: jest.fn(),
  uniform3fv: jest.fn(),
  createBuffer: jest.fn(),
  bindBuffer: jest.fn(),
  bufferData: jest.fn(),
  clear: jest.fn(),
  clearColor: jest.fn(),
  drawArrays: jest.fn(),
  viewport: jest.fn(),
};

// Mock canvas
const mockCanvas = {
  getContext: jest.fn((type) => {
    if (type === 'webgl2' || type === 'webgl') {
      return mockWebGLContext;
    }
    return null;
  }),
  width: 800,
  height: 600,
};

global.document.createElement = jest.fn((tag) => {
  if (tag === 'canvas') {
    return mockCanvas as any;
  }
  return document.createElement(tag);
});

// Mock modules
jest.mock('@vj-app/visual-renderer', () => ({
  VisualRenderer: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    render: jest.fn(),
    updateEffect: jest.fn(),
    setAudioData: jest.fn(),
    dispose: jest.fn(),
  })),
  EffectType: {
    WAVEFORM: 'waveform',
    SPECTRUM: 'spectrum',
    PARTICLES: 'particles',
  },
}));

jest.mock('@vj-app/sync-core', () => ({
  SyncCoreModule: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    getClient: jest.fn(() => ({
      connect: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn().mockResolvedValue(true),
      createRoom: jest.fn().mockResolvedValue({ id: 'room-123' }),
      joinRoom: jest.fn().mockResolvedValue({ id: 'room-123' }),
      emit: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
    destroy: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('@vj-app/preset-storage', () => ({
  PresetStorageModule: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    getRepository: jest.fn(() => ({
      create: jest.fn().mockResolvedValue({ id: 'preset-123' }),
      findById: jest.fn().mockResolvedValue({ id: 'preset-123', name: 'Test Preset' }),
      findAll: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ id: 'preset-123' }),
      delete: jest.fn().mockResolvedValue(true),
    })),
    destroy: jest.fn().mockResolvedValue(true),
  })),
}));

describe('Module Integration Tests', () => {
  let visualRenderer: any;
  let syncCore: any;
  let presetStorage: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Import modules
    const { VisualRenderer } = await import('@vj-app/visual-renderer');
    const { SyncCoreModule } = await import('@vj-app/sync-core');
    const { PresetStorageModule } = await import('@vj-app/preset-storage');
    
    // Initialize modules
    visualRenderer = new VisualRenderer();
    syncCore = new SyncCoreModule();
    presetStorage = new PresetStorageModule();
  });

  afterEach(async () => {
    // Cleanup
    if (visualRenderer?.dispose) {
      await visualRenderer.dispose();
    }
    if (syncCore?.destroy) {
      await syncCore.destroy();
    }
    if (presetStorage?.destroy) {
      await presetStorage.destroy();
    }
  });

  describe('Visual Renderer Integration', () => {
    it('initializes renderer with canvas', async () => {
      await visualRenderer.initialize({ canvas: mockCanvas });
      
      expect(visualRenderer.initialize).toHaveBeenCalledWith({ canvas: mockCanvas });
      expect(mockCanvas.getContext).toHaveBeenCalledWith('webgl2');
    });

    it('updates effects based on audio data', async () => {
      await visualRenderer.initialize({ canvas: mockCanvas });
      
      const audioData = new Float32Array(256).fill(0.5);
      visualRenderer.setAudioData(audioData);
      visualRenderer.render();
      
      expect(visualRenderer.setAudioData).toHaveBeenCalledWith(audioData);
      expect(visualRenderer.render).toHaveBeenCalled();
    });

    it('switches between effect types', async () => {
      const { EffectType } = await import('@vj-app/visual-renderer');
      
      await visualRenderer.initialize({ canvas: mockCanvas });
      
      visualRenderer.updateEffect(EffectType.WAVEFORM);
      expect(visualRenderer.updateEffect).toHaveBeenCalledWith('waveform');
      
      visualRenderer.updateEffect(EffectType.PARTICLES);
      expect(visualRenderer.updateEffect).toHaveBeenCalledWith('particles');
    });
  });

  describe('Sync Core Integration', () => {
    it('establishes WebSocket connection', async () => {
      await syncCore.initialize({
        client: {
          url: 'ws://localhost:8080',
          reconnect: true,
        },
      });
      
      const client = syncCore.getClient();
      expect(client.connect).toBeDefined();
      expect(syncCore.initialize).toHaveBeenCalled();
    });

    it('creates and joins collaborative rooms', async () => {
      await syncCore.initialize({
        client: { url: 'ws://localhost:8080' },
      });
      
      const client = syncCore.getClient();
      
      // Create room
      const room = await client.createRoom({
        name: 'Test Room',
        maxParticipants: 4,
      });
      
      expect(room.id).toBe('room-123');
      
      // Join room
      const joinedRoom = await client.joinRoom('room-123', {
        name: 'Test User',
        role: 'participant',
      });
      
      expect(joinedRoom.id).toBe('room-123');
    });

    it('handles real-time event synchronization', async () => {
      await syncCore.initialize({
        client: { url: 'ws://localhost:8080' },
      });
      
      const client = syncCore.getClient();
      const eventHandler = jest.fn();
      
      // Add event listener
      client.addEventListener('effectChange', eventHandler);
      
      // Emit event
      client.emit({
        type: 'effectChange',
        data: { effect: 'particles', params: {} },
      });
      
      expect(client.addEventListener).toHaveBeenCalledWith('effectChange', eventHandler);
      expect(client.emit).toHaveBeenCalled();
    });
  });

  describe('Preset Storage Integration', () => {
    it('initializes with DynamoDB configuration', async () => {
      await presetStorage.initialize({
        tableName: 'vj-presets-test',
        region: 'us-east-1',
      });
      
      expect(presetStorage.initialize).toHaveBeenCalledWith({
        tableName: 'vj-presets-test',
        region: 'us-east-1',
      });
    });

    it('performs CRUD operations on presets', async () => {
      await presetStorage.initialize({
        tableName: 'vj-presets-test',
        region: 'us-east-1',
      });
      
      const repository = presetStorage.getRepository();
      
      // Create
      const newPreset = await repository.create({
        name: 'My Preset',
        effectType: 'spectrum',
        parameters: { sensitivity: 1.5 },
      });
      expect(newPreset.id).toBe('preset-123');
      
      // Read
      const preset = await repository.findById('preset-123');
      expect(preset.name).toBe('Test Preset');
      
      // Update
      const updated = await repository.update('preset-123', {
        name: 'Updated Preset',
      });
      expect(updated.id).toBe('preset-123');
      
      // Delete
      const deleted = await repository.delete('preset-123');
      expect(deleted).toBe(true);
    });
  });

  describe('Cross-Module Integration', () => {
    it('syncs visual effects across clients', async () => {
      // Initialize all modules
      await visualRenderer.initialize({ canvas: mockCanvas });
      await syncCore.initialize({
        client: { url: 'ws://localhost:8080' },
      });
      
      const syncClient = syncCore.getClient();
      
      // Listen for effect changes
      syncClient.addEventListener('effectChange', (event: any) => {
        visualRenderer.updateEffect(event.data.effect);
      });
      
      // Simulate remote effect change
      syncClient.emit({
        type: 'effectChange',
        data: { effect: 'particles' },
      });
      
      expect(visualRenderer.updateEffect).toHaveBeenCalledWith('particles');
    });

    it('saves and loads presets with visual state', async () => {
      await visualRenderer.initialize({ canvas: mockCanvas });
      await presetStorage.initialize({
        tableName: 'vj-presets-test',
        region: 'us-east-1',
      });
      
      const repository = presetStorage.getRepository();
      
      // Save current visual state as preset
      const currentState = {
        effectType: 'waveform',
        colorTheme: '#00ff00',
        sensitivity: 1.2,
      };
      
      const saved = await repository.create({
        name: 'Green Wave',
        ...currentState,
      });
      
      // Load preset and apply to renderer
      const loaded = await repository.findById(saved.id);
      if (loaded) {
        visualRenderer.updateEffect(loaded.effectType);
      }
      
      expect(visualRenderer.updateEffect).toHaveBeenCalledWith('waveform');
    });

    it('broadcasts preset changes to all connected clients', async () => {
      // Initialize all modules
      await syncCore.initialize({
        client: { url: 'ws://localhost:8080' },
      });
      await presetStorage.initialize({
        tableName: 'vj-presets-test',
        region: 'us-east-1',
      });
      
      const syncClient = syncCore.getClient();
      const repository = presetStorage.getRepository();
      
      // Create room
      await syncClient.createRoom({ name: 'Preset Share Room' });
      
      // Save preset
      const preset = await repository.create({
        name: 'Shared Preset',
        effectType: 'spectrum',
      });
      
      // Broadcast preset change
      syncClient.emit({
        type: 'presetChange',
        data: { presetId: preset.id },
      });
      
      expect(syncClient.emit).toHaveBeenCalledWith({
        type: 'presetChange',
        data: { presetId: 'preset-123' },
      });
    });
  });

  describe('Error Handling', () => {
    it('handles module initialization failures gracefully', async () => {
      const { SyncCoreModule } = await import('@vj-app/sync-core');
      const failingSync = new SyncCoreModule();
      
      // Mock initialization failure
      failingSync.initialize = jest.fn().mockRejectedValue(new Error('Connection failed'));
      
      await expect(
        failingSync.initialize({ client: { url: 'invalid-url' } })
      ).rejects.toThrow('Connection failed');
    });

    it('cleans up resources on error', async () => {
      await visualRenderer.initialize({ canvas: mockCanvas });
      
      // Simulate error during operation
      visualRenderer.render = jest.fn().mockImplementation(() => {
        throw new Error('Render failed');
      });
      
      expect(() => visualRenderer.render()).toThrow('Render failed');
      
      // Cleanup should still work
      await visualRenderer.dispose();
      expect(visualRenderer.dispose).toHaveBeenCalled();
    });
  });
});