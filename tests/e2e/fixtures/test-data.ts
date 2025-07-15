/**
 * Test data fixtures for E2E tests
 * Provides reusable test data for various scenarios
 */

export const testPresets = {
  basic: {
    name: 'Basic Spectrum',
    effectType: 'spectrum',
    colorTheme: '#00ccff',
    sensitivity: 1.0,
  },
  advanced: {
    name: 'Particle Storm',
    effectType: 'particles',
    colorTheme: '#ff00cc',
    sensitivity: 1.5,
    layers: [
      {
        type: 'particles',
        opacity: 0.8,
        colorTheme: '#ff00cc',
      },
      {
        type: 'waveform',
        opacity: 0.5,
        colorTheme: '#00ccff',
      },
    ],
  },
};

export const testSessions = {
  solo: {
    name: 'Solo Practice Session',
    isPublic: false,
    maxParticipants: 1,
  },
  collaborative: {
    name: 'Collaborative VJ Session',
    isPublic: true,
    maxParticipants: 4,
    password: 'vjparty123',
  },
};

export const testAudioSources = {
  microphone: {
    type: 'microphone',
    deviceId: 'default',
  },
  file: {
    type: 'file',
    url: '/test-assets/sample-audio.mp3',
  },
  stream: {
    type: 'stream',
    url: 'https://stream.example.com/audio',
  },
};

export const testMidiMappings = {
  knob1: {
    type: 'cc',
    midiChannel: 1,
    midiNumber: 1,
    targetParameter: 'sensitivity',
    minValue: 0,
    maxValue: 2,
    curve: 'linear',
  },
  pad1: {
    type: 'note',
    midiChannel: 1,
    midiNumber: 36,
    targetParameter: 'effectType',
    minValue: 0,
    maxValue: 1,
    curve: 'linear',
  },
};

export const testLyrics = {
  simple: [
    { text: 'Hello world', timestamp: 0 },
    { text: 'This is a test', timestamp: 2000 },
    { text: 'VJ performance', timestamp: 4000 },
  ],
  withConfidence: [
    { text: 'Testing lyrics', timestamp: 0, confidence: 0.95 },
    { text: 'High confidence', timestamp: 2000, confidence: 0.98 },
    { text: 'Low confidence', timestamp: 4000, confidence: 0.65 },
  ],
};

export const testPerformanceScenarios = {
  lightLoad: {
    effectCount: 1,
    layerCount: 1,
    particleCount: 100,
    duration: 30000, // 30 seconds
  },
  mediumLoad: {
    effectCount: 3,
    layerCount: 3,
    particleCount: 1000,
    duration: 60000, // 1 minute
  },
  heavyLoad: {
    effectCount: 5,
    layerCount: 5,
    particleCount: 10000,
    duration: 180000, // 3 minutes
  },
};

export const timeouts = {
  short: 1000,
  medium: 5000,
  long: 10000,
  veryLong: 30000,
};

export const testUrls = {
  home: '/',
  login: '/auth/login',
  register: '/auth/register',
  dashboard: '/dashboard',
  visualizer: '/visualizer',
  settings: '/settings',
  presets: '/presets',
};