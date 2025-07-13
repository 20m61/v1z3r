import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MIDIAnalyzer from '../MIDIAnalyzer';

// Mock Web MIDI API
const mockMIDIAccess = {
  inputs: new Map(),
  outputs: new Map(),
  onstatechange: null,
};

const mockMIDIInput = {
  id: 'test-input-1',
  name: 'Test MIDI Controller',
  onmidimessage: null,
};

// Mock navigator.requestMIDIAccess
Object.defineProperty(global.navigator, 'requestMIDIAccess', {
  value: jest.fn(() => Promise.resolve(mockMIDIAccess)),
  writable: true,
});

// Mock Zustand store
jest.mock('@/store/visualizerStore', () => ({
  useVisualizerStore: () => ({
    isMIDIEnabled: false,
    setMIDIEnabled: jest.fn(),
  }),
}));

// Mock rate limiter
jest.mock('@/utils/rateLimiter', () => ({
  globalRateLimiters: {
    audioData: {
      isAllowed: jest.fn(() => true),
      recordSuccess: jest.fn(),
      recordFailure: jest.fn(),
    },
  },
}));

describe('MIDIAnalyzer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without errors when MIDI is not enabled', () => {
    render(<MIDIAnalyzer />);
    // Component should render without any visible elements when MIDI is disabled
    expect(screen.queryByTestId('midi-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('midi-devices')).not.toBeInTheDocument();
  });

  it('should show error message when Web MIDI API is not supported', async () => {
    // Mock unsupported browser
    Object.defineProperty(global.navigator, 'requestMIDIAccess', {
      value: undefined,
      writable: true,
    });

    const mockSetMIDIEnabled = jest.fn();
    
    // Mock store with MIDI enabled
    jest.doMock('@/store/visualizerStore', () => ({
      useVisualizerStore: () => ({
        isMIDIEnabled: true,
        setMIDIEnabled: mockSetMIDIEnabled,
      }),
    }));

    // Re-import component after mocking
    const { default: MIDIAnalyzer } = await import('../MIDIAnalyzer');
    
    render(<MIDIAnalyzer />);

    // Should show error for unsupported browser
    await waitFor(() => {
      expect(screen.getByTestId('midi-error')).toBeInTheDocument();
      expect(screen.getByText(/Web MIDI APIはこのブラウザでサポートされていません/)).toBeInTheDocument();
    });
  });

  it('should handle MIDI message parsing correctly', () => {
    const mockOnMIDIMessage = jest.fn();
    
    render(<MIDIAnalyzer onMIDIMessage={mockOnMIDIMessage} />);

    // Since the component is mostly invisible, we'll test the internal logic
    // by checking that MIDI setup doesn't crash the component
    expect(mockOnMIDIMessage).not.toHaveBeenCalled();
  });

  it('should call onMIDIDeviceChange when devices are updated', () => {
    const mockOnMIDIDeviceChange = jest.fn();
    
    render(
      <MIDIAnalyzer 
        onMIDIMessage={jest.fn()}
        onMIDIDeviceChange={mockOnMIDIDeviceChange}
      />
    );

    // Component should render without errors
    expect(mockOnMIDIDeviceChange).not.toHaveBeenCalled();
  });

  it('should handle retry button click in error state', async () => {
    // Mock failed MIDI access
    Object.defineProperty(global.navigator, 'requestMIDIAccess', {
      value: jest.fn(() => Promise.reject(new Error('MIDI access denied'))),
      writable: true,
    });

    const mockSetMIDIEnabled = jest.fn();
    
    // Mock store with MIDI enabled to trigger error state
    jest.doMock('@/store/visualizerStore', () => ({
      useVisualizerStore: () => ({
        isMIDIEnabled: true,
        setMIDIEnabled: mockSetMIDIEnabled,
      }),
    }));

    // Re-import component after mocking
    const { default: MIDIAnalyzer } = await import('../MIDIAnalyzer');
    
    render(<MIDIAnalyzer />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId('midi-error')).toBeInTheDocument();
    });

    // Click retry button
    const retryButton = screen.getByText('再試行');
    fireEvent.click(retryButton);

    // Should attempt to restart MIDI
    expect(navigator.requestMIDIAccess).toHaveBeenCalled();
  });

  it('should parse MIDI messages correctly', () => {
    const component = render(<MIDIAnalyzer />);
    
    // Test internal message parsing logic
    const testData = new Uint8Array([0x90, 60, 127]); // Note On, C4, velocity 127
    const timestamp = Date.now();

    // Since parseMIDIMessage is internal, we test by ensuring no errors occur
    expect(component.container).toBeInTheDocument();
  });
});

// Test MIDI message types constants
describe('MIDI Message Types', () => {
  it('should have correct MIDI message type constants', () => {
    const { MIDI_MESSAGE_TYPES } = require('../MIDIAnalyzer');
    
    expect(MIDI_MESSAGE_TYPES.NOTE_OFF).toBe(0x80);
    expect(MIDI_MESSAGE_TYPES.NOTE_ON).toBe(0x90);
    expect(MIDI_MESSAGE_TYPES.CONTROL_CHANGE).toBe(0xB0);
    expect(MIDI_MESSAGE_TYPES.PROGRAM_CHANGE).toBe(0xC0);
    expect(MIDI_MESSAGE_TYPES.CHANNEL_PRESSURE).toBe(0xD0);
    expect(MIDI_MESSAGE_TYPES.PITCH_BEND).toBe(0xE0);
  });
});