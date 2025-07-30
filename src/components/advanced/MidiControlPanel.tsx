/**
 * MIDI Control Panel Component
 * UI for MIDI device management and parameter mapping
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  midiController,
  MidiDevice,
  MidiMapping,
  MidiMessage,
} from '@/services/midi/midiController';
import { errorHandler } from '@/utils/errorHandler';

interface MidiControlPanelProps {
  onParameterChange?: (path: string, value: number) => void;
  className?: string;
}

export const MidiControlPanel: React.FC<MidiControlPanelProps> = ({
  onParameterChange,
  className = '',
}) => {
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [mappings, setMappings] = useState<MidiMapping[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<MidiDevice | null>(null);
  const [selectedMapping, setSelectedMapping] = useState<MidiMapping | null>(null);
  const [isLearning, setIsLearning] = useState(false);
  const [learningParameter, setLearningParameter] = useState('');
  const [lastMessage, setLastMessage] = useState<MidiMessage | null>(null);
  const [activeTab, setActiveTab] = useState<'devices' | 'mappings' | 'learn'>('devices');
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected'
  >('disconnected');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parameters available for mapping
  const availableParameters = [
    { path: 'visualizer.sensitivity', name: 'Audio Sensitivity', min: 0, max: 3 },
    { path: 'visualizer.colorTheme', name: 'Color Theme', min: 0, max: 360 },
    { path: 'visualizer.effectType', name: 'Effect Type', min: 0, max: 4 },
    { path: 'visualizer.particleCount', name: 'Particle Count', min: 100, max: 10000 },
    { path: 'visualizer.animationSpeed', name: 'Animation Speed', min: 0.1, max: 3 },
    { path: 'visualizer.brightness', name: 'Brightness', min: 0, max: 1 },
    { path: 'visualizer.contrast', name: 'Contrast', min: 0, max: 2 },
    { path: 'visualizer.saturation', name: 'Saturation', min: 0, max: 2 },
    { path: 'audio.gain', name: 'Audio Gain', min: 0, max: 2 },
    { path: 'audio.lowFreq', name: 'Low Frequency', min: 0, max: 1 },
    { path: 'audio.midFreq', name: 'Mid Frequency', min: 0, max: 1 },
    { path: 'audio.highFreq', name: 'High Frequency', min: 0, max: 1 },
    { path: 'style.strength', name: 'Style Transfer Strength', min: 0, max: 1 },
    { path: 'scene.cameraX', name: 'Camera X', min: -10, max: 10 },
    { path: 'scene.cameraY', name: 'Camera Y', min: -10, max: 10 },
    { path: 'scene.cameraZ', name: 'Camera Z', min: -10, max: 10 },
  ];

  useEffect(() => {
    initializeMidi();
    return () => {
      midiController.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeMidi = useCallback(async () => {
    try {
      setConnectionStatus('connecting');

      // Set up callbacks
      midiController.setCallbacks({
        onDeviceConnect: device => {
          setDevices(prev => [...prev.filter(d => d.id !== device.id), device]);
          errorHandler.info(`MIDI device connected: ${device.name}`);
        },
        onDeviceDisconnect: device => {
          setDevices(prev => prev.filter(d => d.id !== device.id));
          errorHandler.info(`MIDI device disconnected: ${device.name}`);
        },
        onMidiMessage: message => {
          setLastMessage(message);
        },
        onMappingLearn: mapping => {
          setMappings(prev => [...prev.filter(m => m.id !== mapping.id), mapping]);
          setIsLearning(false);
          errorHandler.info(`MIDI mapping learned: ${mapping.name}`);
        },
        onParameterChange: (path, value) => {
          onParameterChange?.(path, value);
        },
      });

      // Initialize MIDI system
      await midiController.initialize();

      setDevices(midiController.getDevices());
      setMappings(midiController.getMappings());
      setIsInitialized(true);
      setConnectionStatus('connected');
    } catch (error) {
      errorHandler.error('Failed to initialize MIDI', error as Error);
      setConnectionStatus('disconnected');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateMapping = (parameterPath: string, parameterName: string) => {
    if (!selectedDevice) {
      errorHandler.error('No device selected');
      return;
    }

    const mappingId = midiController.createMapping(
      `${selectedDevice.name} → ${parameterName}`,
      selectedDevice.id,
      parameterPath,
      {
        minValue: availableParameters.find(p => p.path === parameterPath)?.min || 0,
        maxValue: availableParameters.find(p => p.path === parameterPath)?.max || 1,
      }
    );

    setMappings(midiController.getMappings());

    // Select the new mapping
    const newMapping = midiController.getMapping(mappingId);
    if (newMapping) {
      setSelectedMapping(newMapping);
      setActiveTab('mappings');
    }
  };

  const handleStartLearning = (parameterPath: string, parameterName: string) => {
    setLearningParameter(parameterName);
    setIsLearning(true);
    midiController.startLearning(parameterPath, `Learn → ${parameterName}`);
    setActiveTab('learn');
  };

  const handleStopLearning = () => {
    setIsLearning(false);
    setLearningParameter('');
    midiController.stopLearning();
  };

  const handleMappingUpdate = (id: string, updates: Partial<MidiMapping>) => {
    midiController.updateMapping(id, updates);
    setMappings(midiController.getMappings());
  };

  const handleDeleteMapping = (id: string) => {
    if (window.confirm('Are you sure you want to delete this mapping?')) {
      midiController.deleteMapping(id);
      setMappings(midiController.getMappings());
      if (selectedMapping?.id === id) {
        setSelectedMapping(null);
      }
    }
  };

  const handleExportMappings = () => {
    const data = midiController.exportMappings();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `midi_mappings_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportMappings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = e.target?.result as string;
        midiController.importMappings(data);
        setMappings(midiController.getMappings());
        errorHandler.info('MIDI mappings imported successfully');
      } catch (error) {
        errorHandler.error('Failed to import MIDI mappings', error as Error);
      }
    };
    reader.readAsText(file);
  };

  const renderDevicesTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-medium text-white">Connected Devices</h4>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected'
                ? 'bg-green-400'
                : connectionStatus === 'connecting'
                  ? 'bg-yellow-400'
                  : 'bg-red-400'
            }`}
          ></div>
          <span className="text-sm text-gray-400 capitalize">{connectionStatus}</span>
        </div>
      </div>

      {devices.length === 0 ? (
        <div className="text-center py-8">
          <span className="text-gray-400">No MIDI devices found</span>
          <p className="text-sm text-gray-500 mt-2">
            Connect a MIDI device and it will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map(device => (
            <div
              key={device.id}
              className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                selectedDevice?.id === device.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
              }`}
              onClick={() => setSelectedDevice(device)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                    <span className="text-xl">{device.type === 'input' ? '🎹' : '🔊'}</span>
                  </div>
                  <div>
                    <h5 className="font-medium text-white">{device.name}</h5>
                    <p className="text-sm text-gray-400">
                      {device.manufacturer} • {device.type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      device.connected ? 'bg-green-600' : 'bg-red-600'
                    }`}
                  >
                    {device.connected ? 'Connected' : 'Disconnected'}
                  </span>
                  {device.capabilities.midi2Support && (
                    <span className="px-2 py-1 text-xs bg-purple-600 rounded">MIDI 2.0</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Device capabilities */}
      {selectedDevice && (
        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
          <h5 className="font-medium text-white mb-3">Device Capabilities</h5>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  selectedDevice.capabilities.supportsControlChange ? 'bg-green-400' : 'bg-gray-400'
                }`}
              ></span>
              <span className="text-gray-300">Control Change</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  selectedDevice.capabilities.supportsNoteOn ? 'bg-green-400' : 'bg-gray-400'
                }`}
              ></span>
              <span className="text-gray-300">Note Messages</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  selectedDevice.capabilities.supportsPitchBend ? 'bg-green-400' : 'bg-gray-400'
                }`}
              ></span>
              <span className="text-gray-300">Pitch Bend</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  selectedDevice.capabilities.supportsAftertouch ? 'bg-green-400' : 'bg-gray-400'
                }`}
              ></span>
              <span className="text-gray-300">Aftertouch</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderMappingsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-medium text-white">Parameter Mappings</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportMappings}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
          >
            Export
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
          >
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportMappings}
            className="hidden"
          />
        </div>
      </div>

      {mappings.length === 0 ? (
        <div className="text-center py-8">
          <span className="text-gray-400">No mappings created</span>
          <p className="text-sm text-gray-500 mt-2">
            Create mappings to control parameters with MIDI
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {mappings.map(mapping => (
            <div
              key={mapping.id}
              className={`p-4 rounded-lg border transition-colors ${
                selectedMapping?.id === mapping.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-600 bg-gray-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                    <span className="text-sm font-mono">
                      {mapping.messageType === 'cc'
                        ? 'CC'
                        : mapping.messageType === 'note'
                          ? 'NT'
                          : mapping.messageType === 'pitchbend'
                            ? 'PB'
                            : 'AF'}
                    </span>
                  </div>
                  <div>
                    <h5 className="font-medium text-white">{mapping.name}</h5>
                    <p className="text-sm text-gray-400">
                      {mapping.messageType.toUpperCase()} {mapping.control} →{' '}
                      {mapping.parameterPath}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={mapping.enabled}
                      onChange={e => handleMappingUpdate(mapping.id, { enabled: e.target.checked })}
                      className="rounded"
                    />
                    Enabled
                  </label>
                  <button
                    onClick={() => setSelectedMapping(mapping)}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteMapping(mapping.id)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mapping editor */}
      {selectedMapping && (
        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
          <h5 className="font-medium text-white mb-4">Edit Mapping</h5>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Message Type</label>
              <select
                value={selectedMapping.messageType}
                onChange={e =>
                  handleMappingUpdate(selectedMapping.id, {
                    messageType: e.target.value as any,
                  })
                }
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              >
                <option value="cc">Control Change</option>
                <option value="note">Note</option>
                <option value="pitchbend">Pitch Bend</option>
                <option value="aftertouch">Aftertouch</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Control/Note</label>
              <input
                type="number"
                min="0"
                max="127"
                value={selectedMapping.control}
                onChange={e =>
                  handleMappingUpdate(selectedMapping.id, {
                    control: parseInt(e.target.value),
                  })
                }
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Min Value</label>
              <input
                type="number"
                step="0.1"
                value={selectedMapping.minValue}
                onChange={e =>
                  handleMappingUpdate(selectedMapping.id, {
                    minValue: parseFloat(e.target.value),
                  })
                }
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Max Value</label>
              <input
                type="number"
                step="0.1"
                value={selectedMapping.maxValue}
                onChange={e =>
                  handleMappingUpdate(selectedMapping.id, {
                    maxValue: parseFloat(e.target.value),
                  })
                }
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Curve</label>
              <select
                value={selectedMapping.curve}
                onChange={e =>
                  handleMappingUpdate(selectedMapping.id, {
                    curve: e.target.value as any,
                  })
                }
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              >
                <option value="linear">Linear</option>
                <option value="exponential">Exponential</option>
                <option value="logarithmic">Logarithmic</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderLearnTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-medium text-white">Parameter Learning</h4>
        {isLearning && (
          <button
            onClick={handleStopLearning}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
          >
            Stop Learning
          </button>
        )}
      </div>

      {isLearning ? (
        <div className="p-6 bg-blue-900/20 border border-blue-500 rounded-lg text-center">
          <div className="animate-pulse">
            <span className="text-2xl mb-4 block">🎯</span>
            <h5 className="text-lg font-medium text-white mb-2">Learning: {learningParameter}</h5>
            <p className="text-gray-300">Move a control on your MIDI device to create a mapping</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-gray-300 text-sm">
            Click &quot;Learn&quot; next to a parameter to map it to a MIDI control
          </p>

          <div className="grid grid-cols-1 gap-3">
            {availableParameters.map(param => (
              <div
                key={param.path}
                className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-600"
              >
                <div>
                  <h5 className="font-medium text-white">{param.name}</h5>
                  <p className="text-sm text-gray-400">
                    {param.path} ({param.min} - {param.max})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCreateMapping(param.path, param.name)}
                    disabled={!selectedDevice}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded transition-colors"
                  >
                    Map
                  </button>
                  <button
                    onClick={() => handleStartLearning(param.path, param.name)}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                  >
                    Learn
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last MIDI message */}
      {lastMessage && (
        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
          <h5 className="font-medium text-white mb-3">Last MIDI Message</h5>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Type:</span>
              <span className="ml-2 text-white">{lastMessage.type}</span>
            </div>
            <div>
              <span className="text-gray-400">Channel:</span>
              <span className="ml-2 text-white">{lastMessage.channel}</span>
            </div>
            <div>
              <span className="text-gray-400">Control:</span>
              <span className="ml-2 text-white">{lastMessage.control || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-400">Value:</span>
              <span className="ml-2 text-white">{lastMessage.value.toFixed(3)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (!isInitialized && connectionStatus === 'disconnected') {
    return (
      <div className={`bg-gray-900 border border-gray-700 rounded-xl p-6 ${className}`}>
        <div className="text-center py-8">
          <span className="text-2xl mb-4 block">🎹</span>
          <h3 className="text-xl font-bold text-white mb-2">MIDI Not Available</h3>
          <p className="text-gray-400 mb-4">
            Your browser doesn&apos;t support Web MIDI API or no MIDI devices are available.
          </p>
          <button
            onClick={initializeMidi}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 border border-gray-700 rounded-xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-2xl">🎹</span>
          MIDI Control
        </h3>

        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">
            {devices.length} devices, {mappings.length} mappings
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-6">
        {[
          { id: 'devices', label: 'Devices', icon: '🔌' },
          { id: 'mappings', label: 'Mappings', icon: '🔗' },
          { id: 'learn', label: 'Learn', icon: '🎯' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'devices' && renderDevicesTab()}
        {activeTab === 'mappings' && renderMappingsTab()}
        {activeTab === 'learn' && renderLearnTab()}
      </div>
    </div>
  );
};

export default MidiControlPanel;
