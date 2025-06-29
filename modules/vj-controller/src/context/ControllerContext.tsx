/**
 * Controller Context - State management for VJ Controller module
 * 
 * Provides centralized state management using Zustand with React Context
 * for easy testing and module isolation.
 */

import React, { createContext, useContext, ReactNode } from 'react'
import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { 
  ControllerStore, 
  LayerConfig, 
  VisualPreset, 
  VoiceCommand,
  UIState,
  DeviceCapabilities,
  PermissionStatus,
  ColorTheme,
  ControllerEventType
} from '../types'

// Initial state
const initialUIState: UIState = {
  activeTab: 'effects',
  isCollapsed: false,
  showPresetModal: false,
  isMicrophoneEnabled: false,
  isFullscreen: false,
  isCameraEnabled: false,
}

const initialCapabilities: DeviceCapabilities = {
  speech: typeof window !== 'undefined' && 'webkitSpeechRecognition' in window,
  microphone: typeof navigator !== 'undefined' && 'mediaDevices' in navigator,
  midi: typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator,
  camera: typeof navigator !== 'undefined' && 'mediaDevices' in navigator,
  touch: typeof window !== 'undefined' && 'ontouchstart' in window,
  fullscreen: typeof document !== 'undefined' && 'fullscreenEnabled' in document,
}

const initialPermissions: PermissionStatus = {
  microphone: { granted: false, denied: false, prompt: true, checking: false },
  camera: { granted: false, denied: false, prompt: true, checking: false },
  notifications: { granted: false, denied: false, prompt: true, checking: false },
}

