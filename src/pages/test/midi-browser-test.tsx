/**
 * MIDI Controller Browser Test Page
 * Real browser testing for Web MIDI API functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { midiController } from '@/services/midi/midiController';
import type { MidiDevice, MidiMessage } from '@/services/midi/midiController';

const MidiBrowserTest: React.FC = () => {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [messages, setMessages] = useState<MidiMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{
    apiSupport: boolean | null;
    initialization: boolean | null;
    deviceDetection: boolean | null;
    messageReceiving: boolean | null;
    messageSending: boolean | null;
  }>({
    apiSupport: null,
    initialization: null,
    deviceDetection: null,
    messageReceiving: null,
    messageSending: null,
  });

  useEffect(() => {
    checkMidiSupport();
  }, []);

  const checkMidiSupport = () => {
    const supported = 'requestMIDIAccess' in navigator;
    setIsSupported(supported);
    setTestResults(prev => ({ ...prev, apiSupport: supported }));
  };

  const initializeMidi = async () => {
    try {
      setError(null);
      await midiController.initialize();
      setIsInitialized(true);
      setTestResults(prev => ({ ...prev, initialization: true }));
      
      // Set up callbacks
      midiController.setCallbacks({
        onDeviceConnect: handleDeviceConnect,
        onDeviceDisconnect: handleDeviceDisconnect,
        onMidiMessage: handleMidiMessage,
      });
      
      // Get initial devices
      const initialDevices = midiController.getDevices();
      setDevices(initialDevices);
      setTestResults(prev => ({ 
        ...prev, 
        deviceDetection: initialDevices.length > 0 
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setTestResults(prev => ({ ...prev, initialization: false }));
    }
  };

  const handleDeviceConnect = useCallback((device: MidiDevice) => {
    setDevices(prev => [...prev, device]);
    setTestResults(prev => ({ ...prev, deviceDetection: true }));
  }, []);

  const handleDeviceDisconnect = useCallback((device: MidiDevice) => {
    setDevices(prev => prev.filter(d => d.id !== device.id));
  }, []);

  const handleMidiMessage = useCallback((message: MidiMessage) => {
    setMessages(prev => [...prev.slice(-9), message]);
    setTestResults(prev => ({ ...prev, messageReceiving: true }));
  }, []);

  const testSendMessage = async () => {
    const outputDevice = devices.find(d => d.type === 'output');
    if (outputDevice) {
      try {
        // Send a middle C note
        midiController.sendMessage(outputDevice.id, {
          type: 'note',
          channel: 1,
          note: 60,
          velocity: 127,
        });
        
        // Turn off after 500ms
        setTimeout(() => {
          midiController.sendMessage(outputDevice.id, {
            type: 'note',
            channel: 1,
            note: 60,
            velocity: 0,
          });
        }, 500);
        
        setTestResults(prev => ({ ...prev, messageSending: true }));
      } catch (err) {
        setTestResults(prev => ({ ...prev, messageSending: false }));
      }
    }
  };

  const getStatusIcon = (status: boolean | null) => {
    if (status === null) return '⚪';
    return status ? '✅' : '❌';
  };

  const getHealthStatus = () => {
    if (!isInitialized) return 'Not initialized';
    return midiController.getHealthStatus();
  };

  return (
    <>
      <Head>
        <title>MIDI Browser Test - v1z3r</title>
        <meta name="description" content="Test Web MIDI API functionality in your browser" />
      </Head>

      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">MIDI Controller Browser Test</h1>

          {/* Test Results Summary */}
          <div className="bg-gray-900 rounded-lg p-6 mb-8 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Test Results</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Web MIDI API Support</span>
                <span>{getStatusIcon(testResults.apiSupport)} {testResults.apiSupport ? 'Supported' : 'Not Supported'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>MIDI Initialization</span>
                <span>{getStatusIcon(testResults.initialization)} {testResults.initialization ? 'Success' : testResults.initialization === false ? 'Failed' : 'Not tested'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Device Detection</span>
                <span>{getStatusIcon(testResults.deviceDetection)} {devices.length} device(s) found</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Message Receiving</span>
                <span>{getStatusIcon(testResults.messageReceiving)} {messages.length} message(s) received</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Message Sending</span>
                <span>{getStatusIcon(testResults.messageSending)} {testResults.messageSending ? 'Working' : testResults.messageSending === false ? 'Failed' : 'Not tested'}</span>
              </div>
            </div>
          </div>

          {/* Health Status */}
          <div className="bg-gray-900 rounded-lg p-6 mb-8 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Feature Health</h2>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${
                getHealthStatus() === 'healthy' ? 'bg-green-400' :
                getHealthStatus() === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
              }`}></span>
              <span>{getHealthStatus()}</span>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-8">
              <h3 className="text-red-400 font-semibold mb-2">Error</h3>
              <p className="text-red-300">{error}</p>
            </div>
          )}

          {/* Controls */}
          <div className="bg-gray-900 rounded-lg p-6 mb-8 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
            <div className="flex gap-4">
              {!isInitialized && isSupported && (
                <button
                  onClick={initializeMidi}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Initialize MIDI
                </button>
              )}
              {isInitialized && devices.some(d => d.type === 'output') && (
                <button
                  onClick={testSendMessage}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  Test Send Note (Middle C)
                </button>
              )}
            </div>
          </div>

          {/* Devices */}
          {isInitialized && (
            <div className="bg-gray-900 rounded-lg p-6 mb-8 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Connected Devices</h2>
              {devices.length === 0 ? (
                <p className="text-gray-400">No MIDI devices detected. Please connect a MIDI device and refresh.</p>
              ) : (
                <div className="space-y-3">
                  {devices.map(device => (
                    <div key={device.id} className="bg-gray-800 rounded p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{device.name}</p>
                          <p className="text-sm text-gray-400">
                            {device.manufacturer} • {device.type.toUpperCase()} • 
                            {device.connected ? ' Connected' : ' Disconnected'}
                          </p>
                        </div>
                        <span className={`w-2 h-2 rounded-full ${
                          device.connected ? 'bg-green-400' : 'bg-gray-500'
                        }`}></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          {isInitialized && (
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Recent Messages</h2>
              {messages.length === 0 ? (
                <p className="text-gray-400">No messages received yet. Play some notes on your MIDI controller!</p>
              ) : (
                <div className="space-y-2 font-mono text-sm">
                  {messages.map((msg, idx) => (
                    <div key={idx} className="bg-gray-800 rounded p-2">
                      <span className="text-blue-400">{msg.type}</span>
                      <span className="text-gray-500"> ch:</span>
                      <span className="text-green-400">{msg.channel}</span>
                      {msg.note !== undefined && (
                        <>
                          <span className="text-gray-500"> note:</span>
                          <span className="text-yellow-400">{msg.note}</span>
                        </>
                      )}
                      {msg.control !== undefined && (
                        <>
                          <span className="text-gray-500"> cc:</span>
                          <span className="text-yellow-400">{msg.control}</span>
                        </>
                      )}
                      <span className="text-gray-500"> val:</span>
                      <span className="text-cyan-400">{Math.round(msg.value * 127)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Browser Compatibility Note */}
          {!isSupported && (
            <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4 mt-8">
              <h3 className="text-yellow-400 font-semibold mb-2">Browser Not Supported</h3>
              <p className="text-yellow-300">
                Your browser does not support the Web MIDI API. Please use Chrome, Edge, or Opera for MIDI functionality.
              </p>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 text-sm text-gray-400">
            <h3 className="font-semibold mb-2">Test Instructions:</h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>Connect a MIDI device to your computer</li>
              <li>Click &quot;Initialize MIDI&quot; (browser may ask for permission)</li>
              <li>Play notes or move controls on your MIDI device</li>
              <li>Test sending MIDI messages if output device is available</li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
};

export default MidiBrowserTest;