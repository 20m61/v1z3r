import React, { useState } from 'react'
import Button from './ui/Button'

const MIDITab: React.FC = () => {
  const [isMIDIEnabled, setIsMIDIEnabled] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [lastMessage, setLastMessage] = useState<string>('No MIDI messages')
  const [mappings, setMappings] = useState<Array<{
    id: string
    name: string
    cc: number
    parameter: string
  }>>([])

  const handleMIDIToggle = async () => {
    try {
      if (!isMIDIEnabled) {
        // Check Web MIDI API support
        if (!navigator.requestMIDIAccess) {
          alert('Web MIDI API is not supported in this browser')
          return
        }

        // Request MIDI access
        const midiAccess = await navigator.requestMIDIAccess()
        
        // Set up MIDI input handling
        const inputs = Array.from(midiAccess.inputs.values())
        
        if (inputs.length === 0) {
          alert('No MIDI devices found')
          return
        }

        // Connect to first available device
        const firstInput = inputs[0]
        firstInput.onmidimessage = (event) => {
          const [status, data1, data2] = event.data
          const messageType = status & 0xF0
          const channel = status & 0x0F
          
          setLastMessage(`Type: 0x${messageType.toString(16)}, CH: ${channel}, Data: ${data1}, ${data2}`)
        }

        setSelectedDevice(firstInput.name || 'Unknown Device')
        setIsMIDIEnabled(true)
        console.log('MIDI enabled, connected to:', firstInput.name)
      } else {
        setIsMIDIEnabled(false)
        setSelectedDevice('')
        setLastMessage('MIDI disabled')
        console.log('MIDI disabled')
      }
    } catch (error) {
      console.error('MIDI setup error:', error)
      alert('Failed to setup MIDI: ' + (error as Error).message)
    }
  }

  const addMapping = () => {
    const newMapping = {
      id: `mapping-${Date.now()}`,
      name: `Control ${mappings.length + 1}`,
      cc: 1,
      parameter: 'intensity'
    }
    setMappings([...mappings, newMapping])
  }

  const removeMapping = (id: string) => {
    setMappings(mappings.filter(m => m.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* MIDI Status */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-300">
            MIDI Connection
          </label>
          <Button
            onClick={handleMIDIToggle}
            variant={isMIDIEnabled ? 'primary' : 'outline'}
            size="sm"
          >
            {isMIDIEnabled ? 'Connected' : 'Connect'}
          </Button>
        </div>
        
        {selectedDevice && (
          <p className="text-xs text-green-400">
            ✓ {selectedDevice}
          </p>
        )}
        
        <div className="p-2 bg-gray-700 rounded text-xs">
          <p className="text-gray-400">Last MIDI message:</p>
          <p className="text-white font-mono">{lastMessage}</p>
        </div>
      </div>

      {/* Quick Mappings */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-300">
            Controller Mappings
          </label>
          <Button
            onClick={addMapping}
            variant="outline"
            size="sm"
            disabled={!isMIDIEnabled}
          >
            Add
          </Button>
        </div>

        {mappings.length === 0 ? (
          <p className="text-xs text-gray-400">No mappings configured</p>
        ) : (
          <div className="space-y-2">
            {mappings.map((mapping) => (
              <div key={mapping.id} className="p-2 bg-gray-700 rounded">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{mapping.name}</span>
                  <Button
                    onClick={() => removeMapping(mapping.id)}
                    variant="outline"
                    size="sm"
                  >
                    ×
                  </Button>
                </div>
                <div className="text-xs text-gray-400">
                  CC {mapping.cc} → {mapping.parameter}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MIDI Learn */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          MIDI Learn
        </label>
        <Button
          onClick={() => alert('MIDI Learn mode activated. Move a control on your MIDI device.')}
          variant="outline"
          className="w-full"
          disabled={!isMIDIEnabled}
        >
          Learn Next Control
        </Button>
      </div>

      {/* Preset Controls */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          MIDI Presets
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => alert('Saving MIDI preset...')}
            variant="outline"
            size="sm"
            disabled={!isMIDIEnabled}
          >
            Save
          </Button>
          <Button
            onClick={() => alert('Loading MIDI preset...')}
            variant="outline"
            size="sm"
            disabled={!isMIDIEnabled}
          >
            Load
          </Button>
        </div>
      </div>
    </div>
  )
}

export default MIDITab