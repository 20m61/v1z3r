/**
 * MIDI 2.0 Controller Service
 * Handles MIDI device communication and parameter mapping
 */

import { errorHandler } from '@/utils/errorHandler';
import { advancedFeaturesErrorHandler } from '@/utils/advancedFeaturesErrorHandler';

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  type: 'input' | 'output';
  version: string;
  connected: boolean;
  capabilities: MidiCapabilities;
}

export interface MidiCapabilities {
  supportsNoteOn: boolean;
  supportsNoteOff: boolean;
  supportsControlChange: boolean;
  supportsProgramChange: boolean;
  supportsPitchBend: boolean;
  supportsAftertouch: boolean;
  supportsSysEx: boolean;
  supportsPolyPressure: boolean;
  channelCount: number;
  midi2Support: boolean;
}

export interface MidiMapping {
  id: string;
  name: string;
  deviceId: string;
  messageType: 'note' | 'cc' | 'program' | 'pitchbend' | 'aftertouch' | 'sysex';
  channel: number;
  control: number;
  parameterPath: string;
  minValue: number;
  maxValue: number;
  curve: 'linear' | 'exponential' | 'logarithmic';
  enabled: boolean;
}

export interface MidiMessage {
  type: 'note' | 'cc' | 'program' | 'pitchbend' | 'aftertouch' | 'sysex';
  channel: number;
  note?: number;
  velocity?: number;
  control?: number;
  value: number;
  timestamp: number;
  rawData: Uint8Array;
}

export interface MidiConfig {
  enableMidi2: boolean;
  enableSysEx: boolean;
  learnMode: boolean;
  globalChannel: number;
  velocity: number;
  enableThrough: boolean;
  latencyCompensation: number;
}

export class MidiController {
  private static instance: MidiController | null = null;
  private midiAccess: WebMidi.MIDIAccess | null = null;
  private devices: Map<string, MidiDevice> = new Map();
  private mappings: Map<string, MidiMapping> = new Map();
  private isInitialized = false;
  private learningMapping: MidiMapping | null = null;
  private messageHandlers: Map<string, (message: MidiMessage) => void> = new Map();
  
  private config: MidiConfig = {
    enableMidi2: true,
    enableSysEx: true,
    learnMode: false,
    globalChannel: 0, // All channels
    velocity: 127,
    enableThrough: false,
    latencyCompensation: 0,
  };

  private callbacks: {
    onDeviceConnect?: (device: MidiDevice) => void;
    onDeviceDisconnect?: (device: MidiDevice) => void;
    onMidiMessage?: (message: MidiMessage) => void;
    onMappingLearn?: (mapping: MidiMapping) => void;
    onParameterChange?: (path: string, value: number) => void;
  } = {};

  private constructor() {}

  static getInstance(): MidiController {
    if (!MidiController.instance) {
      MidiController.instance = new MidiController();
    }
    return MidiController.instance;
  }

  /**
   * Initialize MIDI system
   */
  async initialize(): Promise<void> {
    try {
      errorHandler.info('Initializing MIDI system...');

      // Check for Web MIDI API support
      if (!navigator.requestMIDIAccess) {
        const compatError = advancedFeaturesErrorHandler.handleCompatibilityError('MIDI', 'Web MIDI API');
        throw new Error('Web MIDI API not supported in this browser');
      }

      // Request MIDI access with SysEx support
      this.midiAccess = await navigator.requestMIDIAccess({
        sysex: this.config.enableSysEx,
        software: true,
      });

      // Set up device monitoring
      this.midiAccess.onstatechange = (event) => {
        this.handleStateChange(event);
      };

      // Scan for existing devices
      this.scanDevices();

      this.isInitialized = true;
      errorHandler.info('MIDI system initialized successfully');
    } catch (error) {
      const midiError = advancedFeaturesErrorHandler.handleMIDIError(error as Error, 'MIDI initialization');
      errorHandler.error('Failed to initialize MIDI system', error as Error);
      
      // Execute recovery action (disable MIDI features)
      advancedFeaturesErrorHandler.executeRecovery('MIDI');
      throw error;
    }
  }

