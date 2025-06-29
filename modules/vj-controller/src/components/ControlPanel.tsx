/**
 * ControlPanel - Main controller interface for VJ Application
 * 
 * Provides tabbed interface for controlling visual effects, layers, lyrics, and presets.
 * Implements responsive design and accessibility features.
 * 
 * Following TDD principles: implementing minimal functionality to pass tests.
 */

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiChevronUp, FiChevronDown, FiSettings, FiLayers, FiMusic, FiFolder, FiMic, FiVideo } from 'react-icons/fi'
import { useController } from '../context/ControllerContext'
import { ControlPanelProps, TabConfig } from '../types'

export const ControlPanel: React.FC<ControlPanelProps> = ({
  className = '',
  onParameterChange,
  onPresetLoad,
  onPresetSave,
  onLayerUpdate,
}) => {
  const {
    ui,
    setActiveTab,
    toggleCollapse,
    capabilities,
    permissions,
    setMicrophoneEnabled,
    setCameraEnabled,
    globalParameters,
    updateGlobalParameter,
    layers,
    activeLayerId,
    addLayer,
  } = useController()

  const [isMobile, setIsMobile] = useState(false)

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Handle permission requests
  const handleMicrophoneToggle = async () => {
    try {
      if (!permissions.microphone.granted) {
        await navigator.mediaDevices.getUserMedia({ audio: true })
        setMicrophoneEnabled(true)
      } else {
        setMicrophoneEnabled(false)
      }
    } catch (error) {
      console.error('Microphone permission error:', error)
      // Set error state in UI
    }
  }

  const handleCameraToggle = async () => {
    try {
      if (!permissions.camera.granted) {
        await navigator.mediaDevices.getUserMedia({ video: true })
        setCameraEnabled(true)
      } else {
        setCameraEnabled(false)
      }
    } catch (error) {
      console.error('Camera permission error:', error)
      // Set error state in UI
    }
  }

  // Handle parameter changes
  const handleParameterChange = (parameter: string, value: any) => {
    updateGlobalParameter(parameter, value)
    onParameterChange?.(parameter, value)
  }

  const handleEffectTypeChange = (effectType: string) => {
    handleParameterChange('effectType', effectType)
  }

  const handleAddLayer = () => {
    addLayer({
      name: `Layer ${layers.length + 1}`,
      effectType: 'spectrum',
    })
    onLayerUpdate?.('new-layer', { action: 'create' })
  }

  // Tab configuration
  const tabs: TabConfig[] = [
    {
      id: 'effects',
      label: 'Effects',
      icon: <FiSettings className="w-4 h-4" />,
      content: (
        <div data-testid="effects-content" className="space-y-4">
          <div>
            <label htmlFor="effect-type" className="block text-sm font-medium mb-2">
              Effect Type
            </label>
            <select
              id="effect-type"
              data-testid="effect-type-selector"
              value={globalParameters.effectType || 'spectrum'}
              onChange={(e) => handleEffectTypeChange(e.target.value)}
              className="w-full p-2 rounded bg-gray-800 border border-gray-600 text-white"
            >
              <option value="spectrum">Spectrum</option>
              <option value="waveform">Waveform</option>
              <option value="particles">Particles</option>
              <option value="lyrics">Lyrics</option>
              <option value="camera">Camera</option>
            </select>
          </div>

          <div>
            <label htmlFor="sensitivity" className="block text-sm font-medium mb-2">
              Sensitivity: {globalParameters.sensitivity}
            </label>
            <input
              id="sensitivity"
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={globalParameters.sensitivity}
              onChange={(e) => handleParameterChange('sensitivity', parseFloat(e.target.value))}
              className="w-full"
              aria-label="Sensitivity"
            />
          </div>

          <div>
            <label htmlFor="speed" className="block text-sm font-medium mb-2">
              Speed: {globalParameters.speed}
            </label>
            <input
              id="speed"
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={globalParameters.speed}
              onChange={(e) => handleParameterChange('speed', parseFloat(e.target.value))}
              className="w-full"
              aria-label="Speed"
            />
          </div>

          <div data-testid="color-theme-selector">
            <label className="block text-sm font-medium mb-2">Color Theme</label>
            <div className="grid grid-cols-3 gap-2">
              {['rainbow', 'blue', 'purple', 'green', 'red', 'custom'].map((theme) => (
                <button
                  key={theme}
                  onClick={() => handleParameterChange('colorTheme', theme)}
                  className={`p-2 rounded text-sm capitalize ${
                    globalParameters.colorTheme === theme
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'layers',
      label: 'Layers',
      icon: <FiLayers className="w-4 h-4" />,
      content: (
        <div data-testid="layers-content" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Layer Management</h3>
            <button
              onClick={handleAddLayer}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              aria-label="Add Layer"
            >
              Add Layer
            </button>
          </div>
          
          <div className="space-y-2">
            {layers.map((layer) => (
              <div
                key={layer.id}
                className={`p-3 rounded border ${
                  layer.id === activeLayerId
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-600 bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{layer.name}</span>
                  <span className="text-sm text-gray-400">{layer.effectType}</span>
                </div>
                <div className="mt-2">
                  <label className="block text-xs text-gray-400 mb-1">
                    Opacity: {Math.round(layer.opacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={layer.opacity}
                    onChange={(e) => onLayerUpdate?.(layer.id, { opacity: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'lyrics',
      label: 'Lyrics',
      icon: <FiMusic className="w-4 h-4" />,
      content: (
        <div data-testid="lyrics-content" className="space-y-4">
          <h3 className="text-lg font-medium">Voice Recognition</h3>
          <div className="space-y-4">
            <button
              onClick={() => {/* Toggle voice recognition */}}
              className="w-full p-3 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Start Voice Recognition
            </button>
            
            <div>
              <label className="block text-sm font-medium mb-2">Language</label>
              <select className="w-full p-2 rounded bg-gray-800 border border-gray-600 text-white">
                <option value="en-US">English (US)</option>
                <option value="ja-JP">Japanese</option>
                <option value="es-ES">Spanish</option>
              </select>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'presets',
      label: 'Presets',
      icon: <FiFolder className="w-4 h-4" />,
      content: (
        <div data-testid="presets-content" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Presets</h3>
            <button
              onClick={() => {/* Save current as preset */}}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              Save Current
            </button>
          </div>
          
          <div className="text-gray-400 text-sm">
            No presets saved yet. Create your first preset by saving your current settings.
          </div>
        </div>
      ),
    },
  ]

  const activeTab = tabs.find(tab => tab.id === ui.activeTab) || tabs[0]

  return (
    <motion.div
      data-testid="control-panel"
      className={`fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 transition-all z-50 ${
        isMobile ? 'mobile-layout' : ''
      } ${ui.isCollapsed ? 'collapsed' : ''} ${className}`}
      animate={{ height: ui.isCollapsed ? '60px' : 'auto' }}
      initial={{ height: 'auto' }}
    >
      {/* Header with collapse button and permission status */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleCollapse}
            className="flex items-center space-x-2 text-gray-300 hover:text-white"
            aria-expanded={!ui.isCollapsed}
            aria-label={ui.isCollapsed ? 'Expand control panel' : 'Collapse control panel'}
          >
            {ui.isCollapsed ? (
              <FiChevronUp className="w-5 h-5" />
            ) : (
              <FiChevronDown className="w-5 h-5" />
            )}
            <span className="text-sm font-medium">
              {ui.isCollapsed ? 'Expand' : 'Collapse'}
            </span>
          </button>
        </div>

        {/* Permission monitoring */}
        <div data-testid="permission-monitor" className="flex items-center space-x-4">
          <button
            onClick={handleMicrophoneToggle}
            data-testid="microphone-status"
            className={`flex items-center space-x-1 px-2 py-1 rounded text-sm ${
              permissions.microphone.granted
                ? 'bg-green-600 text-white'
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
            aria-label={permissions.microphone.granted ? 'Disable microphone' : 'Enable microphone'}
          >
            <FiMic className="w-4 h-4" />
            <span>
              {permissions.microphone.granted ? 'Microphone Enabled' : 'Microphone'}
            </span>
          </button>

          <button
            onClick={handleCameraToggle}
            data-testid="camera-status"
            className={`flex items-center space-x-1 px-2 py-1 rounded text-sm ${
              permissions.camera.granted
                ? 'bg-green-600 text-white'
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
            aria-label={permissions.camera.granted ? 'Disable camera' : 'Enable camera'}
          >
            <FiVideo className="w-4 h-4" />
            <span>Camera</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {!ui.isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Tab navigation */}
            <div
              role="tablist"
              className="flex border-b border-gray-700 bg-gray-800"
              aria-label="Control panel sections"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={tab.id === ui.activeTab}
                  aria-controls={`tabpanel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors min-h-[44px] ${
                    tab.id === ui.activeTab
                      ? 'border-blue-500 text-blue-400 bg-gray-750'
                      : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                  }`}
                  disabled={tab.disabled}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div
              id={`tabpanel-${activeTab.id}`}
              role="tabpanel"
              aria-labelledby={`tab-${activeTab.id}`}
              className="p-6 max-h-96 overflow-y-auto"
            >
              {activeTab.content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}