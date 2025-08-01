/**
 * Comprehensive MIDI API mock for testing
 * Provides complete Web MIDI API mock implementation
 */

export interface MockMIDIInput {
  id: string;
  name: string;
  manufacturer: string;
  version: string;
  type: 'input';
  state: 'connected' | 'disconnected';
  connection: 'open' | 'closed' | 'pending';
  onmidimessage: ((event: any) => void) | null;
  onstatechange: ((event: any) => void) | null;
  open: jest.Mock;
  close: jest.Mock;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
  dispatchEvent: jest.Mock;
}

export interface MockMIDIOutput {
  id: string;
  name: string;
  manufacturer: string;
  version: string;
  type: 'output';
  state: 'connected' | 'disconnected';
  connection: 'open' | 'closed' | 'pending';
  send: jest.Mock;
  clear: jest.Mock;
  open: jest.Mock;
  close: jest.Mock;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
  dispatchEvent: jest.Mock;
}

export interface MockMIDIAccess {
  inputs: Map<string, MockMIDIInput>;
  outputs: Map<string, MockMIDIOutput>;
  sysexEnabled: boolean;
  onstatechange: ((event: any) => void) | null;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
  dispatchEvent: jest.Mock;
}

// Create mock MIDI input device
export const createMIDIInputMock = (id: string = 'input-1', name: string = 'Mock MIDI Input'): MockMIDIInput => {
  const listeners = new Map<string, Set<Function>>();
  
  const input: MockMIDIInput = {
    id,
    name,
    manufacturer: 'Mock Manufacturer',
    version: '1.0.0',
    type: 'input',
    state: 'connected',
    connection: 'closed',
    onmidimessage: null,
    onstatechange: null,
    open: jest.fn().mockImplementation(() => {
      input.connection = 'open';
      return Promise.resolve(input);
    }),
    close: jest.fn().mockImplementation(() => {
      input.connection = 'closed';
      return Promise.resolve(input);
    }),
    addEventListener: jest.fn((type: string, listener: Function) => {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }
      listeners.get(type)!.add(listener);
    }),
    removeEventListener: jest.fn((type: string, listener: Function) => {
      if (listeners.has(type)) {
        listeners.get(type)!.delete(listener);
      }
    }),
    dispatchEvent: jest.fn((event: any) => {
      if (event.type === 'midimessage' && input.onmidimessage) {
        input.onmidimessage(event);
      }
      if (event.type === 'statechange' && input.onstatechange) {
        input.onstatechange(event);
      }
      
      const typeListeners = listeners.get(event.type);
      if (typeListeners) {
        typeListeners.forEach(listener => listener(event));
      }
      return true;
    })
  };
  
  return input;
};

// Create mock MIDI output device
export const createMIDIOutputMock = (id: string = 'output-1', name: string = 'Mock MIDI Output'): MockMIDIOutput => {
  const output: MockMIDIOutput = {
    id,
    name,
    manufacturer: 'Mock Manufacturer',
    version: '1.0.0',
    type: 'output',
    state: 'connected',
    connection: 'closed',
    send: jest.fn((data: Uint8Array | number[], timestamp?: number) => {
      // Simulate MIDI message sending
      console.log('Mock MIDI send:', data, timestamp);
    }),
    clear: jest.fn(),
    open: jest.fn().mockImplementation(() => {
      output.connection = 'open';
      return Promise.resolve(output);
    }),
    close: jest.fn().mockImplementation(() => {
      output.connection = 'closed';
      return Promise.resolve(output);
    }),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn().mockReturnValue(true)
  };
  
  return output;
};

// Create mock MIDI access
export const createMIDIAccessMock = (): MockMIDIAccess => {
  const inputs = new Map<string, MockMIDIInput>();
  const outputs = new Map<string, MockMIDIOutput>();
  
  // Add default devices
  inputs.set('input-1', createMIDIInputMock('input-1', 'Mock MIDI Controller'));
  outputs.set('output-1', createMIDIOutputMock('output-1', 'Mock MIDI Synthesizer'));
  
  return {
    inputs,
    outputs,
    sysexEnabled: false,
    onstatechange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn().mockReturnValue(true)
  };
};

// MIDI message utilities
export const createMIDIMessageEvent = (data: number[], timestamp: number = performance.now()) => ({
  type: 'midimessage',
  data: new Uint8Array(data),
  timestamp,
  target: null,
  currentTarget: null,
  bubbles: false,
  cancelable: false,
  defaultPrevented: false,
  preventDefault: jest.fn(),
  stopPropagation: jest.fn(),
  stopImmediatePropagation: jest.fn()
});

// Common MIDI messages
export const MIDI_MESSAGES = {
  // Note On: channel 1, note 60 (Middle C), velocity 127
  noteOn: (note: number = 60, velocity: number = 127, channel: number = 0) => 
    [0x90 | channel, note, velocity],
  
  // Note Off: channel 1, note 60, velocity 0
  noteOff: (note: number = 60, velocity: number = 0, channel: number = 0) => 
    [0x80 | channel, note, velocity],
  
  // Control Change: channel 1, controller, value
  controlChange: (controller: number, value: number, channel: number = 0) => 
    [0xB0 | channel, controller, value],
  
  // Program Change: channel 1, program
  programChange: (program: number, channel: number = 0) => 
    [0xC0 | channel, program],
  
  // Pitch Bend: channel 1, LSB, MSB
  pitchBend: (value: number, channel: number = 0) => {
    const bent = value + 8192; // Center at 8192
    return [0xE0 | channel, bent & 0x7F, (bent >> 7) & 0x7F];
  }
};

// MIDI Manager mock
export const createMIDIManagerMock = () => ({
  initialize: jest.fn().mockResolvedValue(true),
  requestAccess: jest.fn().mockResolvedValue(createMIDIAccessMock()),
  getInputs: jest.fn().mockReturnValue([createMIDIInputMock()]),
  getOutputs: jest.fn().mockReturnValue([createMIDIOutputMock()]),
  setParameterChangeHandler: jest.fn(),
  sendControlChange: jest.fn(),
  sendNoteOn: jest.fn(),
  sendNoteOff: jest.fn(),
  dispose: jest.fn()
});

// Setup global MIDI mocks
export const setupMIDIMocks = () => {
  // @ts-ignore
  global.navigator.requestMIDIAccess = jest.fn().mockResolvedValue(createMIDIAccessMock());
};

// Cleanup function
export const cleanupMIDIMocks = () => {
  // @ts-ignore
  delete global.navigator.requestMIDIAccess;
};

// Simulate MIDI input
export const simulateMIDIInput = (input: MockMIDIInput, message: number[], delay: number = 0) => {
  setTimeout(() => {
    const event = createMIDIMessageEvent(message);
    input.dispatchEvent(event);
  }, delay);
};