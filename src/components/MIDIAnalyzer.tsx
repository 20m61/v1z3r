import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useVisualizerStore } from '@/store/visualizerStore';
import Button from './ui/Button';
import { globalRateLimiters } from '@/utils/rateLimiter';

// MIDI message types
export const MIDI_MESSAGE_TYPES = {
  NOTE_OFF: 0x80,
  NOTE_ON: 0x90,
  CONTROL_CHANGE: 0xB0,
  PROGRAM_CHANGE: 0xC0,
  CHANNEL_PRESSURE: 0xD0,
  PITCH_BEND: 0xE0,
} as const;

export interface MIDIMessage {
  type: number;
  channel: number;
  data1: number;
  data2: number;
  timestamp: number;
}

export interface MIDIControllerMapping {
  id: string;
  name: string;
  type: 'note' | 'cc' | 'pitch_bend';
  midiChannel: number;
  midiNumber: number;
  targetParameter: string;
  minValue: number;
  maxValue: number;
  curve: 'linear' | 'exponential' | 'logarithmic';
}

interface MIDIAnalyzerProps {
  onMIDIMessage?: (message: MIDIMessage) => void;
  onMIDIDeviceChange?: (devices: WebMidi.MIDIInput[]) => void;
}

const MIDIAnalyzer: React.FC<MIDIAnalyzerProps> = ({ 
  onMIDIMessage, 
  onMIDIDeviceChange 
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<WebMidi.MIDIInput[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  
  const midiAccessRef = useRef<WebMidi.MIDIAccess | null>(null);
  const connectedInputsRef = useRef<Map<string, WebMidi.MIDIInput>>(new Map());
  
  const { isMIDIEnabled, setMIDIEnabled } = useVisualizerStore();

  // Parse MIDI message
  const parseMIDIMessage = useCallback((data: Uint8Array, timestamp: number): MIDIMessage | null => {
    if (data.length < 2) return null;

    const status = data[0];
    const messageType = status & 0xF0;
    const channel = status & 0x0F;
    
    return {
      type: messageType,
      channel,
      data1: data[1] || 0,
      data2: data[2] || 0,
      timestamp,
    };
  }, []);

  // Handle MIDI message
  const handleMIDIMessage = useCallback((event: WebMidi.MIDIMessageEvent) => {
    try {
      const clientId = 'midi-analyzer';
      
      // Rate limit MIDI messages
      if (!globalRateLimiters.audioData.isAllowed(clientId)) {
        return;
      }

      const message = parseMIDIMessage(event.data, event.timeStamp);
      if (!message) return;

      // Log MIDI message for debugging
      console.debug('MIDI Message:', {
        type: message.type.toString(16),
        channel: message.channel,
        data1: message.data1,
        data2: message.data2,
      });

      if (onMIDIMessage) {
        onMIDIMessage(message);
      }

      globalRateLimiters.audioData.recordSuccess(clientId);
    } catch (err) {
      console.error('MIDI message processing error:', err);
      globalRateLimiters.audioData.recordFailure('midi-analyzer');
    }
  }, [onMIDIMessage, parseMIDIMessage]);

  // Update available devices
  const updateDevices = useCallback((midiAccess: WebMidi.MIDIAccess) => {
    const inputs = Array.from(midiAccess.inputs.values());
    setAvailableDevices(inputs);
    
    if (onMIDIDeviceChange) {
      onMIDIDeviceChange(inputs);
    }

    // Auto-select first device if none selected
    if (!selectedDeviceId && inputs.length > 0) {
      setSelectedDeviceId(inputs[0].id);
    }
  }, [onMIDIDeviceChange, selectedDeviceId]);

  // Connect to MIDI device
  const connectToDevice = useCallback((deviceId: string) => {
    if (!midiAccessRef.current) return;

    const input = midiAccessRef.current.inputs.get(deviceId);
    if (!input) return;

    // Disconnect previous device
    connectedInputsRef.current.forEach(connectedInput => {
      connectedInput.onmidimessage = null;
    });
    connectedInputsRef.current.clear();

    // Connect to new device
    input.onmidimessage = handleMIDIMessage;
    connectedInputsRef.current.set(deviceId, input);
    
    setSelectedDeviceId(deviceId);
    console.log('Connected to MIDI device:', input.name);
  }, [handleMIDIMessage]);

  // Start MIDI connection
  const startMIDI = useCallback(async () => {
    try {
      // Check Web MIDI API support
      if (!navigator.requestMIDIAccess) {
        setError('Web MIDI APIはこのブラウザでサポートされていません');
        return;
      }

      // Request MIDI access
      const midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      midiAccessRef.current = midiAccess;

      // Set up device change listeners
      midiAccess.onstatechange = () => {
        updateDevices(midiAccess);
      };

      // Initial device scan
      updateDevices(midiAccess);

      setIsConnected(true);
      setMIDIEnabled(true);
      setError(null);

      console.log('MIDI access granted');
    } catch (err) {
      const errorMessage = 'MIDI接続中にエラーが発生しました';
      
      // Log error using error handler
      const { errorHandler } = await import('@/utils/errorHandler');
      errorHandler.audioError(
        errorMessage, 
        err instanceof Error ? err : new Error(String(err)),
        {
          isConnected,
          timestamp: new Date().toISOString()
        }
      );

      setError('MIDIデバイスへのアクセスが拒否されたか、エラーが発生しました。');
      setIsConnected(false);
      setMIDIEnabled(false);
    }
  }, [isConnected, setMIDIEnabled, updateDevices]);

  // Stop MIDI connection
  const stopMIDI = useCallback(() => {
    // Disconnect all inputs
    connectedInputsRef.current.forEach(input => {
      input.onmidimessage = null;
    });
    connectedInputsRef.current.clear();

    // Clean up MIDI access
    if (midiAccessRef.current) {
      midiAccessRef.current.onstatechange = null;
      midiAccessRef.current = null;
    }

    setIsConnected(false);
    setMIDIEnabled(false);
    setAvailableDevices([]);
    setSelectedDeviceId(null);
  }, [setMIDIEnabled]);

  // Auto-connect when device is selected
  useEffect(() => {
    if (selectedDeviceId && isConnected) {
      connectToDevice(selectedDeviceId);
    }
  }, [selectedDeviceId, isConnected, connectToDevice]);

  // Handle MIDI enabled state changes
  useEffect(() => {
    if (isMIDIEnabled && !isConnected) {
      startMIDI();
    } else if (!isMIDIEnabled && isConnected) {
      stopMIDI();
    }

    // Cleanup on unmount
    return () => {
      stopMIDI();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Intentionally omitting startMIDI and stopMIDI from dependencies to prevent infinite loops
  }, [isMIDIEnabled, isConnected]);

  // Render error state
  if (error) {
    return (
      <div className="p-4 bg-red-500 bg-opacity-20 text-red-200 rounded mb-4" data-testid="midi-error">
        <p className="font-medium">MIDI エラー:</p>
        <p>{error}</p>
        <Button 
          onClick={() => { setError(null); startMIDI(); }}
          className="mt-2"
          variant="outline"
          size="sm"
        >
          再試行
        </Button>
      </div>
    );
  }

  // Render device selection UI
  if (isConnected && availableDevices.length > 0) {
    return (
      <div className="p-4 bg-blue-500 bg-opacity-20 text-blue-200 rounded mb-4" data-testid="midi-devices">
        <p className="font-medium mb-2">MIDI デバイス:</p>
        <select
          value={selectedDeviceId || ''}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
          className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
        >
          <option value="">デバイスを選択...</option>
          {availableDevices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name || `Device ${device.id}`}
            </option>
          ))}
        </select>
        {selectedDeviceId && (
          <p className="text-sm mt-2 text-green-400">
            ✓ 接続済み: {availableDevices.find(d => d.id === selectedDeviceId)?.name}
          </p>
        )}
      </div>
    );
  }

  // No UI when running in background
  return null;
};

export default MIDIAnalyzer;