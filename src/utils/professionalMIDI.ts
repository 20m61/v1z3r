/**
 * Professional MIDI Controller Integration for v1z3r
 * Support for industry-standard VJ controllers and hardware
 */

import { VisualParameters } from './aiMusicAnalyzer';

export interface MIDIControllerConfig {
  deviceName: string;
  manufacturer: string;
  model: string;
  inputChannels: number;
  outputChannels: number;
  hasLightFeedback: boolean;
  supportsTouchSensitivity: boolean;
  supportsAftertouch: boolean;
  hasDisplays: boolean;
  customMappings: MIDIControlMapping[];
}

export interface MIDIControlMapping {
  controlId: string;
  midiChannel: number;
  midiCC: number;
  controlType: 'knob' | 'fader' | 'button' | 'pad' | 'encoder' | 'touch';
  parameter: string;
  valueRange: [number, number];
  curve: 'linear' | 'exponential' | 'logarithmic' | 'custom';
  sensitivity: number;
  feedback: boolean;
  color?: string;
  label?: string;
}

export interface MIDIDevice {
  id: string;
  name: string;
  manufacturer: string;
  version: string;
  type: 'input' | 'output';
  state: 'connected' | 'disconnected';
  connection: 'open' | 'closed' | 'pending';
}

export interface MIDIMessage {
  command: number;
  channel: number;
  data1: number;
  data2: number;
  timestamp: number;
  velocity?: number;
  pressure?: number;
  pitchBend?: number;
}

export interface TouchSensitivity {
  x: number;
  y: number;
  pressure: number;
  size: number;
}

export interface ControllerState {
  knobs: Map<string, number>;
  faders: Map<string, number>;
  buttons: Map<string, boolean>;
  pads: Map<string, { active: boolean; velocity: number; pressure?: number }>;
  encoders: Map<string, number>;
  touchPads: Map<string, TouchSensitivity>;
  displays: Map<string, string>;
  lastActivity: number;
}

/**
 * Professional MIDI Controller Manager
 */
export class ProfessionalMIDIManager {
  private midiAccess: MIDIAccess | null = null;
  private connectedControllers: Map<string, MIDIControllerConfig> = new Map();
  private controllerStates: Map<string, ControllerState> = new Map();
  private parameterMappings: Map<string, string> = new Map();
  private feedbackOutputs: Map<string, MIDIOutput> = new Map();
  private isInitialized: boolean = false;

  // Event handlers
  private onParameterChange: ((parameter: string, value: number) => void) | null = null;
  private onButtonPress: ((button: string, velocity: number) => void) | null = null;
  private onPadHit: ((pad: string, velocity: number, pressure?: number) => void) | null = null;
  private onControllerConnect: ((controller: MIDIControllerConfig) => void) | null = null;
  private onControllerDisconnect: ((controllerId: string) => void) | null = null;

  constructor() {
    this.loadControllerPresets();
  }

  /**
   * Initialize MIDI system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Request MIDI access
      this.midiAccess = await navigator.requestMIDIAccess({
        sysex: true, // Request system exclusive access for advanced features
        software: false, // Hardware controllers only
      }) as unknown as MIDIAccess;

      // Setup event handlers
      this.midiAccess.addEventListener('statechange', this.handleDeviceStateChange.bind(this));

      // Scan for connected devices
      await this.scanForControllers();

      this.isInitialized = true;
      console.log('[ProfessionalMIDI] MIDI system initialized');
    } catch (error) {
      console.error('[ProfessionalMIDI] Failed to initialize MIDI:', error);
      throw error;
    }
  }

  /**
   * Scan for connected controllers
   */
  private async scanForControllers(): Promise<void> {
    if (!this.midiAccess) return;

    // Scan input devices
    for (const input of this.midiAccess.inputs.values()) {
      await this.identifyController(input);
    }

    // Scan output devices
    for (const output of this.midiAccess.outputs.values()) {
      this.setupOutputDevice(output);
    }
  }