  /**
   * Scan for MIDI devices
   */
  private scanDevices(): void {
    if (!this.midiAccess) return;

    // Scan input devices
    this.midiAccess.inputs.forEach((input) => {
      this.addDevice(input, 'input');
    });

    // Scan output devices
    this.midiAccess.outputs.forEach((output) => {
      this.addDevice(output, 'output');
    });

    errorHandler.info(`Found ${this.devices.size} MIDI devices`);
  }

  /**
   * Add MIDI device
   */
  private addDevice(port: WebMidi.MIDIPort, type: 'input' | 'output'): void {
    const device: MidiDevice = {
      id: port.id,
      name: port.name || 'Unknown Device',
      manufacturer: port.manufacturer || 'Unknown',
      type,
      version: port.version || '1.0',
      connected: port.state === 'connected',
      capabilities: this.detectCapabilities(port),
    };

    this.devices.set(port.id, device);

    // Set up message handling for input devices
    if (type === 'input' && port.state === 'connected') {
      (port as WebMidi.MIDIInput).onmidimessage = (event) => {
        this.handleMidiMessage(event, device);
      };
    }

    this.callbacks.onDeviceConnect?.(device);
    errorHandler.info(`Added MIDI device: ${device.name}`);
  }

  /**
   * Remove MIDI device
   */
  private removeDevice(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (device) {
      this.devices.delete(deviceId);
      this.callbacks.onDeviceDisconnect?.(device);
      errorHandler.info(`Removed MIDI device: ${device.name}`);
    }
  }

  /**
   * Detect device capabilities
   */
  private detectCapabilities(port: WebMidi.MIDIPort): MidiCapabilities {
    // Default capabilities (would be enhanced with device-specific detection)
    return {
      supportsNoteOn: true,
      supportsNoteOff: true,
      supportsControlChange: true,
      supportsProgramChange: true,
      supportsPitchBend: true,
      supportsAftertouch: true,
      supportsSysEx: this.config.enableSysEx,
      supportsPolyPressure: true,
      channelCount: 16,
      midi2Support: false, // Would be detected from device
    };
  }

  /**
   * Handle MIDI state changes
   */
  private handleStateChange(event: WebMidi.MIDIConnectionEvent): void {
    const port = event.port;
    
    if (port.state === 'connected') {
      this.addDevice(port, port.type as 'input' | 'output');
    } else if (port.state === 'disconnected') {
      this.removeDevice(port.id);
    }
  }

  /**
   * Handle incoming MIDI messages
   */
  private handleMidiMessage(event: WebMidi.MIDIMessageEvent, device: MidiDevice): void {
    const message = this.parseMidiMessage(event.data, event.timeStamp);
    
    // Global message callback
    this.callbacks.onMidiMessage?.(message);

    // Learning mode
    if (this.config.learnMode && this.learningMapping) {
      this.learnMapping(message);
    }

    // Process mappings
    this.processMappings(message);

    // Custom message handlers
    this.messageHandlers.forEach((handler, id) => {
      try {
        handler(message);
      } catch (error) {
        const midiError = advancedFeaturesErrorHandler.handleMIDIError(error as Error, `Message handler ${id}`);
        errorHandler.error(`MIDI message handler error (${id})`, error as Error);
      }
    });
  }

  /**
   * Parse MIDI message
   */
  private parseMidiMessage(data: Uint8Array, timestamp: number): MidiMessage {
    const status = data[0];
    const channel = (status & 0x0F) + 1;
    const messageType = (status & 0xF0) >> 4;
    
    let message: MidiMessage = {
      type: 'cc',
      channel,
      value: 0,
      timestamp,
      rawData: data,
    };

    switch (messageType) {
      case 0x8: // Note Off
        message.type = 'note';
        message.note = data[1];
        message.velocity = 0;
        message.value = 0;
        break;
        
      case 0x9: // Note On
        message.type = 'note';
        message.note = data[1];
        message.velocity = data[2];
        message.value = data[2] / 127;
        break;
        
      case 0xA: // Aftertouch
        message.type = 'aftertouch';
        message.note = data[1];
        message.value = data[2] / 127;
        break;
        
      case 0xB: // Control Change
        message.type = 'cc';
        message.control = data[1];
        message.value = data[2] / 127;
        break;
        
      case 0xC: // Program Change
        message.type = 'program';
        message.value = data[1] / 127;
        break;
        
      case 0xE: // Pitch Bend
        message.type = 'pitchbend';
        message.value = ((data[2] << 7) | data[1]) / 16383;
        break;
        
      case 0xF: // System messages
        if (status === 0xF0) {
          message.type = 'sysex';
          message.value = 0;
        }
        break;
    }

    return message;
  }

