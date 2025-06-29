import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiSettings, FiLayers, FiSave, FiFolder, FiMic, FiVideo, FiMaximize, FiChevronUp, FiChevronDown, FiMusic, FiShare } from 'react-icons/fi';
import { useVisualizerStore, EffectType } from '@/store/visualizerStore';
import Button from './ui/Button';
import Slider from './ui/Slider';
import ColorPicker from './ui/ColorPicker';
import Tabs from './ui/Tabs';
import LayerManager from './LayerManager';
import LyricsControl from './LyricsControl';
import PresetShare, { PresetShareData } from './PresetShare';

interface ControlPanelProps {
  className?: string;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ className = '' }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [activeTab, setActiveTab] = useState('effects');
  const [shareModalData, setShareModalData] = useState<PresetShareData | null>(null);

  // Zustand ストアからステートと関数を取得
  const {
    currentEffectType,
    colorTheme,
    sensitivity,
    isAudioAnalyzing,
    isMicrophoneEnabled,
    isCameraEnabled,
    isFullscreen,
    isLyricsEnabled,
    setEffectType,
    setColorTheme,
    setSensitivity,
    setMicrophoneEnabled,
    toggleCamera,
    toggleFullscreen,
    presets,
    savePreset,
    loadPreset,
    deletePreset,
    setLyricsEnabled
  } = useVisualizerStore();

  // マイクやカメラの権限変更を監視
  useEffect(() => {
    // ブラウザがPermissions APIをサポートしている場合のみ実行
    if (navigator.permissions) {
      // マイクの権限変更を監視
      try {
        navigator.permissions.query({ name: 'microphone' as PermissionName })
          .then((status) => {
            status.onchange = () => {
              if (status.state === 'denied' && isMicrophoneEnabled) {
                setMicrophoneEnabled(false);
              }
            };
          })
          .catch(err => console.warn('マイク権限の確認中にエラー:', err));
      } catch (e) {
        console.warn('マイク権限の確認はこのブラウザでサポートされていません');
      }
    }
  }, [isMicrophoneEnabled, setMicrophoneEnabled]);

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

  // プリセット共有
  const handleSharePreset = (preset: any) => {
    const shareData: PresetShareData = {
      id: preset.id,
      name: preset.name,
      description: `VJ Preset: ${preset.effectType} with ${preset.colorTheme} theme`,
      settings: {
        effectType: preset.effectType,
        colorTheme: preset.colorTheme,
        sensitivity: preset.sensitivity,
        // その他の設定
      },
      shareUrl: `${typeof window !== 'undefined' ? window.location.origin : 'https://v1z3r.app'}/preset?id=${preset.id}`,
      createdBy: 'VJ User', // 実際のユーザー情報に置き換え
    };
    setShareModalData(shareData);
  };

  // タブ変更時のハンドラ
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
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
          <LayerManager />
        </div>
      ),
    },
    {
      id: 'lyrics',
      label: '歌詞',
      icon: <FiMusic className="w-4 h-4" />,
      content: (
        <div className="space-y-4">
          <LyricsControl />
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
                      onClick={() => handleSharePreset(preset)}
                      className="text-xs text-gray-400 hover:text-blue-400"
                      title="共有"
                    >
                      共有
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
      data-testid="control-panel"
      className={`fixed bottom-0 left-0 right-0 bg-v1z3r-darker border-t border-gray-800 transition-all z-50 ${className}`}
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
            onClick={() => setLyricsEnabled(!isLyricsEnabled)}
            variant={isLyricsEnabled ? 'primary' : 'outline'}
            size="sm"
            icon={<FiMusic />}
          >
            歌詞
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
          <Tabs tabs={tabs} onChange={handleTabChange} defaultTabId={activeTab} />
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

      {/* プリセット共有モーダル */}
      {shareModalData && (
        <PresetShare
          preset={shareModalData}
          isOpen={!!shareModalData}
          onClose={() => setShareModalData(null)}
          onShare={(platform) => {
            console.log(`Shared preset ${shareModalData.name} on ${platform}`);
            // 分析のためのトラッキングコードを追加可能
          }}
        />
      )}
    </motion.div>
  );
};

export default ControlPanel;