  /**
   * Identify controller type and configure
   */
  private async identifyController(input: MIDIInput): Promise<void> {
    const deviceInfo = this.identifyDevice(input.name!, input.manufacturer!);
    
    if (deviceInfo) {
      console.log(`[ProfessionalMIDI] Identified controller: ${deviceInfo.model}`);
      
      // Store controller configuration
      this.connectedControllers.set(input.id, deviceInfo);
      
      // Initialize controller state
      this.controllerStates.set(input.id, this.createInitialState());
      
      // Setup message handler
      input.addEventListener('midimessage', (event) => {
        this.handleMIDIMessage(input.id, event);
      });
      
      // Open connection
      await input.open();
      
      // Send initialization sequence
      await this.initializeController(input.id, deviceInfo);
      
      // Notify connection
      if (this.onControllerConnect) {
        this.onControllerConnect(deviceInfo);
      }
    }
  }

  /**
   * Setup output device for feedback
   */
  private setupOutputDevice(output: MIDIOutput): void {
    this.feedbackOutputs.set(output.id, output);
    console.log(`[ProfessionalMIDI] Output device configured: ${output.name}`);
  }

  /**
   * Identify device type from name and manufacturer
   */
  private identifyDevice(name: string, manufacturer: string): MIDIControllerConfig | null {
    const deviceName = name.toLowerCase();
    const deviceManufacturer = manufacturer.toLowerCase();

    // Pioneer DJ Controllers
    if (deviceManufacturer.includes('pioneer') || deviceName.includes('ddj')) {
      return this.createPioneerDDJConfig(name, manufacturer);
    }

    // Native Instruments Controllers
    if (deviceManufacturer.includes('native instruments') || deviceName.includes('maschine')) {
      return this.createNIMaschineConfig(name, manufacturer);
    }

    // Ableton Push Controllers
    if (deviceManufacturer.includes('ableton') || deviceName.includes('push')) {
      return this.createAbletonPushConfig(name, manufacturer);
    }

    // Novation Controllers
    if (deviceManufacturer.includes('novation') || deviceName.includes('launchpad')) {
      return this.createNovationConfig(name, manufacturer);
    }

    // Akai Controllers
    if (deviceManufacturer.includes('akai') || deviceName.includes('apc')) {
      return this.createAkaiConfig(name, manufacturer);
    }

    // Generic MIDI controller
    return this.createGenericConfig(name, manufacturer);
  }

