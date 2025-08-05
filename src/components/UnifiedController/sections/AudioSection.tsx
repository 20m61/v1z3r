/**
 * Audio Section Component
 * Audio reactivity controls
 */

import React from 'react';
import { useAudioState } from '../../../store/unifiedControllerStore';
import styles from './AudioSection.module.css';

export const AudioSection: React.FC = () => {
  const { audioConfig, beatInfo, updateAudioConfig } = useAudioState();

  return (
    <div className={styles.audioSection}>
      <h3 className={styles.title}>Audio</h3>
      
      {beatInfo && (
        <div className={styles.beatInfo}>
          <div className={styles.bpmDisplay}>
            <span className={styles.bpmValue}>{beatInfo.bpm.toFixed(1)}</span>
            <span className={styles.bpmLabel}>BPM</span>
          </div>
          <div className={styles.beatIndicator}>
            <div className={styles.beatDot} />
          </div>
        </div>
      )}

      <div className={styles.controls}>
        <div className={styles.control}>
          <label>Sensitivity</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={audioConfig.sensitivity}
            onChange={(e) => updateAudioConfig({ sensitivity: parseFloat(e.target.value) })}
            className={styles.slider}
          />
        </div>

        <div className={styles.control}>
          <label>Smoothing</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={audioConfig.smoothing}
            onChange={(e) => updateAudioConfig({ smoothing: parseFloat(e.target.value) })}
            className={styles.slider}
          />
        </div>
      </div>

      <div className={styles.sourceSelect}>
        <label>Source</label>
        <select 
          value={audioConfig.source}
          onChange={(e) => updateAudioConfig({ source: e.target.value as any })}
          className={styles.select}
        >
          <option value="microphone">Microphone</option>
          <option value="system">System Audio</option>
          <option value="file">File</option>
        </select>
      </div>
    </div>
  );
};