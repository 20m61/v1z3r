/**
 * Master Section Component
 * Global controls for intensity and crossfading
 */

import React, { useCallback } from 'react';
import { useMasterControls } from '../../../store/unifiedControllerStore';
import styles from './MasterSection.module.css';

export const MasterSection: React.FC = () => {
  const { 
    masterIntensity, 
    crossfader, 
    setMasterIntensity, 
    setCrossfader 
  } = useMasterControls();

  const handleIntensityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMasterIntensity(parseFloat(e.target.value));
  }, [setMasterIntensity]);

  const handleCrossfaderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCrossfader(parseFloat(e.target.value));
  }, [setCrossfader]);

  const handleIntensityClick = useCallback((value: number) => {
    setMasterIntensity(value);
  }, [setMasterIntensity]);

  const handleCrossfaderCenter = useCallback(() => {
    setCrossfader(0);
  }, [setCrossfader]);

  return (
    <div className={styles.masterSection}>
      {/* Master Intensity */}
      <div className={styles.intensityControl}>
        <label className={styles.label}>MASTER</label>
        <div className={styles.intensityWrapper}>
          <div className={styles.intensityMeter}>
            <div 
              className={styles.intensityFill}
              style={{ height: `${masterIntensity * 100}%` }}
            />
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={masterIntensity}
            onChange={handleIntensityChange}
            className={styles.intensitySlider}
          />
        </div>
        <div className={styles.intensityValue}>
          {Math.round(masterIntensity * 100)}%
        </div>
        <div className={styles.quickButtons}>
          <button 
            className={styles.quickButton}
            onClick={() => handleIntensityClick(0)}
            title="Blackout"
          >
            0
          </button>
          <button 
            className={styles.quickButton}
            onClick={() => handleIntensityClick(0.5)}
            title="50%"
          >
            50
          </button>
          <button 
            className={styles.quickButton}
            onClick={() => handleIntensityClick(1)}
            title="Full"
          >
            100
          </button>
        </div>
      </div>

      {/* Crossfader */}
      <div className={styles.crossfaderControl}>
        <div className={styles.crossfaderLabels}>
          <span className={styles.channelLabel}>A</span>
          <label className={styles.label}>CROSSFADER</label>
          <span className={styles.channelLabel}>B</span>
        </div>
        <div className={styles.crossfaderWrapper}>
          <div className={styles.crossfaderTrack}>
            <div 
              className={styles.crossfaderIndicator}
              style={{ left: `${(crossfader + 1) * 50}%` }}
            />
          </div>
          <input
            type="range"
            min="-1"
            max="1"
            step="0.01"
            value={crossfader}
            onChange={handleCrossfaderChange}
            className={styles.crossfaderSlider}
          />
        </div>
        <button 
          className={styles.centerButton}
          onClick={handleCrossfaderCenter}
          title="Center"
        >
          CENTER
        </button>
      </div>

      {/* Visual Indicators */}
      <div className={styles.indicators}>
        <div 
          className={`${styles.channelIndicator} ${crossfader <= 0 ? styles.active : ''}`}
          style={{ opacity: 1 - (crossfader + 1) / 2 }}
        >
          <span>A</span>
        </div>
        <div className={styles.mixIndicator}>
          {crossfader === 0 ? 'MIX' : ''}
        </div>
        <div 
          className={`${styles.channelIndicator} ${crossfader >= 0 ? styles.active : ''}`}
          style={{ opacity: (crossfader + 1) / 2 }}
        >
          <span>B</span>
        </div>
      </div>
    </div>
  );
};