import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiSettings, FiLayers, FiSave, FiFolder, FiMic, FiVideo, FiMaximize, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { useVisualizerStore, EffectType } from '@/store/visualizerStore';
import Button from './ui/Button';
import Slider from './ui/Slider';
import ColorPicker from './ui/ColorPicker';
import Tabs from './ui/Tabs';

interface ControlPanelProps {
  className?: string;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ className = '' }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // Zustand ストアからステートと関数を取得
  const {
    currentEffectType,
    colorTheme,
    sensitivity,
    isAudioAnalyzing,
    isMicrophoneEnabled,
    isCameraEnabled,
    isFullscreen,
    setEffectType,
    setColorTheme,
    setSensitivity,
    setMicrophoneEnabled,
    toggleCamera,
    toggleFullscreen,
    presets,
    savePreset,
    loadPreset,
    deletePreset
  } = useVisualizerStore();

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleEffectChange = (type: EffectType) => {
    setEffectType(type);
  };

  const handleSavePreset = () => {
    if (newPresetName.trim()) {
      savePreset(newPresetName);
      setNewPresetName('');
      setShowPresetModal(false);
    }
  };

  // 効果タイプのオプション
  const effectOptions = [
    { value: 'spectrum', label: 'スペクトラム' },
    { value: 'waveform', label: '波形' },
    { value: 'particles', label: 'パーティクル' },
    { value: 'lyrics', label: '歌詞表示' },
    { value: 'camera', label: 'カメラ' },
  ];

  const tabs = [
    {
      id: 'effects',
      label: 'エフェクト',
      icon: <FiSettings className="w-4 h-4" />,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {effectOptions.map((option) => (
              <Button
                key={option.value}
                onClick={() => handleEffectChange(option.value as EffectType)}
                isActive={currentEffectType === option.value}
                variant={currentEffectType === option.value ? 'primary' : 'outline'}
                size="sm"
                fullWidth
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="space-y-4">
            <ColorPicker
              color={colorTheme}
              onChange={setColorTheme}
              label="カラーテーマ"
            />

            <Slider
              label="感度"
              min={0.1}
              max={2}
              step={0.1}
              value={sensitivity}
              onChange={setSensitivity}
              valueFormatter={(val) => `${val.toFixed(1)}x`}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'layers',
      label: 'レイヤー',
      icon: <FiLayers className="w-4 h-4" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">レイヤーの管理機能は開発中です</p>
          {/* レイヤー管理UIをここに追加予定 */}
        </div>
      ),
    },
    {
      id: 'presets',
      label: 'プリセット',
      icon: <FiSave className="w-4 h-4" />,
      content: (
        <div className="space-y-4">
          <div className="flex justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-300">保存したプリセット</h3>
            <Button
              onClick={() => setShowPresetModal(true)}
              variant="outline"
              size="sm"
            >
              保存
            </Button>
          </div>

          {presets.length === 0 ? (
            <p className="text-gray-400 text-sm">保存されたプリセットはありません</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center justify-between p-2 bg-gray-800 rounded"
                >
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: preset.colorTheme }}
                    />
                    <span className="text-sm">{preset.name}</span>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => loadPreset(preset.id)}
                      className="text-xs text-gray-400 hover:text-v1z3r-primary"
                    >
                      読込
                    </button>
                    <button
                      onClick={() => deletePreset(preset.id)}
                      className="text-xs text-gray-400 hover:text-v1z3r-error"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <motion.div
      className={`fixed bottom-0 left-0 right-0 bg-v1z3r-darker border-t border-gray-800 transition-all ${className}`}
      animate={{ height: isCollapsed ? '40px' : 'auto' }}
      initial={false}
    >
      <div className="flex justify-between items-center p-2 border-b border-gray-800">
        <div className="flex space-x-2">
          <Button
            onClick={() => setMicrophoneEnabled(!isMicrophoneEnabled)}
            variant={isMicrophoneEnabled ? 'primary' : 'outline'}
            size="sm"
            icon={<FiMic />}
          >
            マイク
          </Button>
          <Button
            onClick={toggleCamera}
            variant={isCameraEnabled ? 'primary' : 'outline'}
            size="sm"
            icon={<FiVideo />}
          >
            カメラ
          </Button>
          <Button
            onClick={toggleFullscreen}
            variant="outline"
            size="sm"
            icon={<FiMaximize />}
          >
            全画面
          </Button>
        </div>
        <button
          onClick={toggleCollapse}
          className="p-1 text-gray-400 hover:text-white transition-colors"
          aria-label={isCollapsed ? 'パネルを開く' : 'パネルを閉じる'}
        >
          {isCollapsed ? <FiChevronUp /> : <FiChevronDown />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="p-4">
          <Tabs tabs={tabs} />
        </div>
      )}

      {/* プリセット保存モーダル */}
      {showPresetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-v1z3r-darker p-4 rounded-lg w-80">
            <h3 className="font-medium mb-4">プリセットを保存</h3>
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="プリセット名"
              className="w-full p-2 mb-4 bg-gray-800 border border-gray-700 rounded"
            />
            <div className="flex justify-end space-x-2">
              <Button
                onClick={() => setShowPresetModal(false)}
                variant="outline"
                size="sm"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleSavePreset}
                variant="primary"
                size="sm"
                disabled={!newPresetName.trim()}
              >
                保存
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ControlPanel;