  /**
   * Process MIDI mappings
   */
  private processMappings(message: MidiMessage): void {
    this.mappings.forEach((mapping) => {
      if (!mapping.enabled) return;

      // Check if message matches mapping
      if (this.messageMatchesMapping(message, mapping)) {
        // Apply curve transformation
        let value = this.applyCurve(message.value, mapping.curve);
        
        // Scale to parameter range
        value = mapping.minValue + (value * (mapping.maxValue - mapping.minValue));
        
        // Send parameter change
        this.callbacks.onParameterChange?.(mapping.parameterPath, value);
      }
    });
  }

  /**
   * Check if message matches mapping
   */
  private messageMatchesMapping(message: MidiMessage, mapping: MidiMapping): boolean {
    // Check message type
    if (message.type !== mapping.messageType) return false;
    
    // Check channel (0 = all channels)
    if (mapping.channel !== 0 && message.channel !== mapping.channel) return false;
    
    // Check control/note number for relevant message types
    if (mapping.messageType === 'cc' && message.control !== mapping.control) return false;
    if (mapping.messageType === 'note' && message.note !== mapping.control) return false;
    
    return true;
  }

  /**
   * Apply curve transformation
   */
  private applyCurve(value: number, curve: MidiMapping['curve']): number {
    switch (curve) {
      case 'exponential':
        return Math.pow(value, 2);
      case 'logarithmic':
        return Math.sqrt(value);
      case 'linear':
      default:
        return value;
    }
  }

  /**
   * Learn mapping from incoming message
   */
  private learnMapping(message: MidiMessage): void {
    if (!this.learningMapping) return;

    this.learningMapping.messageType = message.type;
    this.learningMapping.channel = message.channel;
    
    if (message.type === 'cc') {
      this.learningMapping.control = message.control || 0;
    } else if (message.type === 'note') {
      this.learningMapping.control = message.note || 0;
    }

    this.callbacks.onMappingLearn?.(this.learningMapping);
    this.stopLearning();
  }

  /**
   * Create MIDI mapping
   */
  createMapping(
    name: string,
    deviceId: string,
    parameterPath: string,
    options: Partial<MidiMapping> = {}
  ): string {
    const mapping: MidiMapping = {
      id: this.generateMappingId(),
      name,
      deviceId,
      messageType: 'cc',
      channel: 1,
      control: 0,
      parameterPath,
      minValue: 0,
      maxValue: 1,
      curve: 'linear',
      enabled: true,
      ...options,
    };

    this.mappings.set(mapping.id, mapping);
    errorHandler.info(`Created MIDI mapping: ${name}`);
    return mapping.id;
  }

  /**
   * Update MIDI mapping
   */
  updateMapping(id: string, updates: Partial<MidiMapping>): void {
    const mapping = this.mappings.get(id);
    if (mapping) {
      Object.assign(mapping, updates);
      errorHandler.info(`Updated MIDI mapping: ${mapping.name}`);
    }
  }

  /**
   * Delete MIDI mapping
   */
  deleteMapping(id: string): void {
    const mapping = this.mappings.get(id);
    if (mapping) {
      this.mappings.delete(id);
      errorHandler.info(`Deleted MIDI mapping: ${mapping.name}`);
    }
  }

  /**
   * Start learning mode
   */
  startLearning(parameterPath: string, name: string): void {
    this.learningMapping = {
      id: this.generateMappingId(),
      name,
      deviceId: '',
      messageType: 'cc',
      channel: 1,
      control: 0,
      parameterPath,
      minValue: 0,
      maxValue: 1,
      curve: 'linear',
      enabled: true,
    };

    this.config.learnMode = true;
    errorHandler.info(`Started MIDI learning for: ${parameterPath}`);
  }

  /**
   * Stop learning mode
   */
  stopLearning(): void {
    this.config.learnMode = false;
    this.learningMapping = null;
    errorHandler.info('Stopped MIDI learning');
  }

