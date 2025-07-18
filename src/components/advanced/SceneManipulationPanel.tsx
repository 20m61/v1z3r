/**
 * Scene Manipulation Panel Component
 * UI for 3D scene manipulation and object management
 */

import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SceneManipulationService, SceneObject, SceneManipulationConfig } from '@/services/scene/sceneManipulation';
import { errorHandler } from '@/utils/errorHandler';

interface SceneManipulationPanelProps {
  sceneService?: SceneManipulationService;
  onSceneUpdate?: (scene: THREE.Scene) => void;
  className?: string;
}

interface ObjectLibraryItem {
  key: string;
  name: string;
  type: string;
  preview: string;
  geometry: string;
  material: string;
}

export const SceneManipulationPanel: React.FC<SceneManipulationPanelProps> = ({
  sceneService,
  onSceneUpdate,
  className = '',
}) => {
  const [selectedObject, setSelectedObject] = useState<THREE.Object3D | null>(null);
  const [config, setConfig] = useState<SceneManipulationConfig>({
    enableGizmos: true,
    snapToGrid: false,
    gridSize: 1,
    transformMode: 'translate',
    coordinateSystem: 'world',
    animationEnabled: true,
    animationSpeed: 1.0,
  });
  const [metrics, setMetrics] = useState({
    objectCount: 0,
    polygonCount: 0,
    textureMemory: 0,
    drawCalls: 0,
    fps: 0,
  });
  const [objectLibrary, setObjectLibrary] = useState<ObjectLibraryItem[]>([]);
  const [sceneObjects, setSceneObjects] = useState<SceneObject[]>([]);
  const [activeTab, setActiveTab] = useState<'objects' | 'library' | 'properties'>('library');
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sceneService) return;

    // Initialize object library
    const library = sceneService.getObjectLibrary();
    const libraryItems: ObjectLibraryItem[] = [];
    
    library.forEach((object, key) => {
      const [geometry, material] = key.split('-');
      libraryItems.push({
        key,
        name: `${geometry} (${material})`,
        type: object.type,
        preview: `/icons/3d/${geometry}.svg`,
        geometry,
        material,
      });
    });
    
    setObjectLibrary(libraryItems);

    // Set up callbacks
    sceneService.setCallbacks({
      onObjectSelect: (object) => {
        setSelectedObject(object);
      },
      onObjectTransform: (object) => {
        // Update properties panel
        updateSceneObjects();
      },
      onSceneUpdate: (scene) => {
        updateSceneObjects();
        updateMetrics();
        onSceneUpdate?.(scene);
      },
    });

    // Initial updates
    updateSceneObjects();
    updateMetrics();

    // Set up metrics update interval
    const interval = setInterval(updateMetrics, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [sceneService, updateMetrics, updateSceneObjects, onSceneUpdate]);

  const updateSceneObjects = () => {
    if (!sceneService) return;
    setSceneObjects(sceneService.exportScene());
  };

  const updateMetrics = () => {
    if (!sceneService) return;
    setMetrics(sceneService.getMetrics());
  };

  const handleConfigChange = (newConfig: Partial<SceneManipulationConfig>) => {
    if (!sceneService) return;
    
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);
    sceneService.setConfig(updatedConfig);
  };

  const handleAddObject = (libraryKey: string) => {
    if (!sceneService) return;
    
    const position = new THREE.Vector3(
      (Math.random() - 0.5) * 10,
      Math.random() * 5,
      (Math.random() - 0.5) * 10
    );
    
    const object = sceneService.addObjectToScene(libraryKey, position);
    if (object) {
      sceneService.selectObject(object);
      errorHandler.info(`Added ${libraryKey} to scene`);
    }
  };

  const handleDeleteObject = (objectId: string) => {
    if (!sceneService) return;
    
    const objectToDelete = sceneObjects.find(obj => obj.id === objectId);
    if (objectToDelete) {
      // Find the actual THREE.Object3D in the scene
      sceneService.deleteSelectedObject();
    }
  };

  const handleTransformModeChange = (mode: SceneManipulationConfig['transformMode']) => {
    if (!sceneService) return;
    sceneService.setTransformMode(mode);
    handleConfigChange({ transformMode: mode });
  };

  const handleCoordinateSystemChange = (system: SceneManipulationConfig['coordinateSystem']) => {
    if (!sceneService) return;
    sceneService.setCoordinateSystem(system);
    handleConfigChange({ coordinateSystem: system });
  };

  const handleGridSnapToggle = () => {
    if (!sceneService) return;
    sceneService.toggleGridSnap();
    handleConfigChange({ snapToGrid: !config.snapToGrid });
  };

  const handleClearScene = () => {
    if (!sceneService) return;
    if (window.confirm('Are you sure you want to clear the entire scene?')) {
      sceneService.clearScene();
      errorHandler.info('Scene cleared');
    }
  };

  const handleExportScene = () => {
    if (!sceneService) return;
    
    const sceneData = sceneService.exportScene();
    const blob = new Blob([JSON.stringify(sceneData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scene_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    errorHandler.info('Scene exported');
  };

  const handleImportScene = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !sceneService) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const sceneData = JSON.parse(e.target?.result as string);
        sceneService.importScene(sceneData);
        errorHandler.info('Scene imported');
      } catch (error) {
        errorHandler.error('Failed to import scene', error as Error);
      }
    };
    reader.readAsText(file);
  };

  const renderLibraryTab = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {objectLibrary.map((item) => (
          <button
            key={item.key}
            onClick={() => handleAddObject(item.key)}
            className="p-3 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-600 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center">
                <span className="text-xs font-mono">{item.geometry[0].toUpperCase()}</span>
              </div>
              <div>
                <div className="text-sm font-medium text-white">{item.geometry}</div>
                <div className="text-xs text-gray-400">{item.material}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
      
      <div className="border-t border-gray-700 pt-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Special Objects</h4>
        <div className="grid grid-cols-2 gap-3">
          {['ambient-light', 'directional-light', 'point-light', 'spot-light'].map((lightType) => (
            <button
              key={lightType}
              onClick={() => handleAddObject(lightType)}
              className="p-3 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-600 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-yellow-600 rounded flex items-center justify-center">
                  <span className="text-xs">💡</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-white">
                    {lightType.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                  </div>
                  <div className="text-xs text-gray-400">Light</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderObjectsTab = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-300">
          Objects ({sceneObjects.length})
        </span>
        <button
          onClick={handleClearScene}
          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
        >
          Clear All
        </button>
      </div>
      
      <div className="max-h-64 overflow-y-auto space-y-2">
        {sceneObjects.map((object, index) => (
          <div
            key={object.id}
            className={`p-3 rounded-lg border transition-colors ${
              selectedObject?.userData.id === object.id
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-gray-700 rounded flex items-center justify-center">
                  <span className="text-xs">{object.geometry[0].toUpperCase()}</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{object.name}</div>
                  <div className="text-xs text-gray-400">{object.type}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => object.visible = !object.visible}
                  className={`text-xs px-2 py-1 rounded ${
                    object.visible ? 'bg-green-600' : 'bg-gray-600'
                  }`}
                >
                  {object.visible ? '👁️' : '🙈'}
                </button>
                <button
                  onClick={() => handleDeleteObject(object.id)}
                  className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPropertiesTab = () => (
    <div className="space-y-4">
      {selectedObject ? (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3">
            Selected: {selectedObject.name || 'Unnamed Object'}
          </h4>
          
          <div className="space-y-4">
            {/* Transform */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Position</label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={selectedObject.position.x.toFixed(2)}
                  onChange={(e) => {
                    selectedObject.position.x = parseFloat(e.target.value);
                  }}
                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs"
                />
                <input
                  type="number"
                  step="0.1"
                  value={selectedObject.position.y.toFixed(2)}
                  onChange={(e) => {
                    selectedObject.position.y = parseFloat(e.target.value);
                  }}
                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs"
                />
                <input
                  type="number"
                  step="0.1"
                  value={selectedObject.position.z.toFixed(2)}
                  onChange={(e) => {
                    selectedObject.position.z = parseFloat(e.target.value);
                  }}
                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs"
                />
              </div>
            </div>

            {/* Rotation */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Rotation (degrees)</label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  step="1"
                  value={THREE.MathUtils.radToDeg(selectedObject.rotation.x).toFixed(0)}
                  onChange={(e) => {
                    selectedObject.rotation.x = THREE.MathUtils.degToRad(parseFloat(e.target.value));
                  }}
                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs"
                />
                <input
                  type="number"
                  step="1"
                  value={THREE.MathUtils.radToDeg(selectedObject.rotation.y).toFixed(0)}
                  onChange={(e) => {
                    selectedObject.rotation.y = THREE.MathUtils.degToRad(parseFloat(e.target.value));
                  }}
                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs"
                />
                <input
                  type="number"
                  step="1"
                  value={THREE.MathUtils.radToDeg(selectedObject.rotation.z).toFixed(0)}
                  onChange={(e) => {
                    selectedObject.rotation.z = THREE.MathUtils.degToRad(parseFloat(e.target.value));
                  }}
                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs"
                />
              </div>
            </div>

            {/* Scale */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Scale</label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={selectedObject.scale.x.toFixed(2)}
                  onChange={(e) => {
                    selectedObject.scale.x = parseFloat(e.target.value);
                  }}
                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs"
                />
                <input
                  type="number"
                  step="0.1"
                  value={selectedObject.scale.y.toFixed(2)}
                  onChange={(e) => {
                    selectedObject.scale.y = parseFloat(e.target.value);
                  }}
                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs"
                />
                <input
                  type="number"
                  step="0.1"
                  value={selectedObject.scale.z.toFixed(2)}
                  onChange={(e) => {
                    selectedObject.scale.z = parseFloat(e.target.value);
                  }}
                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <span className="text-gray-400">No object selected</span>
        </div>
      )}
    </div>
  );

  return (
    <div className={`bg-gray-900 border border-gray-700 rounded-xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-2xl">🎭</span>
          3D Scene
        </h3>
        
        <div className="flex items-center gap-4">
          {/* Performance Metrics */}
          <div className="text-sm text-gray-400">
            <span className="font-mono">
              {metrics.objectCount} objects, {metrics.polygonCount} triangles
            </span>
          </div>
          
          {/* Import/Export */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportScene}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
            >
              Export
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
            >
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportScene}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Transform Controls */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Transform Controls</h4>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Transform Mode */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Mode</label>
            <div className="flex gap-1">
              {['translate', 'rotate', 'scale'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleTransformModeChange(mode as any)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    config.transformMode === mode
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Coordinate System */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Space</label>
            <div className="flex gap-1">
              {['world', 'local'].map((system) => (
                <button
                  key={system}
                  onClick={() => handleCoordinateSystemChange(system as any)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    config.coordinateSystem === system
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {system[0].toUpperCase() + system.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={config.snapToGrid}
              onChange={handleGridSnapToggle}
              className="rounded"
            />
            Snap to Grid
          </label>
          
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={config.enableGizmos}
              onChange={(e) => handleConfigChange({ enableGizmos: e.target.checked })}
              className="rounded"
            />
            Show Gizmos
          </label>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-4">
        {[
          { id: 'library', label: 'Library', icon: '📚' },
          { id: 'objects', label: 'Objects', icon: '🧊' },
          { id: 'properties', label: 'Properties', icon: '⚙️' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'library' && renderLibraryTab()}
        {activeTab === 'objects' && renderObjectsTab()}
        {activeTab === 'properties' && renderPropertiesTab()}
      </div>
    </div>
  );
};

export default SceneManipulationPanel;