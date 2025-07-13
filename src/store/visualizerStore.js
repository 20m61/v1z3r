"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useVisualizerStore = void 0;
const zustand_1 = require("zustand");
exports.useVisualizerStore = (0, zustand_1.create)((set, get) => ({
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
    // MIDI関連の初期状態
    isMIDIEnabled: false,
    midiMappings: [],
    activeMIDIDeviceId: null,
    lastMIDIMessage: null,
    // 歌詞認識関連の初期状態
    isLyricsEnabled: false,
    currentLyrics: "",
    nextLyrics: "",
    lyricsHistory: [],
    lyricsConfidence: 0,
    lyricsFont: 'teko',
    lyricsAnimation: 'glow',
    lyricsColor: '#ffffff',
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
        if (layers.length <= 1)
            return;
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
            layers: layers.map(layer => layer.id === id
                ? { ...layer, ...updates }
                : layer)
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
        const { currentEffectType, colorTheme, sensitivity, layers } = get();
        const newPreset = {
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
        if (!preset)
            return;
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
    // 歌詞関連のアクション
    setLyricsEnabled: (enabled) => set({ isLyricsEnabled: enabled }),
    updateCurrentLyrics: (text, confidence = 0) => {
        // 空の場合は更新しない
        if (!text.trim())
            return;
        const currentTime = Date.now();
        const newLyricsLine = {
            id: `lyrics-${currentTime}`,
            text,
            timestamp: currentTime,
            confidence
        };
        // 重複しないように同じ内容の歌詞は追加しない
        const { lyricsHistory, currentLyrics } = get();
        if (currentLyrics === text)
            return;
        // 履歴に追加して、最大50個まで保持
        const updatedHistory = [newLyricsLine, ...lyricsHistory].slice(0, 50);
        set({
            currentLyrics: text,
            lyricsHistory: updatedHistory,
            lyricsConfidence: confidence
        });
    },
    updateNextLyrics: (text) => set({ nextLyrics: text }),
    setLyricsFont: (font) => set({ lyricsFont: font }),
    setLyricsAnimation: (animation) => set({ lyricsAnimation: animation }),
    setLyricsColor: (color) => set({ lyricsColor: color }),
    clearLyricsHistory: () => set({ lyricsHistory: [], currentLyrics: "", nextLyrics: "" }),
    // その他の機能トグル
    toggleCamera: () => set(state => ({ isCameraEnabled: !state.isCameraEnabled })),
    toggleFullscreen: () => set(state => ({ isFullscreen: !state.isFullscreen })),
    // MIDI関連のアクション
    setMIDIEnabled: (enabled) => set({ isMIDIEnabled: enabled }),
    setActiveMIDIDevice: (deviceId) => set({ activeMIDIDeviceId: deviceId }),
    processMIDIMessage: (message) => {
        const { midiMappings } = get();
        // Store the last MIDI message
        set({ lastMIDIMessage: message });
        // Process active mappings
        const activeMappings = midiMappings.filter(mapping => mapping.enabled &&
            mapping.midiChannel === message.channel);
        activeMappings.forEach(mapping => {
            let shouldTrigger = false;
            let value = 0;
            switch (mapping.type) {
                case 'note':
                    shouldTrigger = (message.type === 0x90 || message.type === 0x80) &&
                        message.data1 === mapping.midiNumber;
                    value = message.type === 0x90 ? message.data2 / 127 : 0; // Note velocity or 0 for note off
                    break;
                case 'cc':
                    shouldTrigger = message.type === 0xB0 && message.data1 === mapping.midiNumber;
                    value = message.data2 / 127;
                    break;
                case 'pitch_bend':
                    shouldTrigger = message.type === 0xE0;
                    value = ((message.data2 << 7) + message.data1 - 8192) / 8192; // Convert 14-bit to -1 to 1
                    break;
            }
            if (shouldTrigger) {
                // Apply curve transformation
                let transformedValue = value;
                switch (mapping.curve) {
                    case 'exponential':
                        transformedValue = Math.pow(value, 2);
                        break;
                    case 'logarithmic':
                        transformedValue = Math.sqrt(value);
                        break;
                    // 'linear' uses value as-is
                }
                // Scale to target range
                const scaledValue = mapping.minValue +
                    (transformedValue * (mapping.maxValue - mapping.minValue));
                // Apply to target parameter
                const { setColorTheme, setSensitivity, updateLayer } = get();
                switch (mapping.targetParameter) {
                    case 'sensitivity':
                        setSensitivity(scaledValue);
                        break;
                    case 'hue':
                        // Convert to hex color (simple hue rotation)
                        const hue = Math.floor(scaledValue * 360);
                        setColorTheme(`hsl(${hue}, 70%, 50%)`);
                        break;
                    case 'layer_opacity':
                        const activeLayerId = get().activeLayerId;
                        if (activeLayerId) {
                            updateLayer(activeLayerId, { opacity: scaledValue });
                        }
                        break;
                }
            }
        });
    },
    addMIDIMapping: (mapping) => {
        const newMapping = {
            ...mapping,
            id: `midi-mapping-${Date.now()}`,
        };
        set(state => ({
            midiMappings: [...state.midiMappings, newMapping]
        }));
    },
    removeMIDIMapping: (id) => {
        set(state => ({
            midiMappings: state.midiMappings.filter(mapping => mapping.id !== id)
        }));
    },
    updateMIDIMapping: (id, updates) => {
        set(state => ({
            midiMappings: state.midiMappings.map(mapping => mapping.id === id ? { ...mapping, ...updates } : mapping)
        }));
    },
    toggleMIDIMapping: (id) => {
        set(state => ({
            midiMappings: state.midiMappings.map(mapping => mapping.id === id ? { ...mapping, enabled: !mapping.enabled } : mapping)
        }));
    }
}));