  /**
   * Create Pioneer DDJ controller configuration
   */
  private createPioneerDDJConfig(name: string, manufacturer: string): MIDIControllerConfig {
    return {
      deviceName: name,
      manufacturer: manufacturer,
      model: 'Pioneer DDJ Series',
      inputChannels: 16,
      outputChannels: 16,
      hasLightFeedback: true,
      supportsTouchSensitivity: true,
      supportsAftertouch: false,
      hasDisplays: false,
      customMappings: [
        // Crossfader
        {
          controlId: 'crossfader',
          midiChannel: 1,
          midiCC: 8,
          controlType: 'fader',
          parameter: 'master_crossfade',
          valueRange: [0, 1],
          curve: 'linear',
          sensitivity: 1.0,
          feedback: true,
          label: 'Crossfader',
        },
        // Channel faders
        {
          controlId: 'channel_1_fader',
          midiChannel: 1,
          midiCC: 13,
          controlType: 'fader',
          parameter: 'layer_1_opacity',
          valueRange: [0, 1],
          curve: 'linear',
          sensitivity: 1.0,
          feedback: true,
          label: 'Channel 1',
        },
        {
          controlId: 'channel_2_fader',
          midiChannel: 1,
          midiCC: 14,
          controlType: 'fader',
          parameter: 'layer_2_opacity',
          valueRange: [0, 1],
          curve: 'linear',
          sensitivity: 1.0,
          feedback: true,
          label: 'Channel 2',
        },
        // EQ knobs
        {
          controlId: 'eq_high_1',
          midiChannel: 1,
          midiCC: 16,
          controlType: 'knob',
          parameter: 'effect_brightness',
          valueRange: [0, 2],
          curve: 'exponential',
          sensitivity: 0.8,
          feedback: true,
          label: 'High 1',
        },
        {
          controlId: 'eq_mid_1',
          midiChannel: 1,
          midiCC: 17,
          controlType: 'knob',
          parameter: 'effect_contrast',
          valueRange: [0, 2],
          curve: 'exponential',
          sensitivity: 0.8,
          feedback: true,
          label: 'Mid 1',
        },
        {
          controlId: 'eq_low_1',
          midiChannel: 1,
          midiCC: 18,
          controlType: 'knob',
          parameter: 'effect_saturation',
          valueRange: [0, 2],
          curve: 'exponential',
          sensitivity: 0.8,
          feedback: true,
          label: 'Low 1',
        },
        // Jog wheels (touch sensitive)
        {
          controlId: 'jog_wheel_1',
          midiChannel: 1,
          midiCC: 33,
          controlType: 'touch',
          parameter: 'effect_speed',
          valueRange: [-2, 2],
          curve: 'linear',
          sensitivity: 1.5,
          feedback: true,
          label: 'Jog 1',
        },
        // Hot cue pads
        {
          controlId: 'hot_cue_1',
          midiChannel: 1,
          midiCC: 54,
          controlType: 'pad',
          parameter: 'preset_1',
          valueRange: [0, 1],
          curve: 'linear',
          sensitivity: 1.0,
          feedback: true,
          color: '#ff0000',
          label: 'Cue 1',
        },
        {
          controlId: 'hot_cue_2',
          midiChannel: 1,
          midiCC: 55,
          controlType: 'pad',
          parameter: 'preset_2',
          valueRange: [0, 1],
          curve: 'linear',
          sensitivity: 1.0,
          feedback: true,
          color: '#00ff00',
          label: 'Cue 2',
        },
        {
          controlId: 'hot_cue_3',
          midiChannel: 1,
          midiCC: 56,
          controlType: 'pad',
          parameter: 'preset_3',
          valueRange: [0, 1],
          curve: 'linear',
          sensitivity: 1.0,
          feedback: true,
          color: '#0000ff',
          label: 'Cue 3',
        },
        {
          controlId: 'hot_cue_4',
          midiChannel: 1,
          midiCC: 57,
          controlType: 'pad',
          parameter: 'preset_4',
          valueRange: [0, 1],
          curve: 'linear',
          sensitivity: 1.0,
          feedback: true,
          color: '#ffff00',
          label: 'Cue 4',
        },
        // Effect knobs
        {
          controlId: 'effect_1_knob',
          midiChannel: 1,
          midiCC: 24,
          controlType: 'knob',
          parameter: 'effect_1_intensity',
          valueRange: [0, 1],
          curve: 'exponential',
          sensitivity: 1.0,
          feedback: true,
          label: 'FX 1',
        },
        {
          controlId: 'effect_2_knob',
          midiChannel: 1,
          midiCC: 25,
          controlType: 'knob',
          parameter: 'effect_2_intensity',
          valueRange: [0, 1],
          curve: 'exponential',
          sensitivity: 1.0,
          feedback: true,
          label: 'FX 2',
        },
      ],
    };
  }

