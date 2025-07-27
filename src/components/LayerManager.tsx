import React from 'react';
import { motion } from 'framer-motion';
import { FiEye, FiEyeOff, FiTrash, FiPlusCircle, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import { useVisualizerStore, LayerType, EffectType } from '@/store/visualizerStore';
import Button from './ui/Button';
import { Slider } from '@vj-app/ui-components';
import ColorPicker from './ui/ColorPicker';

interface LayerManagerProps {
  className?: string;
}

const effectTypeNames: Record<EffectType, string> = {
  spectrum: 'スペクトラム',
  waveform: '波形',
  particles: 'パーティクル',
  lyrics: '歌詞表示',
  camera: 'カメラ',
};

const LayerManager: React.FC<LayerManagerProps> = ({ className = '' }) => {
  const {
    layers,
    activeLayerId,
    addLayer,
    removeLayer,
    updateLayer,
    setActiveLayer,
    reorderLayers,
  } = useVisualizerStore();

  // 新しいレイヤーを追加
  const handleAddLayer = () => {
    addLayer({
      type: 'spectrum',
      active: true,
      opacity: 1,
      colorTheme: '#00ccff',
      sensitivity: 1.0,
    });
  };

  // レイヤーの可視性を切り替え
  const toggleLayerVisibility = (layerId: string, isActive: boolean) => {
    updateLayer(layerId, { active: !isActive });
  };

  // レイヤーを削除
  const handleRemoveLayer = (layerId: string) => {
    removeLayer(layerId);
  };

  // レイヤーを上へ移動
  const moveLayerUp = (layerId: string) => {
    const currentIndex = layers.findIndex(layer => layer.id === layerId);
    if (currentIndex > 0) {
      const newOrder = [...layers];
      const temp = newOrder[currentIndex];
      newOrder[currentIndex] = newOrder[currentIndex - 1];
      newOrder[currentIndex - 1] = temp;
      reorderLayers(newOrder.map(layer => layer.id));
    }
  };

  // レイヤーを下へ移動
  const moveLayerDown = (layerId: string) => {
    const currentIndex = layers.findIndex(layer => layer.id === layerId);
    if (currentIndex < layers.length - 1) {
      const newOrder = [...layers];
      const temp = newOrder[currentIndex];
      newOrder[currentIndex] = newOrder[currentIndex + 1];
      newOrder[currentIndex + 1] = temp;
      reorderLayers(newOrder.map(layer => layer.id));
    }
  };

  // レイヤー設定パネル
  const LayerSettings = ({ layer }: { layer: LayerType }) => {
    const effectTypes: EffectType[] = ['spectrum', 'waveform', 'particles', 'lyrics', 'camera'];

    return (
      <div className="space-y-4 p-3 bg-gray-800 rounded mt-2">
        <div className="grid grid-cols-2 gap-2">
          {effectTypes.map((type) => (
            <Button
              key={type}
              onClick={() => updateLayer(layer.id, { type })}
              isActive={layer.type === type}
              variant={layer.type === type ? 'primary' : 'outline'}
              size="sm"
              fullWidth
            >
              {effectTypeNames[type]}
            </Button>
          ))}
        </div>

        <ColorPicker
          color={layer.colorTheme}
          onChange={(color) => updateLayer(layer.id, { colorTheme: color })}
          label="レイヤーカラー"
        />

        <Slider
          label="不透明度"
          min={0}
          max={1}
          step={0.01}
          value={layer.opacity}
          onChange={(value: number) => updateLayer(layer.id, { opacity: value })}
          valueFormatter={(val: number) => `${Math.round(val * 100)}%`}
        />

        <Slider
          label="感度"
          min={0.1}
          max={2}
          step={0.1}
          value={layer.sensitivity}
          onChange={(value: number) => updateLayer(layer.id, { sensitivity: value })}
          valueFormatter={(val: number) => `${val.toFixed(1)}x`}
        />
      </div>
    );
  };

  // レイヤーリストをzIndexでソート（表示の際は逆順にして、高いものが上に表示）
  const sortedLayers = [...layers].sort((a, b) => b.zIndex - a.zIndex);

  return (
    <div className={`${className}`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-300">レイヤー管理</h3>
        <Button
          onClick={handleAddLayer}
          variant="outline"
          size="sm"
          icon={<FiPlusCircle />}
        >
          追加
        </Button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {sortedLayers.length === 0 ? (
          <p className="text-gray-400 text-sm text-center p-4">
            レイヤーがありません。追加ボタンをクリックしてレイヤーを作成してください。
          </p>
        ) : (
          sortedLayers.map((layer) => (
            <motion.div
              key={layer.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-2 rounded cursor-pointer ${
                activeLayerId === layer.id
                  ? 'bg-gray-700 border-l-2 border-v1z3r-primary'
                  : 'bg-gray-800 hover:bg-gray-700'
              }`}
              onClick={() => setActiveLayer(layer.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLayerVisibility(layer.id, layer.active);
                    }}
                    className={`mr-2 text-lg ${
                      layer.active ? 'text-v1z3r-primary' : 'text-gray-500'
                    }`}
                  >
                    {layer.active ? <FiEye /> : <FiEyeOff />}
                  </button>
                  <div>
                    <div className="flex items-center">
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: layer.colorTheme }}
                      />
                      <span className="text-sm font-medium">
                        {effectTypeNames[layer.type]}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      不透明度: {Math.round(layer.opacity * 100)}%
                    </span>
                  </div>
                </div>

                <div className="flex space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLayerUp(layer.id);
                    }}
                    className="p-1 text-gray-400 hover:text-white"
                    disabled={layers.indexOf(layer) === 0}
                  >
                    <FiArrowUp />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLayerDown(layer.id);
                    }}
                    className="p-1 text-gray-400 hover:text-white"
                    disabled={layers.indexOf(layer) === layers.length - 1}
                  >
                    <FiArrowDown />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveLayer(layer.id);
                    }}
                    className="p-1 text-gray-400 hover:text-v1z3r-error"
                    disabled={layers.length <= 1}
                  >
                    <FiTrash />
                  </button>
                </div>
              </div>

              {activeLayerId === layer.id && <LayerSettings layer={layer} />}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default LayerManager;
