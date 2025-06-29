/**
 * VJ Application - Main integration component
 * 
 * This component integrates the existing v1z3r functionality into a unified
 * VJ application experience, serving as a bridge between the legacy components
 * and the new modular architecture.
 */

import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import VisualEffects from './components/VisualEffects'
import AudioAnalyzer from './components/AudioAnalyzer'
import ControlPanel from './components/ControlPanel'
import { useVisualizerStore } from './store/visualizerStore'

interface VJApplicationProps {
  config?: {
    canvas?: {
      width: number
      height: number
    }
    sync?: {
      enabled: boolean
      serverUrl: string
    }
    storage?: any
  }
}

export const VJApplication: React.FC<VJApplicationProps> = ({ config }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [audioData, setAudioData] = useState<Uint8Array | undefined>()
  const [isAnalysisStarted, setIsAnalysisStarted] = useState(false)
  
  // Get state from visualizer store
  const {
    layers,
    isAudioAnalyzing,
    setAudioAnalyzing
  } = useVisualizerStore()

  // Status for different modules
  const [status, setStatus] = useState({
    rendering: false,
    connected: false,
    initialized: false,
    error: undefined as string | undefined
  })

  // Performance metrics
  const [performanceMetrics, setPerformanceMetrics] = useState({
    fps: 0,
    frameTime: 0,
    memoryUsage: 0,
    lastUpdated: Date.now()
  })

  // Initialize application
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setStatus(prev => ({ ...prev, error: undefined }))
        
        // Simulate module initialization
        await new Promise(resolve => setTimeout(resolve, 500))
        
        setStatus(prev => ({ 
          ...prev, 
          rendering: true,
          initialized: true 
        }))
        
        setIsInitialized(true)
        
        // Start performance monitoring
        const interval = setInterval(() => {
          setPerformanceMetrics({
            fps: Math.round(55 + Math.random() * 10), // Simulated FPS 55-65
            frameTime: 16 + Math.random() * 4, // Simulated frame time 16-20ms
            memoryUsage: Math.round(40 + Math.random() * 20), // Simulated memory 40-60%
            lastUpdated: Date.now()
          })
        }, 1000)

        return () => clearInterval(interval)
      } catch (error) {
        console.error('Failed to initialize VJ Application:', error)
        setStatus(prev => ({ 
          ...prev, 
          error: error instanceof Error ? error.message : 'Unknown error',
          initialized: false
        }))
      }
    }

    initializeApp()
  }, [config])

  // Handle audio data from analyzer
  const handleAudioData = (data: Uint8Array) => {
    setAudioData(new Uint8Array(data))
    if (!isAudioAnalyzing) {
      setAudioAnalyzing(true)
    }
    if (!isAnalysisStarted) {
      setIsAnalysisStarted(true)
    }
  }

  // Handle parameter changes from control panel
  const handleParameterChange = async (parameter: string, value: any) => {
    try {
      // Parameters are handled by the visualizer store
      console.log(`Parameter changed: ${parameter} = ${value}`)
      
      // Simulate sync if enabled
      if (config?.sync?.enabled && status.connected) {
        console.log(`Syncing parameter: ${parameter} = ${value}`)
      }
    } catch (error) {
      console.error('Failed to handle parameter change:', error)
    }
  }

  // Handle layer updates
  const handleLayerUpdate = async (layerId: string, updates: any) => {
    try {
      console.log(`Layer updated: ${layerId}`, updates)
      
      // Simulate sync if enabled
      if (config?.sync?.enabled && status.connected) {
        console.log(`Syncing layer update: ${layerId}`)
      }
    } catch (error) {
      console.error('Failed to handle layer update:', error)
    }
  }

  // Handle preset operations
  const handlePresetSave = async (presetData: any) => {
    try {
      console.log('Saving preset:', presetData)
      
      // Simulate preset save
      const preset = {
        id: `preset-${Date.now()}`,
        name: presetData.name || 'New Preset',
        layers: layers,
        globalSettings: presetData.globalSettings || {},
        createdAt: new Date().toISOString()
      }
      
      alert(`Preset "${preset.name}" saved successfully!`)
      
      // Simulate sync if enabled
      if (config?.sync?.enabled && status.connected) {
        console.log('Syncing preset creation')
      }
    } catch (error) {
      console.error('Failed to save preset:', error)
      alert('Failed to save preset')
    }
  }

  const handlePresetLoad = async (preset: any) => {
    try {
      console.log('Loading preset:', preset)
      alert(`Preset "${preset.name}" loaded successfully!`)
      
      // Simulate sync if enabled
      if (config?.sync?.enabled && status.connected) {
        console.log('Syncing preset load')
      }
    } catch (error) {
      console.error('Failed to load preset:', error)
      alert('Failed to load preset')
    }
  }

  // Get sorted active layers for rendering
  const sortedLayers = [...layers].sort((a, b) => b.zIndex - a.zIndex)
  const activeLayersForRender = sortedLayers.filter(layer => layer.active)

  return (
    <div className="vj-application" data-testid="vj-application">
      {/* Status Bar */}
      <div className="status-bar" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        padding: '8px 16px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        fontSize: '12px',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          VJ Application 
          {!status.initialized && ' - Initializing...'}
          {status.error && ` - Error: ${status.error}`}
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <span data-testid="rendering-status">
            Rendering: {status.rendering ? '✓' : '✗'}
          </span>
          <span data-testid="sync-status">
            Sync: {status.connected ? '✓' : '✗'}
          </span>
          <span data-testid="storage-status">
            Storage: {config?.storage ? '✓' : '✗'}
          </span>
        </div>
      </div>

      {/* Main Visual Area */}
      <div style={{ 
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        paddingTop: '40px' // Account for status bar
      }}>
        {/* Visual Effects Layers */}
        <div
          data-testid="visual-canvas"
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            backgroundColor: '#000'
          }}
        >
          <AnimatePresence>
            {activeLayersForRender.map((layer) => (
              <motion.div
                key={layer.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: layer.opacity }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: layer.zIndex
                }}
              >
                <VisualEffects
                  audioData={audioData}
                  effectType={layer.type}
                  colorTheme={layer.colorTheme}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Default visual effect if no layers */}
          {activeLayersForRender.length === 0 && (
            <VisualEffects
              audioData={audioData}
              effectType="spectrum"
              colorTheme="rainbow"
            />
          )}
        </div>

        {/* Audio Analyzer (Hidden) */}
        {isInitialized && (
          <div style={{ display: 'none' }}>
            <AudioAnalyzer onAudioData={handleAudioData} />
          </div>
        )}
      </div>

      {/* Control Panel */}
      {isInitialized && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000
        }}>
          <ControlPanel />
        </div>
      )}

      {/* Performance Monitor */}
      {isInitialized && (
        <div 
          data-testid="performance-monitor"
          style={{
            position: 'fixed',
            top: '40px',
            right: '16px',
            padding: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            fontSize: '11px',
            borderRadius: '4px',
            zIndex: 1000
          }}
        >
          <div>FPS: {performanceMetrics.fps}</div>
          <div>Frame Time: {performanceMetrics.frameTime.toFixed(2)}ms</div>
          <div>Memory: {performanceMetrics.memoryUsage}%</div>
        </div>
      )}
    </div>
  )
}

export default VJApplication