  /**
   * Create Native Instruments Maschine configuration
   */
  private createNIMaschineConfig(name: string, manufacturer: string): MIDIControllerConfig {
    return {
      deviceName: name,
      manufacturer: manufacturer,
      model: 'Native Instruments Maschine',
      inputChannels: 16,
      outputChannels: 16,
      hasLightFeedback: true,
      supportsTouchSensitivity: true,
      supportsAftertouch: true,
      hasDisplays: true,
      customMappings: [
        // 16 velocity-sensitive pads
        ...Array.from({ length: 16 }, (_, i) => ({
          controlId: `pad_${i + 1}`,
          midiChannel: 1,
          midiCC: 36 + i,
          controlType: 'pad' as const,
          parameter: `preset_${i + 1}`,
          valueRange: [0, 1] as [number, number],
          curve: 'linear' as const,
          sensitivity: 1.0,
          feedback: true,
          color: `hsl(${i * 22.5}, 70%, 50%)`,
          label: `Pad ${i + 1}`,
        })),
        // 8 rotary encoders
        ...Array.from({ length: 8 }, (_, i) => ({
          controlId: `encoder_${i + 1}`,
          midiChannel: 1,
          midiCC: 16 + i,
          controlType: 'encoder' as const,
          parameter: `effect_${i + 1}_param`,
          valueRange: [0, 1] as [number, number],
          curve: 'linear' as const,
          sensitivity: 0.8,
          feedback: true,
          label: `Encoder ${i + 1}`,
        })),
        // Touch strip
        {
          controlId: 'touch_strip',
          midiChannel: 1,
          midiCC: 12,
          controlType: 'touch',
          parameter: 'effect_morph',
          valueRange: [0, 1],
          curve: 'linear',
          sensitivity: 1.2,
          feedback: true,
          label: 'Touch Strip',
        },
      ],
    };
  }

  /**
   * Create Ableton Push configuration
   */
  private createAbletonPushConfig(name: string, manufacturer: string): MIDIControllerConfig {
    return {
      deviceName: name,
      manufacturer: manufacturer,
      model: 'Ableton Push',
      inputChannels: 16,
      outputChannels: 16,
      hasLightFeedback: true,
      supportsTouchSensitivity: true,
      supportsAftertouch: true,
      hasDisplays: true,
      customMappings: [
        // 64 velocity-sensitive pads (8x8 grid)
        ...Array.from({ length: 64 }, (_, i) => ({
          controlId: `pad_${i + 1}`,
          midiChannel: 1,
          midiCC: 36 + i,
          controlType: 'pad' as const,
          parameter: `grid_${i + 1}`,
          valueRange: [0, 1] as [number, number],
          curve: 'linear' as const,
          sensitivity: 1.0,
          feedback: true,
          color: `hsl(${(i % 8) * 45}, 70%, 50%)`,
          label: `Pad ${i + 1}`,
        })),
        // 8 touch-sensitive encoders
        ...Array.from({ length: 8 }, (_, i) => ({
          controlId: `encoder_${i + 1}`,
          midiChannel: 1,
          midiCC: 71 + i,
          controlType: 'encoder' as const,
          parameter: `macro_${i + 1}`,
          valueRange: [0, 1] as [number, number],
          curve: 'linear' as const,
          sensitivity: 0.8,
          feedback: true,
          label: `Macro ${i + 1}`,
        })),
        // Master encoder
        {
          controlId: 'master_encoder',
          midiChannel: 1,
          midiCC: 79,
          controlType: 'encoder',
          parameter: 'master_intensity',
          valueRange: [0, 1],
          curve: 'linear',
          sensitivity: 1.0,
          feedback: true,
          label: 'Master',
        },
        // Tempo encoder
        {
          controlId: 'tempo_encoder',
          midiChannel: 1,
          midiCC: 80,
          controlType: 'encoder',
          parameter: 'tempo_adjust',
          valueRange: [-0.2, 0.2],
          curve: 'linear',
          sensitivity: 0.5,
          feedback: true,
          label: 'Tempo',
        },
      ],
    };
  }