  /**
   * Send MIDI message
   */
  sendMessage(deviceId: string, message: Partial<MidiMessage>): void {
    if (!this.midiAccess) return;

    const device = this.devices.get(deviceId);
    if (!device || device.type !== 'output') return;

    const output = this.midiAccess.outputs.get(deviceId);
    if (!output) return;

    const data = this.createMidiMessage(message);
    output.send(data);
  }

  /**
   * Create MIDI message data
   */
  private createMidiMessage(message: Partial<MidiMessage>): Uint8Array {
    const data = new Uint8Array(3);
    const channel = (message.channel || 1) - 1;
    
    switch (message.type) {
      case 'note':
        if (message.velocity && message.velocity > 0) {
          data[0] = 0x90 | channel; // Note On
          data[2] = message.velocity;
        } else {
          data[0] = 0x80 | channel; // Note Off
          data[2] = 0;
        }
        data[1] = message.note || 60;
        break;
        
      case 'cc':
        data[0] = 0xB0 | channel; // Control Change
        data[1] = message.control || 0;
        data[2] = Math.round((message.value || 0) * 127);
        break;
        
      case 'program':
        data[0] = 0xC0 | channel; // Program Change
        data[1] = Math.round((message.value || 0) * 127);
        return data.slice(0, 2);
        
      case 'pitchbend':
        data[0] = 0xE0 | channel; // Pitch Bend
        const pitchValue = Math.round((message.value || 0) * 16383);
        data[1] = pitchValue & 0x7F;
        data[2] = (pitchValue >> 7) & 0x7F;
        break;
    }

    return data;
  }

  /**
   * Generate mapping ID
   */
  private generateMappingId(): string {
    return `midi_mapping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add message handler
   */
  addMessageHandler(id: string, handler: (message: MidiMessage) => void): void {
    this.messageHandlers.set(id, handler);
  }

  /**
   * Remove message handler
   */
  removeMessageHandler(id: string): void {
    this.messageHandlers.delete(id);
  }

  /**
   * Get available devices
   */
  getDevices(): MidiDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * Get device by ID
   */
  getDevice(id: string): MidiDevice | undefined {
    return this.devices.get(id);
  }

  /**
   * Get all mappings
   */
  getMappings(): MidiMapping[] {
    return Array.from(this.mappings.values());
  }

  /**
   * Get mapping by ID
   */
  getMapping(id: string): MidiMapping | undefined {
    return this.mappings.get(id);
  }

  /**
   * Get configuration
   */
  getConfig(): MidiConfig {
    return { ...this.config };
  }

  /**
   * Set configuration
   */
  setConfig(config: Partial<MidiConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set callbacks
   */
  setCallbacks(callbacks: Partial<typeof this.callbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Export mappings
   */
  exportMappings(): string {
    const mappings = Array.from(this.mappings.values());
    return JSON.stringify(mappings, null, 2);
  }

  /**
   * Import mappings
   */
  importMappings(data: string): void {
    try {
      const mappings = JSON.parse(data) as MidiMapping[];
      this.mappings.clear();
      
      mappings.forEach(mapping => {
        this.mappings.set(mapping.id, mapping);
      });
      
      errorHandler.info(`Imported ${mappings.length} MIDI mappings`);
    } catch (error) {
      errorHandler.error('Failed to import MIDI mappings', error as Error);
    }
  }

  /**
   * Check if initialized
   */
  isInitializedState(): boolean {
    return this.isInitialized;
  }

  /**
   * Get feature health status
   */
  getHealthStatus(): 'healthy' | 'degraded' | 'unavailable' {
    return advancedFeaturesErrorHandler.getFeatureHealth('MIDI');
  }

  /**
   * Get user-friendly error message
   */
  getErrorMessage(): string {
    return advancedFeaturesErrorHandler.getUserMessage('MIDI');
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.midiAccess) {
      this.midiAccess.inputs.forEach(input => {
        input.onmidimessage = null;
      });
      this.midiAccess.onstatechange = null;
    }

    this.devices.clear();
    this.mappings.clear();
    this.messageHandlers.clear();
    this.isInitialized = false;
    
    errorHandler.info('MIDI controller disposed');
  }
}

// Export singleton instance
export const midiController = MidiController.getInstance();