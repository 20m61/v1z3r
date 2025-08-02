/**
 * Performance Section Component
 * Performance monitoring and optimization controls
 */

import React from 'react';
import { useUnifiedControllerStore } from '../../../store/unifiedControllerStore';
import styles from './PerformanceSection.module.css';

export const PerformanceSection: React.FC = () => {
  const { performanceMode, fps, gpuLoad, setPerformanceMode } = useUnifiedControllerStore();

  return (
    <div className={styles.performanceSection}>
      <h3 className={styles.title}>Performance</h3>
      
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>FPS</span>
          <span className={styles.metricValue}>{fps}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>GPU</span>
          <span className={styles.metricValue}>{Math.round(gpuLoad * 100)}%</span>
        </div>
      </div>

      <div className={styles.modeSelector}>
        <label className={styles.modeLabel}>Mode</label>
        <div className={styles.modeButtons}>
          {(['quality', 'balanced', 'performance'] as const).map(mode => (
            <button
              key={mode}
              className={`${styles.modeButton} ${performanceMode === mode ? styles.active : ''}`}
              onClick={() => setPerformanceMode(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};