  /**
   * Create Novation controller configuration
   */
  private createNovationConfig(name: string, manufacturer: string): MIDIControllerConfig {
    return {
      deviceName: name,
      manufacturer: manufacturer,
      model: 'Novation Launchpad',
      inputChannels: 16,
      outputChannels: 16,
      hasLightFeedback: true,
      supportsTouchSensitivity: false,
      supportsAftertouch: false,
      hasDisplays: false,
      customMappings: [
        // 64 RGB pads
        ...Array.from({ length: 64 }, (_, i) => ({
          controlId: `pad_${i + 1}`,
          midiChannel: 1,
          midiCC: 104 + i,
          controlType: 'pad' as const,
          parameter: `scene_${i + 1}`,
          valueRange: [0, 1] as [number, number],
          curve: 'linear' as const,
          sensitivity: 1.0,
          feedback: true,
          color: `hsl(${(i % 8) * 45}, 90%, 60%)`,
          label: `Scene ${i + 1}`,
        })),
        // 8 side buttons
        ...Array.from({ length: 8 }, (_, i) => ({
          controlId: `side_button_${i + 1}`,
          midiChannel: 1,
          midiCC: 89 + i,
          controlType: 'button' as const,
          parameter: `layer_${i + 1}_toggle`,
          valueRange: [0, 1] as [number, number],
          curve: 'linear' as const,
          sensitivity: 1.0,
          feedback: true,
          label: `Layer ${i + 1}`,
        })),
        // 8 top buttons
        ...Array.from({ length: 8 }, (_, i) => ({
          controlId: `top_button_${i + 1}`,
          midiChannel: 1,
          midiCC: 104 + i,
          controlType: 'button' as const,
          parameter: `effect_${i + 1}_toggle`,
          valueRange: [0, 1] as [number, number],
          curve: 'linear' as const,
          sensitivity: 1.0,
          feedback: true,
          label: `Effect ${i + 1}`,
        })),
      ],
    };
  }

  /**
   * Create Akai controller configuration
   */
  private createAkaiConfig(name: string, manufacturer: string): MIDIControllerConfig {
    return {
      deviceName: name,
      manufacturer: manufacturer,
      model: 'Akai APC',
      inputChannels: 16,
      outputChannels: 16,
      hasLightFeedback: true,
      supportsTouchSensitivity: false,
      supportsAftertouch: false,
      hasDisplays: false,
      customMappings: [
        // 40 clip launch pads
        ...Array.from({ length: 40 }, (_, i) => ({
          controlId: `clip_${i + 1}`,
          midiChannel: 1,
          midiCC: 53 + i,
          controlType: 'pad' as const,
          parameter: `clip_${i + 1}`,
          valueRange: [0, 1] as [number, number],
          curve: 'linear' as const,
          sensitivity: 1.0,
          feedback: true,
          color: `hsl(${(i % 8) * 45}, 80%, 50%)`,
          label: `Clip ${i + 1}`,
        })),
        // 8 track volume faders
        ...Array.from({ length: 8 }, (_, i) => ({
          controlId: `volume_${i + 1}`,
          midiChannel: 1,
          midiCC: 7 + i,
          controlType: 'fader' as const,
          parameter: `layer_${i + 1}_volume`,
          valueRange: [0, 1] as [number, number],
          curve: 'linear' as const,
          sensitivity: 1.0,
          feedback: true,
          label: `Volume ${i + 1}`,
        })),
        // Master fader
        {
          controlId: 'master_fader',
          midiChannel: 1,
          midiCC: 14,
          controlType: 'fader',
          parameter: 'master_volume',
          valueRange: [0, 1],
          curve: 'linear',
          sensitivity: 1.0,
          feedback: true,
          label: 'Master',
        },
      ],
    };
  }

