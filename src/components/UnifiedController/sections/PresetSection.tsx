/**
 * Preset Section Component
 * Preset management and switching
 */

import React from 'react';
import { useUnifiedControllerStore } from '../../../store/unifiedControllerStore';
import styles from './PresetSection.module.css';

export const PresetSection: React.FC = () => {
  const { savedPresets, activePreset, loadPreset, savePreset } = useUnifiedControllerStore();

  return (
    <div className={styles.presetSection}>
      <h2 className={styles.title}>Presets</h2>
      
      <div className={styles.presetGrid}>
        {savedPresets.map(preset => (
          <button
            key={preset.id}
            className={`${styles.presetButton} ${activePreset?.id === preset.id ? styles.active : ''}`}
            onClick={() => loadPreset(preset)}
          >
            <span className={styles.presetName}>{preset.name}</span>
            {preset.bpm && <span className={styles.presetBpm}>{preset.bpm} BPM</span>}
          </button>
        ))}
        
        <button 
          className={styles.addPresetButton}
          onClick={() => savePreset(`Preset ${savedPresets.length + 1}`)}
        >
          + Save Current
        </button>
      </div>
    </div>
  );
};