/**
 * Layer Section Component
 * Layer management interface for VJ performance
 */

import React, { useCallback } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useLayersState } from '../../../store/unifiedControllerStore';
import { LayerItem } from '../components/LayerItem';
import { BlendMode } from '../types';
import styles from './LayerSection.module.css';

export const LayerSection: React.FC = () => {
  const { layers, activeLayers, addLayer, updateLayer, setLayerOrder } = useLayersState();

  const handleAddLayer = useCallback(() => {
    const newLayer = {
      name: `Layer ${layers.length + 1}`,
      active: true,
      opacity: 1,
      blendMode: 'normal' as BlendMode,
      effects: [],
      audioReactivity: 0.5,
      locked: false
    };
    
    addLayer(newLayer);
  }, [layers.length, addLayer]);

  return (
    <div className={styles.layerSection}>
      <div className={styles.header}>
        <h2 className={styles.title}>Layers</h2>
        <button 
          className={styles.addButton}
          onClick={handleAddLayer}
          title="Add Layer"
        >
          +
        </button>
      </div>

      <div className={styles.layerList}>
        {layers.map((layer, index) => (
          <LayerItem
            key={layer.id}
            layer={layer}
            index={index}
            isActive={activeLayers.includes(layer.id)}
            onUpdate={(updates) => updateLayer(layer.id, updates)}
          />
        ))}

        {layers.length === 0 && (
          <div className={styles.emptyState}>
            <p>No layers yet</p>
            <button 
              className={styles.createButton}
              onClick={handleAddLayer}
            >
              Create First Layer
            </button>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <div className={styles.stats}>
          <span>{layers.length} layers</span>
          <span>{activeLayers.length} active</span>
        </div>
      </div>
    </div>
  );
};