  /**
   * Create generic MIDI controller configuration
   */
  private createGenericConfig(name: string, manufacturer: string): MIDIControllerConfig {
    return {
      deviceName: name,
      manufacturer: manufacturer,
      model: 'Generic MIDI Controller',
      inputChannels: 16,
      outputChannels: 16,
      hasLightFeedback: false,
      supportsTouchSensitivity: false,
      supportsAftertouch: false,
      hasDisplays: false,
      customMappings: [
        // 8 generic knobs
        ...Array.from({ length: 8 }, (_, i) => ({
          controlId: `knob_${i + 1}`,
          midiChannel: 1,
          midiCC: 16 + i,
          controlType: 'knob' as const,
          parameter: `param_${i + 1}`,
          valueRange: [0, 1] as [number, number],
          curve: 'linear' as const,
          sensitivity: 1.0,
          feedback: false,
          label: `Knob ${i + 1}`,
        })),
        // 8 generic faders
        ...Array.from({ length: 8 }, (_, i) => ({
          controlId: `fader_${i + 1}`,
          midiChannel: 1,
          midiCC: 24 + i,
          controlType: 'fader' as const,
          parameter: `level_${i + 1}`,
          valueRange: [0, 1] as [number, number],
          curve: 'linear' as const,
          sensitivity: 1.0,
          feedback: false,
          label: `Fader ${i + 1}`,
        })),
      ],
    };
  }

  /**
   * Handle MIDI message
   */
  private handleMIDIMessage(controllerId: string, event: MIDIMessageEvent): void {
    if (!event.data) return;
    
    const message = this.parseMIDIMessage(event.data);
    const controller = this.connectedControllers.get(controllerId);
    const state = this.controllerStates.get(controllerId);

    if (!controller || !state) return;

    // Find mapping for this message
    const mapping = controller.customMappings.find(
      m => m.midiChannel === message.channel && m.midiCC === message.data1
    );

    if (!mapping) return;

    // Process the message based on control type
    this.processControlMessage(controllerId, mapping, message, state);
  }

  /**
   * Parse MIDI message
   */
  private parseMIDIMessage(data: Uint8Array): MIDIMessage {
    const command = data[0] >> 4;
    const channel = data[0] & 0x0F;
    const data1 = data[1];
    const data2 = data[2];

    return {
      command,
      channel,
      data1,
      data2,
      timestamp: performance.now(),
    };
  }

  /**
   * Process control message
   */
  private processControlMessage(
    controllerId: string,
    mapping: MIDIControlMapping,
    message: MIDIMessage,
    state: ControllerState
  ): void {
    const rawValue = message.data2 / 127;
    const scaledValue = this.scaleValue(rawValue, mapping.valueRange, mapping.curve);

    // Update controller state
    this.updateControllerState(state, mapping, scaledValue, message);

    // Map to parameter
    if (this.onParameterChange) {
      this.onParameterChange(mapping.parameter, scaledValue);
    }

    // Handle specific control types
    switch (mapping.controlType) {
      case 'button':
      case 'pad':
        if (message.data2 > 0 && this.onButtonPress) {
          this.onButtonPress(mapping.controlId, rawValue);
        }
        if (mapping.controlType === 'pad' && this.onPadHit) {
          this.onPadHit(mapping.controlId, rawValue);
        }
        break;
    }

    // Send feedback if supported
    if (mapping.feedback) {
      this.sendFeedback(controllerId, mapping, scaledValue);
    }

    // Update last activity
    state.lastActivity = Date.now();
  }

  /**
   * Scale value based on curve
   */
  private scaleValue(value: number, range: [number, number], curve: string): number {
    const [min, max] = range;
    let scaledValue = value;

    // Apply curve
    switch (curve) {
      case 'exponential':
        scaledValue = Math.pow(value, 2);
        break;
      case 'logarithmic':
        scaledValue = Math.log(value * 9 + 1) / Math.log(10);
        break;
      case 'linear':
      default:
        scaledValue = value;
        break;
    }

    // Scale to range
    return min + scaledValue * (max - min);
  }

