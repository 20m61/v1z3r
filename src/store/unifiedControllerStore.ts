/**
 * Unified Controller Store
 * Centralized state management for the professional VJ controller
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuidv4 } from 'uuid';
import { 
  UnifiedControllerState, 
  ControllerActions, 
  LayerState, 
  Effect,
  PresetConfig,
  AudioConfig,
  BeatInfo,
  PerformanceMode
} from '../components/UnifiedController/types';

const DEFAULT_STATE: UnifiedControllerState = {
  // Global Controls
  masterIntensity: 1,
  crossfader: 0,
  
  // Layer Management
  layers: [],
  activeLayers: [],
  layerMixer: {
    crossfaderPosition: 0,
    masterIntensity: 1,
    audioGain: 1,
    outputMode: 'single'
  },
  
  // Effects
  globalEffects: {
    id: 'global',
    name: 'Global Effects',
    effects: [],
    bypass: false,
    wet: 1
  },
  layerEffects: {},
  
  // Audio
  audioConfig: {
    enabled: true,
    source: 'microphone',
    sensitivity: 0.7,
    frequencyBands: 32,
    smoothing: 0.8,
    beatDetection: true
  },
  audioReactivity: 0.5,
  
  // Performance
  performanceMode: 'balanced',
  fps: 60,
  gpuLoad: 0,
  
  // Presets
  savedPresets: [],
  
  // UI State
  expandedSections: ['layers', 'effects'],
  lockLayout: false,
  showAdvanced: false,
  
  // MIDI
  midiEnabled: false,
  midiMappings: {}
};

interface UnifiedControllerStore extends UnifiedControllerState, ControllerActions {}

export const useUnifiedControllerStore = create<UnifiedControllerStore>()(
  devtools(
    immer((set, get) => ({
      ...DEFAULT_STATE,

      // Master Controls
      setMasterIntensity: (value: number) => {
        set((state) => {
          state.masterIntensity = Math.max(0, Math.min(1, value));
        });
      },

      setCrossfader: (value: number) => {
        set((state) => {
          state.crossfader = Math.max(-1, Math.min(1, value));
        });
      },

      // Layer Actions
      addLayer: (layer: Omit<LayerState, 'id'>) => {
        set((state) => {
          const newLayer: LayerState = {
            ...layer,
            id: uuidv4()
          };
          state.layers.push(newLayer);
          state.activeLayers.push(newLayer.id);
          state.layerEffects[newLayer.id] = {
            id: `${newLayer.id}-effects`,
            name: `${newLayer.name} Effects`,
            effects: [],
            bypass: false,
            wet: 1
          };
        });
      },

      removeLayer: (layerId: string) => {
        set((state) => {
          state.layers = state.layers.filter((l: LayerState) => l.id !== layerId);
          state.activeLayers = state.activeLayers.filter((id: string) => id !== layerId);
          delete state.layerEffects[layerId];
        });
      },

      updateLayer: (layerId: string, updates: Partial<LayerState>) => {
        set((state) => {
          const layerIndex = state.layers.findIndex((l: LayerState) => l.id === layerId);
          if (layerIndex !== -1) {
            state.layers[layerIndex] = {
              ...state.layers[layerIndex],
              ...updates
            };
          }
        });
      },

      setLayerOrder: (layerIds: string[]) => {
        set((state) => {
          const layerMap = new Map(state.layers.map((l: LayerState) => [l.id, l]));
          state.layers = layerIds
            .map((id: string) => layerMap.get(id))
            .filter((layer): layer is LayerState => layer !== undefined);
        });
      },

      // Effect Actions
      addEffect: (chainId: string, effect: Effect) => {
        set((state) => {
          if (chainId === 'global') {
            state.globalEffects.effects.push(effect);
          } else if (state.layerEffects[chainId]) {
            state.layerEffects[chainId].effects.push(effect);
          }
        });
      },

      removeEffect: (chainId: string, effectId: string) => {
        set((state) => {
          if (chainId === 'global') {
            state.globalEffects.effects = state.globalEffects.effects
              .filter((e: Effect) => e.id !== effectId);
          } else if (state.layerEffects[chainId]) {
            state.layerEffects[chainId].effects = state.layerEffects[chainId].effects
              .filter((e: Effect) => e.id !== effectId);
          }
        });
      },

      updateEffect: (chainId: string, effectId: string, updates: Partial<Effect>) => {
        set((state) => {
          const updateEffectInChain = (effects: Effect[]) => {
            const effectIndex = effects.findIndex((e: Effect) => e.id === effectId);
            if (effectIndex !== -1) {
              effects[effectIndex] = {
                ...effects[effectIndex],
                ...updates
              };
            }
          };

          if (chainId === 'global') {
            updateEffectInChain(state.globalEffects.effects);
          } else if (state.layerEffects[chainId]) {
            updateEffectInChain(state.layerEffects[chainId].effects);
          }
        });
      },

      // Preset Actions
      loadPreset: (preset: PresetConfig) => {
        set((state) => {
          // Load layers
          state.layers = preset.layers.map((layer: any) => ({
            ...layer,
            id: uuidv4() // Generate new IDs to avoid conflicts
          }));
          state.activeLayers = state.layers.map((l: LayerState) => l.id);
          
          // Load effects
          preset.effects.forEach((chain, index) => {
            if (index === 0) {
              state.globalEffects = chain;
            }
          });
          
          // Load mixer settings
          state.layerMixer = preset.mixer;
          state.audioConfig = preset.audio;
          
          // Set as active preset
          state.activePreset = preset;
        });
      },

      savePreset: (name: string) => {
        set((state) => {
          const preset: PresetConfig = {
            id: uuidv4(),
            name,
            layers: state.layers,
            effects: [state.globalEffects],
            mixer: state.layerMixer,
            audio: state.audioConfig,
            bpm: state.beatInfo?.bpm,
            tags: []
          };
          
          state.savedPresets.push(preset);
          state.activePreset = preset;
        });
      },

      transitionToPreset: (preset: PresetConfig, duration: number) => {
        set((state) => {
          state.presetTransition = {
            active: true,
            duration,
            easing: 'ease-in-out',
            progress: 0
          };
        });

        // Start transition animation
        const startTime = Date.now();
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          set((state) => {
            if (state.presetTransition) {
              state.presetTransition.progress = progress;
            }
          });

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            // Complete transition
            get().loadPreset(preset);
            set((state) => {
              state.presetTransition = undefined;
            });
          }
        };
        
        requestAnimationFrame(animate);
      },

      // Audio Actions
      updateAudioConfig: (config: Partial<AudioConfig>) => {
        set((state) => {
          state.audioConfig = {
            ...state.audioConfig,
            ...config
          };
        });
      },

      setBeatInfo: (beatInfo: BeatInfo) => {
        set((state) => {
          state.beatInfo = beatInfo;
        });
      },

      // Performance Actions
      setPerformanceMode: (mode: PerformanceMode) => {
        set((state) => {
          state.performanceMode = mode;
          
          // Adjust quality settings based on mode
          switch (mode) {
            case 'quality':
              // Maximum quality settings
              break;
            case 'balanced':
              // Balanced settings
              break;
            case 'performance':
              // Performance optimized settings
              break;
          }
        });
      },

      // UI Actions
      toggleSection: (section: string) => {
        set((state) => {
          const index = state.expandedSections.indexOf(section);
          if (index === -1) {
            state.expandedSections.push(section);
          } else {
            state.expandedSections.splice(index, 1);
          }
        });
      },

      setLockLayout: (locked: boolean) => {
        set((state) => {
          state.lockLayout = locked;
        });
      },

      setShowAdvanced: (show: boolean) => {
        set((state) => {
          state.showAdvanced = show;
        });
      }
    })),
    {
      name: 'unified-controller-store'
    }
  )
);

// Selector hooks for optimized re-renders
export const useLayersState = () => useUnifiedControllerStore(state => ({
  layers: state.layers,
  activeLayers: state.activeLayers,
  addLayer: state.addLayer,
  updateLayer: state.updateLayer,
  setLayerOrder: state.setLayerOrder
}));

export const useEffectsState = () => useUnifiedControllerStore(state => ({
  globalEffects: state.globalEffects,
  layerEffects: state.layerEffects,
  addEffect: state.addEffect,
  removeEffect: state.removeEffect,
  updateEffect: state.updateEffect
}));

export const useAudioState = () => useUnifiedControllerStore(state => ({
  audioConfig: state.audioConfig,
  audioReactivity: state.audioReactivity,
  beatInfo: state.beatInfo,
  updateAudioConfig: state.updateAudioConfig,
  setBeatInfo: state.setBeatInfo
}));

export const useMasterControls = () => useUnifiedControllerStore(state => ({
  masterIntensity: state.masterIntensity,
  crossfader: state.crossfader,
  setMasterIntensity: state.setMasterIntensity,
  setCrossfader: state.setCrossfader
}));