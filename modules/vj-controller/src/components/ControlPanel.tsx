/**
 * ControlPanel - Main controller interface for VJ Application
 * 
 * Provides tabbed interface for controlling visual effects, layers, lyrics, and presets.
 * Implements responsive design and accessibility features.
 * 
 * Compatible with legacy visualizer store for smooth migration.
 */

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiChevronUp, FiChevronDown, FiSettings, FiLayers, FiMusic, FiFolder, FiMic, FiVideo, FiSave, FiShare } from 'react-icons/fi'
import Button from './ui/Button'
import Slider from './ui/Slider'
import Tabs from './ui/Tabs'

interface ControlPanelProps {
  className?: string
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  className = ''
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState('effects')
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [intensity, setIntensity] = useState(50)
  const [speed, setSpeed] = useState(25)
  const [colorShift, setColorShift] = useState(0)

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Handle microphone permission
  const handleMicrophoneToggle = async () => {
    try {
      if (!isMicrophoneEnabled) {
        await navigator.mediaDevices.getUserMedia({ audio: true })
        setIsMicrophoneEnabled(true)
      } else {
        setIsMicrophoneEnabled(false)
      }
    } catch (error) {
      console.error('Microphone access denied:', error)
    }
  }

  const tabs = [
    {
      id: 'effects',
      label: 'Effects',
      icon: <FiSettings />,
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Intensity
            </label>
            <Slider
              min={0}
              max={100}
              value={intensity}
              onChange={setIntensity}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Speed
            </label>
            <Slider
              min={0}
              max={100}
              value={speed}
              onChange={setSpeed}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Color Shift
            </label>
            <Slider
              min={0}
              max={100}
              value={colorShift}
              onChange={setColorShift}
            />
          </div>
        </div>
      )
    },
    {
      id: 'layers',
      label: 'Layers',
      icon: <FiLayers />,
      content: (
        <div className="space-y-4">
          <Button
            onClick={() => console.log('Add layer')}
            className="w-full"
          >
            Add Layer
          </Button>
          <div className="text-sm text-gray-400">
            Layer management functionality
          </div>
        </div>
      )
    },
    {
      id: 'lyrics',
      label: 'Lyrics',
      icon: <FiMusic />,
      content: (
        <div className="space-y-4">
          <Button
            onClick={handleMicrophoneToggle}
            variant={isMicrophoneEnabled ? 'secondary' : 'primary'}
            className="w-full"
          >
            <FiMic className="mr-2" />
            {isMicrophoneEnabled ? 'Stop Recording' : 'Start Recording'}
          </Button>
          <div className="text-sm text-gray-400">
            Voice recognition {isMicrophoneEnabled ? 'active' : 'inactive'}
          </div>
        </div>
      )
    },
    {
      id: 'presets',
      label: 'Presets',
      icon: <FiFolder />,
      content: (
        <div className="space-y-4">
          <Button
            onClick={() => console.log('Save preset')}
            className="w-full"
          >
            <FiSave className="mr-2" />
            Save Preset
          </Button>
          <Button
            onClick={() => console.log('Share preset')}
            variant="secondary"
            className="w-full"
          >
            <FiShare className="mr-2" />
            Share Preset
          </Button>
        </div>
      )
    }
  ]

  return (
    <motion.div
      className={`
        bg-gray-900 border border-gray-700 rounded-lg shadow-xl
        ${isMobile ? 'w-full' : 'w-80'}
        ${isCollapsed ? 'h-12' : 'h-auto'}
        ${className}
      `}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer border-b border-gray-700"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h3 className="text-lg font-semibold text-white">
          VJ Controller
        </h3>
        <motion.div
          animate={{ rotate: isCollapsed ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {isCollapsed ? <FiChevronDown /> : <FiChevronUp />}
        </motion.div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-4">
              <Tabs
                tabs={tabs}
                defaultTabId={activeTab}
                onChange={setActiveTab}
                className="w-full"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default ControlPanel