  /**
   * Update controller state
   */
  private updateControllerState(
    state: ControllerState,
    mapping: MIDIControlMapping,
    value: number,
    message: MIDIMessage
  ): void {
    switch (mapping.controlType) {
      case 'knob':
        state.knobs.set(mapping.controlId, value);
        break;
      case 'fader':
        state.faders.set(mapping.controlId, value);
        break;
      case 'button':
        state.buttons.set(mapping.controlId, message.data2 > 0);
        break;
      case 'pad':
        state.pads.set(mapping.controlId, {
          active: message.data2 > 0,
          velocity: value,
          pressure: message.pressure,
        });
        break;
      case 'encoder':
        state.encoders.set(mapping.controlId, value);
        break;
    }
  }

  /**
   * Send feedback to controller
   */
  private sendFeedback(controllerId: string, mapping: MIDIControlMapping, value: number): void {
    const output = this.feedbackOutputs.get(controllerId);
    if (!output) return;

    const controller = this.connectedControllers.get(controllerId);
    if (!controller || !controller.hasLightFeedback) return;

    // Convert value to MIDI range
    const midiValue = Math.round(value * 127);
    
    // Send CC message for feedback
    const message = [
      0xB0 | (mapping.midiChannel - 1), // CC message on channel
      mapping.midiCC,
      midiValue,
    ];

    output.send(message);
  }

  /**
   * Initialize controller with welcome sequence
   */
  private async initializeController(controllerId: string, config: MIDIControllerConfig): Promise<void> {
    const output = this.feedbackOutputs.get(controllerId);
    if (!output || !config.hasLightFeedback) return;

    // Send welcome light sequence
    for (let i = 0; i < config.customMappings.length; i++) {
      const mapping = config.customMappings[i];
      if (mapping.feedback) {
        setTimeout(() => {
          const message = [
            0xB0 | (mapping.midiChannel - 1),
            mapping.midiCC,
            64, // Mid-range value
          ];
          output.send(message);
        }, i * 50);
      }
    }

    // Clear lights after sequence
    setTimeout(() => {
      this.clearAllLights(controllerId);
    }, config.customMappings.length * 50 + 1000);
  }

  /**
   * Clear all lights on controller
   */
  private clearAllLights(controllerId: string): void {
    const output = this.feedbackOutputs.get(controllerId);
    const controller = this.connectedControllers.get(controllerId);
    
    if (!output || !controller) return;

    for (const mapping of controller.customMappings) {
      if (mapping.feedback) {
        const message = [
          0xB0 | (mapping.midiChannel - 1),
          mapping.midiCC,
          0, // Off
        ];
        output.send(message);
      }
    }
  }

  /**
   * Handle device state changes
   */
  private handleDeviceStateChange(event: MIDIConnectionEvent): void {
    const port = event.port;
    
    if (!port) return;
    
    if (port.state === 'connected') {
      if (port.type === 'input') {
        this.identifyController(port as MIDIInput);
      } else if (port.type === 'output') {
        this.setupOutputDevice(port as MIDIOutput);
      }
    } else if (port.state === 'disconnected') {
      this.handleControllerDisconnect(port.id);
    }
  }

  /**
   * Handle controller disconnect
   */
  private handleControllerDisconnect(controllerId: string): void {
    this.connectedControllers.delete(controllerId);
    this.controllerStates.delete(controllerId);
    this.feedbackOutputs.delete(controllerId);
    
    if (this.onControllerDisconnect) {
      this.onControllerDisconnect(controllerId);
    }
    
    console.log(`[ProfessionalMIDI] Controller disconnected: ${controllerId}`);
  }

  /**
   * Create initial controller state
   */
  private createInitialState(): ControllerState {
    return {
      knobs: new Map(),
      faders: new Map(),
      buttons: new Map(),
      pads: new Map(),
      encoders: new Map(),
      touchPads: new Map(),
      displays: new Map(),
      lastActivity: Date.now(),
    };
  }