// Create Zustand store
const useControllerStore = create<ControllerStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // UI State
      ui: initialUIState,
      setActiveTab: (tab: string) => 
        set((state) => ({ ui: { ...state.ui, activeTab: tab } }), false, 'setActiveTab'),
      
      toggleCollapse: () => 
        set((state) => ({ ui: { ...state.ui, isCollapsed: !state.ui.isCollapsed } }), false, 'toggleCollapse'),
      
      setShowPresetModal: (show: boolean) => 
        set((state) => ({ ui: { ...state.ui, showPresetModal: show } }), false, 'setShowPresetModal'),

      // Device state
      capabilities: initialCapabilities,
      permissions: initialPermissions,
      
      setMicrophoneEnabled: (enabled: boolean) => {
        set((state) => ({ 
          ui: { ...state.ui, isMicrophoneEnabled: enabled },
          permissions: {
            ...state.permissions,
            microphone: { ...state.permissions.microphone, granted: enabled }
          }
        }), false, 'setMicrophoneEnabled')
      },
      
      setFullscreen: (enabled: boolean) => 
        set((state) => ({ ui: { ...state.ui, isFullscreen: enabled } }), false, 'setFullscreen'),
      
      setCameraEnabled: (enabled: boolean) => 
        set((state) => ({ ui: { ...state.ui, isCameraEnabled: enabled } }), false, 'setCameraEnabled'),

      // Layer management
      layers: [
        {
          id: 'layer-1',
          name: 'Base Layer',
          effectType: 'spectrum',
          opacity: 1.0,
          isVisible: true,
          blendMode: 'normal',
          parameters: {},
          order: 0,
        }
      ],
      activeLayerId: 'layer-1',
      
      addLayer: (layer: Partial<LayerConfig>) => {
        const newLayer: LayerConfig = {
          id: `layer-${Date.now()}`,
          name: layer.name || 'New Layer',
          effectType: layer.effectType || 'spectrum',
          opacity: layer.opacity ?? 1.0,
          isVisible: layer.isVisible ?? true,
          blendMode: layer.blendMode || 'normal',
          parameters: layer.parameters || {},
          order: get().layers.length,
        }
        
        set((state) => ({ 
          layers: [...state.layers, newLayer],
          activeLayerId: newLayer.id 
        }), false, 'addLayer')
      },
      
      updateLayer: (layerId: string, updates: Partial<LayerConfig>) => {
        set((state) => ({
          layers: state.layers.map(layer => 
            layer.id === layerId ? { ...layer, ...updates } : layer
          )
        }), false, 'updateLayer')
      },
      
      removeLayer: (layerId: string) => {
        set((state) => {
          const newLayers = state.layers.filter(layer => layer.id !== layerId)
          const newActiveId = state.activeLayerId === layerId 
            ? newLayers[0]?.id 
            : state.activeLayerId
          
          return {
            layers: newLayers,
            activeLayerId: newActiveId
          }
        }, false, 'removeLayer')
      },
      
      reorderLayers: (sourceId: string, targetId: string) => {
        set((state) => {
          const layers = [...state.layers]
          const sourceIndex = layers.findIndex(l => l.id === sourceId)
          const targetIndex = layers.findIndex(l => l.id === targetId)
          
          if (sourceIndex === -1 || targetIndex === -1) return state
          
          const [removed] = layers.splice(sourceIndex, 1)
          layers.splice(targetIndex, 0, removed)
          
          // Update order property
          layers.forEach((layer, index) => {
            layer.order = index
          })
          
          return { layers }
        }, false, 'reorderLayers')
      },
      
      setActiveLayer: (layerId: string) => 
        set({ activeLayerId: layerId }, false, 'setActiveLayer'),

      // Preset management
      presets: [],
      selectedPresetId: undefined,
      
      loadPreset: (preset: VisualPreset) => {
        set((state) => ({
          selectedPresetId: preset.id,
          layers: preset.layers,
          globalParameters: {
            ...state.globalParameters,
            ...preset.globalSettings
          }
        }), false, 'loadPreset')
      },
      
      savePreset: async (preset: Partial<VisualPreset>) => {
        const newPreset: VisualPreset = {
          id: preset.id || `preset-${Date.now()}`,
          name: preset.name || 'New Preset',
          description: preset.description,
          layers: preset.layers || get().layers,
          globalSettings: preset.globalSettings || get().globalParameters,
          createdAt: preset.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: preset.tags || [],
          isPublic: preset.isPublic || false,
          author: preset.author,
        }
        
        set((state) => ({
          presets: [...state.presets.filter(p => p.id !== newPreset.id), newPreset],
          selectedPresetId: newPreset.id
        }), false, 'savePreset')
      },
      
      deletePreset: (presetId: string) => {
        set((state) => ({
          presets: state.presets.filter(p => p.id !== presetId),
          selectedPresetId: state.selectedPresetId === presetId ? undefined : state.selectedPresetId
        }), false, 'deletePreset')
      },
      
      duplicatePreset: (preset: VisualPreset) => {
        const duplicated: VisualPreset = {
          ...preset,
          id: `preset-${Date.now()}`,
          name: `${preset.name} (Copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        
        set((state) => ({
          presets: [...state.presets, duplicated]
        }), false, 'duplicatePreset')
      },

      // Voice recognition
      voiceCommands: [],
      isVoiceRecognitionActive: false,
      voiceLanguage: 'en-US',
      
      toggleVoiceRecognition: () => {
        set((state) => ({
          isVoiceRecognitionActive: !state.isVoiceRecognitionActive
        }), false, 'toggleVoiceRecognition')
      },
      
      setVoiceLanguage: (language: string) => 
        set({ voiceLanguage: language }, false, 'setVoiceLanguage'),
      
      addVoiceCommand: (command: VoiceCommand) => {
        set((state) => ({
          voiceCommands: [command, ...state.voiceCommands].slice(0, 50) // Keep last 50 commands
        }), false, 'addVoiceCommand')
      },

      // Global parameters
      globalParameters: {
        sensitivity: 1.0,
        speed: 1.0,
        colorTheme: 'rainbow' as ColorTheme,
        effectType: 'spectrum',
        masterOpacity: 1.0,
      },
      
      updateGlobalParameter: (parameter: string, value: any) => {
        set((state) => ({
          globalParameters: { ...state.globalParameters, [parameter]: value }
        }), false, 'updateGlobalParameter')
      },

      // Event emission (to be connected to global event bus)
      emitEvent: (event: ControllerEventType) => {
        // This will be connected to the global event bus
        console.log('Controller event:', event)
      },
    })),
    {
      name: 'vj-controller-store',
    }
  )
)

// React Context for providing the store
const ControllerContext = createContext<ReturnType<typeof useControllerStore> | null>(null)

export const ControllerProvider = ({ children }: { children: ReactNode }) => {
  const store = useControllerStore()
  
  return (
    <ControllerContext.Provider value={store}>
      {children}
    </ControllerContext.Provider>
  )
}

export const useController = () => {
  const context = useContext(ControllerContext)
  if (!context) {
    throw new Error('useController must be used within ControllerProvider')
  }
  return context
}

// Export the store hook for direct usage
export { useControllerStore }