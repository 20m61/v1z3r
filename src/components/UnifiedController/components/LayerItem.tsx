/**
 * Layer Item Component
 * Individual layer control in the layer list
 */

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LayerState } from '../types';
import styles from './LayerItem.module.css';

interface LayerItemProps {
  layer: LayerState;
  index: number;
  isActive: boolean;
  onUpdate: (updates: Partial<LayerState>) => void;
}

export const LayerItem: React.FC<LayerItemProps> = ({
  layer,
  index,
  isActive,
  onUpdate
}) => {
  return (
    <div
      className={`${styles.layerItem} ${isActive ? styles.active : ''} ${layer.locked ? styles.locked : ''}`}
    >
      <div className={styles.dragHandle}>
        ⋮⋮
      </div>

      <button
        className={`${styles.visibilityToggle} ${layer.active ? styles.visible : ''}`}
        onClick={() => onUpdate({ active: !layer.active })}
        title={layer.active ? 'Hide' : 'Show'}
      >
        {layer.active ? '👁' : '—'}
      </button>

      <span className={styles.layerNumber}>{index + 1}</span>
      
      <span className={styles.layerName}>{layer.name}</span>

      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={layer.opacity}
        onChange={(e) => onUpdate({ opacity: parseFloat(e.target.value) })}
        className={styles.opacitySlider}
        disabled={!layer.active}
      />

      <span className={styles.opacityValue}>
        {Math.round(layer.opacity * 100)}%
      </span>

      <select
        value={layer.blendMode}
        onChange={(e) => onUpdate({ blendMode: e.target.value as any })}
        className={styles.blendModeSelect}
        disabled={!layer.active}
      >
        <option value="normal">Normal</option>
        <option value="add">Add</option>
        <option value="multiply">Multiply</option>
        <option value="screen">Screen</option>
        <option value="overlay">Overlay</option>
      </select>

      <button
        className={styles.lockToggle}
        onClick={() => onUpdate({ locked: !layer.locked })}
        title={layer.locked ? 'Unlock' : 'Lock'}
      >
        {layer.locked ? '🔒' : '🔓'}
      </button>
    </div>
  );
};