  /**
   * Load controller presets
   */
  private loadControllerPresets(): void {
    // Load saved configurations from localStorage
    const savedPresets = localStorage.getItem('v1z3r-midi-presets');
    if (savedPresets) {
      try {
        const presets = JSON.parse(savedPresets);
        console.log('[ProfessionalMIDI] Loaded controller presets:', presets);
      } catch (error) {
        console.warn('[ProfessionalMIDI] Failed to load controller presets:', error);
      }
    }
  }

  /**
   * Save controller presets
   */
  saveControllerPresets(): void {
    const presets = Array.from(this.connectedControllers.values());
    localStorage.setItem('v1z3r-midi-presets', JSON.stringify(presets));
    console.log('[ProfessionalMIDI] Controller presets saved');
  }

  /**
   * Set parameter change handler
   */
  setParameterChangeHandler(handler: (parameter: string, value: number) => void): void {
    this.onParameterChange = handler;
  }

  /**
   * Set button press handler
   */
  setButtonPressHandler(handler: (button: string, velocity: number) => void): void {
    this.onButtonPress = handler;
  }

  /**
   * Set pad hit handler
   */
  setPadHitHandler(handler: (pad: string, velocity: number, pressure?: number) => void): void {
    this.onPadHit = handler;
  }

  /**
   * Set controller connection handlers
   */
  setControllerConnectionHandlers(
    onConnect: (controller: MIDIControllerConfig) => void,
    onDisconnect: (controllerId: string) => void
  ): void {
    this.onControllerConnect = onConnect;
    this.onControllerDisconnect = onDisconnect;
  }

  /**
   * Get connected controllers
   */
  getConnectedControllers(): MIDIControllerConfig[] {
    return Array.from(this.connectedControllers.values());
  }

  /**
   * Get controller state
   */
  getControllerState(controllerId: string): ControllerState | null {
    return this.controllerStates.get(controllerId) || null;
  }

  /**
   * Update visual parameters from controller state
   */
  updateVisualParameters(controllerId: string, baseParams: VisualParameters): VisualParameters {
    const state = this.controllerStates.get(controllerId);
    if (!state) return baseParams;

    const updatedParams = { ...baseParams };

    // Map common controls to visual parameters
    if (state.knobs.has('eq_high_1')) {
      updatedParams.brightness = state.knobs.get('eq_high_1')!;
    }
    if (state.knobs.has('eq_mid_1')) {
      updatedParams.intensity = state.knobs.get('eq_mid_1')!;
    }
    if (state.knobs.has('eq_low_1')) {
      updatedParams.colorTemperature = state.knobs.get('eq_low_1')!;
    }

    if (state.faders.has('channel_1_fader')) {
      updatedParams.particleDensity = state.faders.get('channel_1_fader')!;
    }
    if (state.faders.has('channel_2_fader')) {
      updatedParams.waveAmplitude = state.faders.get('channel_2_fader')!;
    }

    if (state.knobs.has('effect_1_knob')) {
      updatedParams.speed = state.knobs.get('effect_1_knob')! * 2;
    }
    if (state.knobs.has('effect_2_knob')) {
      updatedParams.complexity = state.knobs.get('effect_2_knob')!;
    }

    return updatedParams;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    // Close all MIDI connections
    if (this.midiAccess) {
      for (const input of this.midiAccess.inputs.values()) {
        input.close();
      }
      for (const output of this.midiAccess.outputs.values()) {
        output.close();
      }
    }

    // Clear all states
    this.connectedControllers.clear();
    this.controllerStates.clear();
    this.feedbackOutputs.clear();

    // Clear handlers
    this.onParameterChange = null;
    this.onButtonPress = null;
    this.onPadHit = null;
    this.onControllerConnect = null;
    this.onControllerDisconnect = null;

    this.isInitialized = false;
  }
}

/**
 * Factory function to create and initialize MIDI manager
 */
export async function createProfessionalMIDIManager(): Promise<ProfessionalMIDIManager> {
  const manager = new ProfessionalMIDIManager();
  await manager.initialize();
  return manager;
}