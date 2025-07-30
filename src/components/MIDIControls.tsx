import React, { useState } from 'react';
import { useVisualizerStore, MIDIControllerMapping } from '@/store/visualizerStore';
import { Button } from '@vj-app/ui-components';

const MIDIControls: React.FC = () => {
  const {
    isMIDIEnabled,
    midiMappings,
    lastMIDIMessage,
    setMIDIEnabled,
    addMIDIMapping,
    removeMIDIMapping,
    updateMIDIMapping,
    toggleMIDIMapping,
  } = useVisualizerStore();

  const [isAddingMapping, setIsAddingMapping] = useState(false);
  const [newMapping, setNewMapping] = useState<Omit<MIDIControllerMapping, 'id'>>({
    name: '',
    type: 'cc',
    midiChannel: 0,
    midiNumber: 1,
    targetParameter: 'sensitivity',
    minValue: 0,
    maxValue: 1,
    curve: 'linear',
    enabled: true,
  });

  const handleAddMapping = () => {
    if (newMapping.name.trim()) {
      addMIDIMapping(newMapping);
      setNewMapping({
        name: '',
        type: 'cc',
        midiChannel: 0,
        midiNumber: 1,
        targetParameter: 'sensitivity',
        minValue: 0,
        maxValue: 1,
        curve: 'linear',
        enabled: true,
      });
      setIsAddingMapping(false);
    }
  };

  const targetParameterOptions = [
    { value: 'sensitivity', label: 'Sensitivity' },
    { value: 'hue', label: 'Color Hue' },
    { value: 'layer_opacity', label: 'Layer Opacity' },
  ];

  const curveOptions = [
    { value: 'linear', label: 'Linear' },
    { value: 'exponential', label: 'Exponential' },
    { value: 'logarithmic', label: 'Logarithmic' },
  ];

  return (
    <div className="p-4 bg-gray-800 rounded-lg text-white">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">MIDI Controls</h3>
        <Button
          onClick={() => setMIDIEnabled(!isMIDIEnabled)}
          variant={isMIDIEnabled ? 'primary' : 'outline'}
          size="sm"
        >
          {isMIDIEnabled ? 'MIDI ON' : 'MIDI OFF'}
        </Button>
      </div>

      {/* MIDI Status */}
      {isMIDIEnabled && (
        <div className="mb-4 p-3 bg-gray-700 rounded">
          <h4 className="text-sm font-medium mb-2">MIDI Status</h4>
          {lastMIDIMessage ? (
            <div className="text-xs text-green-400">
              <p>Last Message: Type 0x{lastMIDIMessage.type.toString(16).toUpperCase()}</p>
              <p>Channel: {lastMIDIMessage.channel}, Data: {lastMIDIMessage.data1}, {lastMIDIMessage.data2}</p>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Waiting for MIDI messages...</p>
          )}
        </div>
      )}

      {/* MIDI Mappings List */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium">Controller Mappings</h4>
          <Button
            onClick={() => setIsAddingMapping(true)}
            variant="outline"
            size="sm"
            disabled={!isMIDIEnabled}
          >
            Add Mapping
          </Button>
        </div>

        {midiMappings.length === 0 ? (
          <p className="text-sm text-gray-400">No MIDI mappings configured</p>
        ) : (
          <div className="space-y-2">
            {midiMappings.map((mapping) => (
              <div
                key={mapping.id}
                className={`p-3 rounded border ${
                  mapping.enabled 
                    ? 'border-green-500 bg-green-500/10' 
                    : 'border-gray-600 bg-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium">{mapping.name}</h5>
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => toggleMIDIMapping(mapping.id)}
                      variant={mapping.enabled ? 'primary' : 'outline'}
                      size="sm"
                    >
                      {mapping.enabled ? 'ON' : 'OFF'}
                    </Button>
                    <Button
                      onClick={() => removeMIDIMapping(mapping.id)}
                      variant="outline"
                      size="sm"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-gray-300">
                  <p>{mapping.type.toUpperCase()} {mapping.midiNumber} (Ch {mapping.midiChannel}) → {mapping.targetParameter}</p>
                  <p>Range: {mapping.minValue} - {mapping.maxValue} ({mapping.curve})</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New Mapping Form */}
      {isAddingMapping && (
        <div className="p-4 bg-gray-700 rounded">
          <h4 className="text-sm font-medium mb-3">Add New Mapping</h4>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1">Name</label>
              <input
                type="text"
                value={newMapping.name}
                onChange={(e) => setNewMapping({ ...newMapping, name: e.target.value })}
                className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-sm"
                placeholder="e.g., Volume Control"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Type</label>
                <select
                  value={newMapping.type}
                  onChange={(e) => setNewMapping({ ...newMapping, type: e.target.value as 'note' | 'cc' | 'pitch_bend' })}
                  className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-sm"
                >
                  <option value="cc">Control Change</option>
                  <option value="note">Note</option>
                  <option value="pitch_bend">Pitch Bend</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Target</label>
                <select
                  value={newMapping.targetParameter}
                  onChange={(e) => setNewMapping({ ...newMapping, targetParameter: e.target.value })}
                  className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-sm"
                >
                  {targetParameterOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Channel</label>
                <input
                  type="number"
                  min="0"
                  max="15"
                  value={newMapping.midiChannel}
                  onChange={(e) => setNewMapping({ ...newMapping, midiChannel: parseInt(e.target.value) })}
                  className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">CC/Note #</label>
                <input
                  type="number"
                  min="0"
                  max="127"
                  value={newMapping.midiNumber}
                  onChange={(e) => setNewMapping({ ...newMapping, midiNumber: parseInt(e.target.value) })}
                  className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Curve</label>
                <select
                  value={newMapping.curve}
                  onChange={(e) => setNewMapping({ ...newMapping, curve: e.target.value as 'linear' | 'exponential' | 'logarithmic' })}
                  className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-sm"
                >
                  {curveOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Min Value</label>
                <input
                  type="number"
                  step="0.1"
                  value={newMapping.minValue}
                  onChange={(e) => setNewMapping({ ...newMapping, minValue: parseFloat(e.target.value) })}
                  className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Max Value</label>
                <input
                  type="number"
                  step="0.1"
                  value={newMapping.maxValue}
                  onChange={(e) => setNewMapping({ ...newMapping, maxValue: parseFloat(e.target.value) })}
                  className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-sm"
                />
              </div>
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={handleAddMapping}
                variant="primary"
                size="sm"
                disabled={!newMapping.name.trim()}
              >
                Add Mapping
              </Button>
              <Button
                onClick={() => setIsAddingMapping(false)}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MIDIControls;