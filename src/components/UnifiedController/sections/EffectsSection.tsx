/**
 * Effects Section Component
 * Effect chain management
 */

import React from 'react';
import { useEffectsState } from '../../../store/unifiedControllerStore';
import styles from './EffectsSection.module.css';

export const EffectsSection: React.FC = () => {
  const { globalEffects, layerEffects } = useEffectsState();

  return (
    <div className={styles.effectsSection}>
      <h2 className={styles.title}>Effects</h2>
      
      <div className={styles.globalEffects}>
        <h3>Global Effects</h3>
        <div className={styles.effectList}>
          {globalEffects.effects.map(effect => (
            <div key={effect.id} className={styles.effectItem}>
              <span>{effect.type}</span>
              <span className={styles.effectStatus}>
                {effect.enabled ? '●' : '○'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.layerEffects}>
        <h3>Layer Effects</h3>
        {Object.entries(layerEffects).map(([layerId, chain]) => (
          <div key={layerId} className={styles.layerEffectGroup}>
            <h4>{chain.name}</h4>
            <div className={styles.effectList}>
              {chain.effects.map(effect => (
                <div key={effect.id} className={styles.effectItem}>
                  <span>{effect.type}</span>
                  <span className={styles.effectStatus}>
                    {effect.enabled ? '●' : '○'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};