/**
 * MIDI Controller Tests
 * Tests for MIDI 2.0 controller functionality
 */

import { midiController, MidiDevice, MidiMapping } from '../midiController';

// Mock Web MIDI API
const mockMidiAccess = {
  inputs: new Map([
    ['input-1', {
      id: 'input-1',
      name: 'Test MIDI Input',
      manufacturer: 'Test Manufacturer',
      type: 'input',
      state: 'connected',
      version: '1.0',
      onmidimessage: null
    }]
  ]),
  outputs: new Map([
    ['output-1', {
      id: 'output-1',
      name: 'Test MIDI Output',
      manufacturer: 'Test Manufacturer',
      type: 'output',
      state: 'connected',
      version: '1.0',
      send: jest.fn()
    }]
  ]),
  onstatechange: null
};

const mockRequestMIDIAccess = jest.fn();

// Ensure global navigator exists
if (typeof global.navigator === 'undefined') {
  (global as any).navigator = {};
}

describe('MidiController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock implementation
    mockRequestMIDIAccess.mockResolvedValue(mockMidiAccess);
    
    // Ensure navigator.requestMIDIAccess is available
    Object.defineProperty(global.navigator, 'requestMIDIAccess', {
      value: mockRequestMIDIAccess,
      writable: true,
      configurable: true
    });
    
    // Reset singleton
    (midiController as any).isInitialized = false;
    (midiController as any).midiAccess = null;
    (midiController as any).devices.clear();
    (midiController as any).mappings.clear();
    (midiController as any).learningMapping = null;
  });

  afterEach(() => {
    // Clean up navigator mock
    if (global.navigator && global.navigator.requestMIDIAccess) {
      delete (global.navigator as any).requestMIDIAccess;
    }
  });

  describe('initialization', () => {
    it('should initialize MIDI system successfully', async () => {
      await expect(midiController.initialize()).resolves.not.toThrow();
      expect(mockRequestMIDIAccess).toHaveBeenCalledWith({
        sysex: true,
        software: true
      });
    });

    it('should handle missing Web MIDI API', async () => {
      Object.defineProperty(global.navigator, 'requestMIDIAccess', {
        value: undefined,
        writable: true,
        configurable: true
      });

      await expect(midiController.initialize()).rejects.toThrow('Web MIDI API not supported');
    });

    it('should discover devices after initialization', async () => {
      await midiController.initialize();
      const devices = midiController.getDevices();
      expect(devices.length).toBeGreaterThan(0);
      
      const inputDevice = devices.find(d => d.type === 'input');
      expect(inputDevice).toBeDefined();
      expect(inputDevice?.name).toBe('Test MIDI Input');
    });
  });

  describe('device management', () => {
    beforeEach(async () => {
      await midiController.initialize();
    });

    it('should get device by ID', () => {
      const device = midiController.getDevice('input-1');
      expect(device).toBeDefined();
      expect(device?.name).toBe('Test MIDI Input');
    });

    it('should return undefined for invalid device ID', () => {
      const device = midiController.getDevice('invalid-id');
      expect(device).toBeUndefined();
    });

    it('should handle device state changes', () => {
      const stateChangeEvent = {
        port: {
          id: 'new-device',
          name: 'New Device',
          manufacturer: 'Test',
          type: 'input',
          state: 'connected',
          version: '1.0'
        }
      };

      (midiController as any).handleStateChange(stateChangeEvent);
      
      const device = midiController.getDevice('new-device');
      expect(device).toBeDefined();
    });
  });

  describe('MIDI message handling', () => {
    beforeEach(async () => {
      await midiController.initialize();
    });

    it('should parse note on message', () => {
      const data = new Uint8Array([0x90, 60, 127]); // Note on, middle C, velocity 127
      const message = (midiController as any).parseMidiMessage(data, Date.now());
      
      expect(message.type).toBe('note');
      expect(message.note).toBe(60);
      expect(message.velocity).toBe(127);
      expect(message.channel).toBe(1);
      expect(message.value).toBe(1); // 127/127
    });

    it('should parse note off message', () => {
      const data = new Uint8Array([0x80, 60, 0]); // Note off, middle C
      const message = (midiController as any).parseMidiMessage(data, Date.now());
      
      expect(message.type).toBe('note');
      expect(message.note).toBe(60);
      expect(message.velocity).toBe(0);
      expect(message.value).toBe(0);
    });

    it('should parse control change message', () => {
      const data = new Uint8Array([0xB0, 7, 100]); // CC 7 (volume), value 100
      const message = (midiController as any).parseMidiMessage(data, Date.now());
      
      expect(message.type).toBe('cc');
      expect(message.control).toBe(7);
      expect(message.value).toBeCloseTo(100/127, 2);
    });

    it('should parse pitch bend message', () => {
      const data = new Uint8Array([0xE0, 0, 64]); // Pitch bend, center position
      const message = (midiController as any).parseMidiMessage(data, Date.now());
      
      expect(message.type).toBe('pitchbend');
      expect(message.value).toBeCloseTo(0.5, 2);
    });
  });

  describe('mapping management', () => {
    beforeEach(async () => {
      await midiController.initialize();
    });

    it('should create mapping', () => {
      const mappingId = midiController.createMapping(
        'Test Mapping',
        'input-1',
        'visualizer.sensitivity',
        {
          messageType: 'cc',
          control: 7,
          minValue: 0,
          maxValue: 3
        }
      );

      expect(mappingId).toBeDefined();
      
      const mapping = midiController.getMapping(mappingId);
      expect(mapping).toBeDefined();
      expect(mapping?.name).toBe('Test Mapping');
      expect(mapping?.parameterPath).toBe('visualizer.sensitivity');
    });

    it('should update mapping', () => {
      const mappingId = midiController.createMapping('Test', 'input-1', 'param');
      
      midiController.updateMapping(mappingId, {
        enabled: false,
        minValue: 10,
        maxValue: 20
      });

      const mapping = midiController.getMapping(mappingId);
      expect(mapping?.enabled).toBe(false);
      expect(mapping?.minValue).toBe(10);
      expect(mapping?.maxValue).toBe(20);
    });

    it('should delete mapping', () => {
      const mappingId = midiController.createMapping('Test', 'input-1', 'param');
      
      midiController.deleteMapping(mappingId);
      
      const mapping = midiController.getMapping(mappingId);
      expect(mapping).toBeUndefined();
    });

    it('should get all mappings', () => {
      midiController.createMapping('Mapping 1', 'input-1', 'param1');
      midiController.createMapping('Mapping 2', 'input-1', 'param2');
      
      const mappings = midiController.getMappings();
      expect(mappings.length).toBe(2);
    });
  });

  describe('mapping processing', () => {
    beforeEach(async () => {
      await midiController.initialize();
    });

    it('should process matching mapping', () => {
      const onParameterChange = jest.fn();
      
      midiController.setCallbacks({
        onParameterChange
      });

      const mappingId = midiController.createMapping('Test', 'input-1', 'test.param', {
        messageType: 'cc',
        control: 7,
        minValue: 0,
        maxValue: 100
      });

      const message = {
        type: 'cc' as const,
        channel: 1,
        control: 7,
        value: 0.5,
        timestamp: Date.now(),
        rawData: new Uint8Array([0xB0, 7, 64])
      };

      (midiController as any).processMappings(message);
      
      expect(onParameterChange).toHaveBeenCalledWith('test.param', 50);
    });

    it('should not process disabled mapping', () => {
      const onParameterChange = jest.fn();
      
      midiController.setCallbacks({
        onParameterChange
      });

      const mappingId = midiController.createMapping('Test', 'input-1', 'test.param', {
        messageType: 'cc',
        control: 7,
        enabled: false
      });

      const message = {
        type: 'cc' as const,
        channel: 1,
        control: 7,
        value: 0.5,
        timestamp: Date.now(),
        rawData: new Uint8Array([0xB0, 7, 64])
      };

      (midiController as any).processMappings(message);
      
      expect(onParameterChange).not.toHaveBeenCalled();
    });

    it('should apply curve transformations', () => {
      const exponentialValue = (midiController as any).applyCurve(0.5, 'exponential');
      expect(exponentialValue).toBe(0.25);

      const logarithmicValue = (midiController as any).applyCurve(0.25, 'logarithmic');
      expect(logarithmicValue).toBe(0.5);

      const linearValue = (midiController as any).applyCurve(0.7, 'linear');
      expect(linearValue).toBe(0.7);
    });
  });

  describe('learning mode', () => {
    beforeEach(async () => {
      await midiController.initialize();
    });

    it('should start learning mode', () => {
      midiController.startLearning('test.param', 'Test Parameter');
      
      const config = midiController.getConfig();
      expect(config.learnMode).toBe(true);
    });

    it('should stop learning mode', () => {
      midiController.startLearning('test.param', 'Test Parameter');
      midiController.stopLearning();
      
      const config = midiController.getConfig();
      expect(config.learnMode).toBe(false);
    });

    it('should learn mapping from message', () => {
      const onMappingLearn = jest.fn();
      
      midiController.setCallbacks({
        onMappingLearn
      });

      midiController.startLearning('test.param', 'Test Parameter');

      const message = {
        type: 'cc' as const,
        channel: 1,
        control: 7,
        value: 0.5,
        timestamp: Date.now(),
        rawData: new Uint8Array([0xB0, 7, 64])
      };

      (midiController as any).learnMapping(message);
      
      expect(onMappingLearn).toHaveBeenCalled();
      expect(midiController.getConfig().learnMode).toBe(false);
    });
  });

  describe('message sending', () => {
    beforeEach(async () => {
      await midiController.initialize();
    });

    it('should send MIDI message', () => {
      const outputPort = mockMidiAccess.outputs.get('output-1');
      
      midiController.sendMessage('output-1', {
        type: 'note',
        note: 60,
        velocity: 127,
        channel: 1
      });

      expect(outputPort.send).toHaveBeenCalled();
    });

    it('should not send to invalid device', () => {
      midiController.sendMessage('invalid-id', {
        type: 'note',
        note: 60,
        velocity: 127
      });

      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should get default configuration', () => {
      const config = midiController.getConfig();
      expect(config.enableMidi2).toBe(true);
      expect(config.enableSysEx).toBe(true);
      expect(config.learnMode).toBe(false);
      expect(config.globalChannel).toBe(0);
    });

    it('should update configuration', () => {
      midiController.setConfig({
        enableMidi2: false,
        velocity: 100,
        latencyCompensation: 5
      });

      const config = midiController.getConfig();
      expect(config.enableMidi2).toBe(false);
      expect(config.velocity).toBe(100);
      expect(config.latencyCompensation).toBe(5);
    });
  });

  describe('import/export', () => {
    beforeEach(async () => {
      await midiController.initialize();
    });

    it('should export mappings', () => {
      midiController.createMapping('Test 1', 'input-1', 'param1');
      midiController.createMapping('Test 2', 'input-1', 'param2');
      
      const exported = midiController.exportMappings();
      const parsed = JSON.parse(exported);
      
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toHaveProperty('name');
      expect(parsed[0]).toHaveProperty('parameterPath');
    });

    it('should import mappings', () => {
      const mappingData = [{
        id: 'test-1',
        name: 'Imported Mapping',
        deviceId: 'input-1',
        messageType: 'cc',
        channel: 1,
        control: 7,
        parameterPath: 'imported.param',
        minValue: 0,
        maxValue: 1,
        curve: 'linear',
        enabled: true
      }];

      midiController.importMappings(JSON.stringify(mappingData));
      
      const mapping = midiController.getMapping('test-1');
      expect(mapping).toBeDefined();
      expect(mapping?.name).toBe('Imported Mapping');
    });

    it('should handle invalid import data', () => {
      expect(() => {
        midiController.importMappings('invalid json');
      }).not.toThrow();
    });
  });

  describe('message handlers', () => {
    beforeEach(async () => {
      await midiController.initialize();
    });

    it('should add and call message handler', () => {
      const handler = jest.fn();
      
      midiController.addMessageHandler('test-handler', handler);
      
      const message = {
        type: 'cc' as const,
        channel: 1,
        control: 7,
        value: 0.5,
        timestamp: Date.now(),
        rawData: new Uint8Array([0xB0, 7, 64])
      };

      (midiController as any).handleMidiMessage({
        data: message.rawData,
        timeStamp: message.timestamp
      }, { id: 'input-1' });

      expect(handler).toHaveBeenCalled();
    });

    it('should remove message handler', () => {
      const handler = jest.fn();
      
      midiController.addMessageHandler('test-handler', handler);
      midiController.removeMessageHandler('test-handler');
      
      const message = {
        type: 'cc' as const,
        channel: 1,
        control: 7,
        value: 0.5,
        timestamp: Date.now(),
        rawData: new Uint8Array([0xB0, 7, 64])
      };

      (midiController as any).handleMidiMessage({
        data: message.rawData,
        timeStamp: message.timestamp
      }, { id: 'input-1' });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should dispose resources', () => {
      expect(() => midiController.dispose()).not.toThrow();
      expect(midiController.isInitializedState()).toBe(false);
    });
  });
});