import { create } from 'zustand';

export type EffectType = 'waveform' | 'particles' | 'spectrum' | 'lyrics' | 'camera';
export type PresetType = {
  id: string;
  name: string;
  effectType: EffectType;
  colorTheme: string;
  sensitivity: number;
  layers: LayerType[];
};

export type LayerType = {
  id: string;
  type: EffectType;
  active: boolean;
  opacity: number;
  colorTheme: string;
  sensitivity: number;
  zIndex: number;
};

interface VisualizerState {
  // 現在のエフェクト設定
  currentEffectType: EffectType;
  colorTheme: string;
  sensitivity: number;
  isAudioAnalyzing: boolean;
  isMicrophoneEnabled: boolean;
  
  // レイヤー管理
  layers: LayerType[];
  activeLayerId: string | null;
  
  // プリセット管理
  presets: PresetType[];
  currentPresetId: string | null;
  
  // 機能フラグ
  isCameraEnabled: boolean;
  isFullscreen: boolean;
  
  // アクション
  setEffectType: (type: EffectType) => void;
  setColorTheme: (color: string) => void;
  setSensitivity: (value: number) => void;
  setAudioAnalyzing: (isAnalyzing: boolean) => void;
  setMicrophoneEnabled: (enabled: boolean) => void;
  
  // レイヤー操作
  addLayer: (layer: Omit<LayerType, 'id' | 'zIndex'>) => void;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, updates: Partial<Omit<LayerType, 'id'>>) => void;
  setActiveLayer: (id: string | null) => void;
  reorderLayers: (orderedIds: string[]) => void;
  
  // プリセット操作
  savePreset: (name: string) => void;
  loadPreset: (id: string) => void;
  deletePreset: (id: string) => void;
  
  // その他の機能トグル
  toggleCamera: () => void;
  toggleFullscreen: () => void;
}

export const useVisualizerStore = create<VisualizerState>((set, get) => ({
  // 初期状態
  currentEffectType: 'spectrum',
  colorTheme: '#00ccff',
  sensitivity: 1.0,
  isAudioAnalyzing: false,
  isMicrophoneEnabled: false,
  
  layers: [
    {
      id: 'default-layer',
      type: 'spectrum',
      active: true,
      opacity: 1,
      colorTheme: '#00ccff',
      sensitivity: 1.0,
      zIndex: 0
    }
  ],
  activeLayerId: 'default-layer',
  
  presets: [],
  currentPresetId: null,
  
  isCameraEnabled: false,
  isFullscreen: false,
  
  // アクション
  setEffectType: (type) => set({ currentEffectType: type }),
  
  setColorTheme: (color) => set({ colorTheme: color }),
  
  setSensitivity: (value) => set({ sensitivity: value }),
  
  setAudioAnalyzing: (isAnalyzing) => set({ isAudioAnalyzing: isAnalyzing }),
  
  setMicrophoneEnabled: (enabled) => set({ isMicrophoneEnabled: enabled }),
  
  // レイヤー操作
  addLayer: (layer) => {
    const layers = get().layers;
    const newLayer = { 
      ...layer, 
      id: `layer-${Date.now()}`, 
      zIndex: Math.max(...layers.map(l => l.zIndex), 0) + 1 
    };
    
    set({ 
      layers: [...layers, newLayer],
      activeLayerId: newLayer.id
    });
  },
  
  removeLayer: (id) => {
    const layers = get().layers;
    const activeId = get().activeLayerId;
    
    // レイヤーが1つしかない場合は削除しない
    if (layers.length <= 1) return;
    
    const filteredLayers = layers.filter(layer => layer.id !== id);
    
    set({ 
      layers: filteredLayers,
      // 削除したレイヤーがアクティブだった場合、他のレイヤーをアクティブにする
      activeLayerId: id === activeId ? filteredLayers[0]?.id || null : activeId
    });
  },
  
  updateLayer: (id, updates) => {
    const layers = get().layers;
    
    set({
      layers: layers.map(layer => 
        layer.id === id 
          ? { ...layer, ...updates } 
          : layer
      )
    });
  },
  
  setActiveLayer: (id) => set({ activeLayerId: id }),
  
  reorderLayers: (orderedIds) => {
    const layers = get().layers;
    
    // IDの順序に基づいてzIndexを更新
    const updatedLayers = [...layers];
    orderedIds.forEach((id, index) => {
      const layerIndex = updatedLayers.findIndex(l => l.id === id);
      if (layerIndex !== -1) {
        updatedLayers[layerIndex] = {
          ...updatedLayers[layerIndex],
          zIndex: orderedIds.length - index - 1 // トップが最大値になるように反転
        };
      }
    });
    
    set({ layers: updatedLayers });
  },
  
  // プリセット操作
  savePreset: (name) => {
    const { 
      currentEffectType, 
      colorTheme, 
      sensitivity, 
      layers 
    } = get();
    
    const newPreset: PresetType = {
      id: `preset-${Date.now()}`,
      name,
      effectType: currentEffectType,
      colorTheme,
      sensitivity,
      layers: [...layers]
    };
    
    const presets = [...get().presets, newPreset];
    
    set({ 
      presets,
      currentPresetId: newPreset.id
    });
  },
  
  loadPreset: (id) => {
    const preset = get().presets.find(p => p.id === id);
    if (!preset) return;
    
    set({
      currentEffectType: preset.effectType,
      colorTheme: preset.colorTheme,
      sensitivity: preset.sensitivity,
      layers: [...preset.layers],
      currentPresetId: id
    });
  },
  
  deletePreset: (id) => {
    const presets = get().presets.filter(p => p.id !== id);
    const currentId = get().currentPresetId;
    
    set({ 
      presets,
      // 現在のプリセットが削除された場合、選択を解除
      currentPresetId: id === currentId ? null : currentId
    });
  },
  
  // その他の機能トグル
  toggleCamera: () => set(state => ({ isCameraEnabled: !state.isCameraEnabled })),
  
  toggleFullscreen: () => set(state => ({ isFullscreen: !state.isFullscreen }))
}));
