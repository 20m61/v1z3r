/**
 * Central mock setup for all tests
 * Import this in test files or jest setup to enable comprehensive mocking
 */

import { setupWebAudioMocks, cleanupWebAudioMocks } from './webAudioMock';
import { setupWebGPUMocks, cleanupWebGPUMocks } from './webGPUMock';
import { setupMIDIMocks, cleanupMIDIMocks } from './midiMock';
import { setupDOMMocks, cleanupDOMMocks } from './domMock';

// Combined setup function
export const setupAllMocks = () => {
  setupDOMMocks();
  setupWebAudioMocks();
  setupWebGPUMocks();
  setupMIDIMocks();
};

// Combined cleanup function
export const cleanupAllMocks = () => {
  cleanupDOMMocks();
  cleanupWebAudioMocks();
  cleanupWebGPUMocks();
  cleanupMIDIMocks();
};

// Jest lifecycle hooks for automatic setup/cleanup
export const setupMocksForJest = () => {
  beforeAll(() => {
    setupAllMocks();
  });
  
  afterAll(() => {
    cleanupAllMocks();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
};

// Individual mock exports for selective usage
export * from './webAudioMock';
export * from './webGPUMock';
export * from './midiMock';
export * from './domMock';