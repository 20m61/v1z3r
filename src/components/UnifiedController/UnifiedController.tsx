/**
 * Unified Controller Component
 * Professional VJ control interface with optimized layout for live performance
 */

import React, { useEffect, useState } from 'react';
import { useUnifiedControllerStore } from '../../store/unifiedControllerStore';
import { MasterSection } from './sections/MasterSection';
import { LayerSection } from './sections/LayerSection';
import { EffectsSection } from './sections/EffectsSection';
import { AudioSection } from './sections/AudioSection';
import { PresetSection } from './sections/PresetSection';
import { PerformanceSection } from './sections/PerformanceSection';
import { UnifiedControllerProps } from './types';
import styles from './UnifiedController.module.css';

export const UnifiedController: React.FC<UnifiedControllerProps> = ({
  className,
  onStateChange,
  initialState,
  midiEnabled = false,
  showPerformanceMetrics = true
}) => {
  const state = useUnifiedControllerStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'main' | 'effects' | 'presets'>('main');

  // Initialize with provided state
  useEffect(() => {
    if (initialState) {
      // Apply initial state values directly
      // Note: For now, we'll handle specific initializations
      // In a real implementation, we'd use the store's setState method
    }
  }, []);

  // Notify parent of state changes
  useEffect(() => {
    if (onStateChange) {
      const unsubscribe = useUnifiedControllerStore.subscribe((state) => {
        onStateChange(state);
      });
      return unsubscribe;
    }
  }, [onStateChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (state.lockLayout) return;

      // Space - Play/Pause toggle
      if (e.code === 'Space' && !(e.target instanceof Element && e.target.matches('input, textarea'))) {
        e.preventDefault();
        state.setMasterIntensity(state.masterIntensity > 0 ? 0 : 1);
      }

      // Tab - Switch tabs
      if (e.code === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const tabs: Array<'main' | 'effects' | 'presets'> = ['main', 'effects', 'presets'];
        const currentIndex = tabs.indexOf(activeTab);
        setActiveTab(tabs[(currentIndex + 1) % tabs.length]);
      }

      // F - Fullscreen toggle
      if (e.code === 'KeyF' && e.ctrlKey) {
        e.preventDefault();
        toggleFullscreen();
      }

      // Number keys 1-9 - Layer shortcuts
      if (e.code.startsWith('Digit') && !e.ctrlKey && !e.altKey) {
        const layerIndex = parseInt(e.code.replace('Digit', '')) - 1;
        if (state.layers[layerIndex]) {
          const layer = state.layers[layerIndex];
          state.updateLayer(layer.id, { active: !layer.active });
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [state, activeTab]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className={`${styles.container} ${className || ''} ${isFullscreen ? styles.fullscreen : ''}`}>
      {/* Header Bar */}
      <div className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoText}>V1Z3R</span>
          <span className={styles.version}>Pro Controller</span>
        </div>

        <div className={styles.tabs}>
          <button 
            className={`${styles.tab} ${activeTab === 'main' ? styles.active : ''}`}
            onClick={() => setActiveTab('main')}
          >
            Main
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'effects' ? styles.active : ''}`}
            onClick={() => setActiveTab('effects')}
          >
            Effects
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'presets' ? styles.active : ''}`}
            onClick={() => setActiveTab('presets')}
          >
            Presets
          </button>
        </div>

        <div className={styles.headerControls}>
          {showPerformanceMetrics && (
            <div className={styles.metrics}>
              <span>FPS: {state.fps}</span>
              <span>GPU: {Math.round(state.gpuLoad * 100)}%</span>
            </div>
          )}
          <button 
            className={styles.lockButton}
            onClick={() => state.setLockLayout(!state.lockLayout)}
            title={state.lockLayout ? 'Unlock Layout' : 'Lock Layout'}
          >
            {state.lockLayout ? '🔒' : '🔓'}
          </button>
          <button 
            className={styles.fullscreenButton}
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? '⤦' : '⤢'}
          </button>
        </div>
      </div>

      {/* Master Controls - Always Visible */}
      <MasterSection />

      {/* Tab Content */}
      <div className={styles.content}>
        {activeTab === 'main' && (
          <div className={styles.mainTab}>
            <div className={styles.leftPanel}>
              <LayerSection />
            </div>
            <div className={styles.rightPanel}>
              <AudioSection />
              {showPerformanceMetrics && <PerformanceSection />}
            </div>
          </div>
        )}

        {activeTab === 'effects' && (
          <div className={styles.effectsTab}>
            <EffectsSection />
          </div>
        )}

        {activeTab === 'presets' && (
          <div className={styles.presetsTab}>
            <PresetSection />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className={styles.statusBar}>
        <div className={styles.statusLeft}>
          {state.beatInfo && (
            <span className={styles.bpmIndicator}>
              BPM: {state.beatInfo.bpm.toFixed(1)} 
              {state.beatInfo.confidence > 0.8 && ' 🎵'}
            </span>
          )}
          {state.activePreset && (
            <span className={styles.presetName}>
              Preset: {state.activePreset.name}
            </span>
          )}
        </div>
        <div className={styles.statusRight}>
          {midiEnabled && (
            <span className={styles.midiStatus}>
              MIDI {state.midiEnabled ? '🟢' : '⚫'}
            </span>
          )}
          <span className={styles.performanceMode}>
            Mode: {state.performanceMode}
          </span>
        </div>
      </div>
    </div>
  );
};