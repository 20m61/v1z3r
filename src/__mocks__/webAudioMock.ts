/**
 * Comprehensive Web Audio API mock for testing
 * Provides complete AudioContext and related APIs mock implementation
 */

export interface MockAnalyserNode {
  fftSize: number;
  frequencyBinCount: number;
  smoothingTimeConstant: number;
  minDecibels: number;
  maxDecibels: number;
  getByteFrequencyData: jest.Mock;
  getFloatFrequencyData: jest.Mock;
  getByteTimeDomainData: jest.Mock;
  getFloatTimeDomainData: jest.Mock;
  connect: jest.Mock;
  disconnect: jest.Mock;
}

export interface MockGainNode {
  gain: {
    value: number;
    setValueAtTime: jest.Mock;
    linearRampToValueAtTime: jest.Mock;
    exponentialRampToValueAtTime: jest.Mock;
  };
  connect: jest.Mock;
  disconnect: jest.Mock;
}

export interface MockAudioContext {
  state: 'suspended' | 'running' | 'closed';
  sampleRate: number;
  currentTime: number;
  destination: any;
  createAnalyser: jest.Mock<MockAnalyserNode>;
  createGain: jest.Mock<MockGainNode>;
  createMediaStreamSource: jest.Mock;
  createMediaElementSource: jest.Mock;
  createOscillator: jest.Mock;
  createBuffer: jest.Mock;
  createBufferSource: jest.Mock;
  decodeAudioData: jest.Mock;
  resume: jest.Mock;
  suspend: jest.Mock;
  close: jest.Mock;
}

export const createAnalyserNodeMock = (): MockAnalyserNode => ({
  fftSize: 2048,
  frequencyBinCount: 1024,
  smoothingTimeConstant: 0.8,
  minDecibels: -100,
  maxDecibels: -30,
  getByteFrequencyData: jest.fn((array: Uint8Array) => {
    // Simulate frequency data
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 128 + 64);
    }
  }),
  getFloatFrequencyData: jest.fn((array: Float32Array) => {
    // Simulate frequency data
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.random() * -60 - 30;
    }
  }),
  getByteTimeDomainData: jest.fn((array: Uint8Array) => {
    // Simulate waveform data
    for (let i = 0; i < array.length; i++) {
      array[i] = 128 + Math.floor(Math.sin(i / 10) * 64);
    }
  }),
  getFloatTimeDomainData: jest.fn((array: Float32Array) => {
    // Simulate waveform data
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.sin(i / 10) * 0.5;
    }
  }),
  connect: jest.fn().mockReturnThis(),
  disconnect: jest.fn().mockReturnThis()
});

export const createGainNodeMock = (): MockGainNode => ({
  gain: {
    value: 1,
    setValueAtTime: jest.fn(),
    linearRampToValueAtTime: jest.fn(),
    exponentialRampToValueAtTime: jest.fn()
  },
  connect: jest.fn().mockReturnThis(),
  disconnect: jest.fn().mockReturnThis()
});

export const createAudioContextMock = (): MockAudioContext => {
  const mockContext: MockAudioContext = {
    state: 'running',
    sampleRate: 44100,
    currentTime: 0,
    destination: {
      maxChannelCount: 2,
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 2,
      channelCountMode: 'max',
      channelInterpretation: 'speakers'
    },
    createAnalyser: jest.fn(() => createAnalyserNodeMock()),
    createGain: jest.fn(() => createGainNodeMock()),
    createMediaStreamSource: jest.fn(() => ({
      connect: jest.fn().mockReturnThis(),
      disconnect: jest.fn().mockReturnThis()
    })),
    createMediaElementSource: jest.fn(() => ({
      connect: jest.fn().mockReturnThis(),
      disconnect: jest.fn().mockReturnThis()
    })),
    createOscillator: jest.fn(() => ({
      frequency: { value: 440 },
      type: 'sine',
      connect: jest.fn().mockReturnThis(),
      disconnect: jest.fn().mockReturnThis(),
      start: jest.fn(),
      stop: jest.fn()
    })),
    createBuffer: jest.fn((numberOfChannels, length, sampleRate) => ({
      numberOfChannels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: jest.fn(() => new Float32Array(length))
    })),
    createBufferSource: jest.fn(() => ({
      buffer: null,
      playbackRate: { value: 1 },
      loop: false,
      connect: jest.fn().mockReturnThis(),
      disconnect: jest.fn().mockReturnThis(),
      start: jest.fn(),
      stop: jest.fn()
    })),
    decodeAudioData: jest.fn().mockResolvedValue({
      numberOfChannels: 2,
      length: 44100,
      sampleRate: 44100,
      duration: 1,
      getChannelData: jest.fn(() => new Float32Array(44100))
    }),
    resume: jest.fn().mockResolvedValue(undefined),
    suspend: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined)
  };
  
  return mockContext;
};

// MediaDevices mock for getUserMedia
export const createMediaDevicesMock = () => ({
  getUserMedia: jest.fn().mockResolvedValue({
    getTracks: jest.fn(() => [
      {
        kind: 'audio',
        enabled: true,
        stop: jest.fn()
      }
    ]),
    getAudioTracks: jest.fn(() => [
      {
        kind: 'audio',
        enabled: true,
        stop: jest.fn()
      }
    ])
  }),
  enumerateDevices: jest.fn().mockResolvedValue([
    { kind: 'audioinput', deviceId: 'default', label: 'Default Audio Input' },
    { kind: 'audiooutput', deviceId: 'default', label: 'Default Audio Output' }
  ])
});

// Setup global AudioContext mock
export const setupWebAudioMocks = () => {
  // @ts-ignore
  global.AudioContext = jest.fn(() => createAudioContextMock());
  // @ts-ignore
  global.webkitAudioContext = global.AudioContext;
  // @ts-ignore
  global.AnalyserNode = jest.fn(() => createAnalyserNodeMock());
  // @ts-ignore
  global.GainNode = jest.fn(() => createGainNodeMock());
  
  // Mock navigator.mediaDevices
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: createMediaDevicesMock(),
    writable: true
  });
};

// Cleanup function
export const cleanupWebAudioMocks = () => {
  // @ts-ignore
  delete global.AudioContext;
  // @ts-ignore
  delete global.webkitAudioContext;
  // @ts-ignore
  delete global.AnalyserNode;
  // @ts-ignore
  delete global.GainNode;
};