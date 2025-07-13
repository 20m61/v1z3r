import React, { useState, useEffect } from 'react';
import { useVisualizerStore, FontType, AnimationType } from '@/store/visualizerStore';
import Button from '@/components/ui/Button';
import Slider from '@/components/ui/Slider';
import ColorPicker from '@/components/ui/ColorPicker';
import { FiType, FiPlayCircle, FiStopCircle, FiRefreshCw, FiInfo } from 'react-icons/fi';

interface LyricsControlProps {
  className?: string;
}

const LyricsControl: React.FC<LyricsControlProps> = ({ className = '' }) => {
  const [speechApiSupported, setSpeechApiSupported] = useState<boolean | null>(null);
  const [showHelpTooltip, setShowHelpTooltip] = useState<boolean>(false);
  
  const {
    isLyricsEnabled,
    setLyricsEnabled,
    lyricsFont,
    setLyricsFont,
    lyricsAnimation,
    setLyricsAnimation, 
    lyricsColor,
    setLyricsColor,
    clearLyricsHistory,
    currentLyrics,
    nextLyrics,
    lyricsHistory,
  } = useVisualizerStore();

  // ブラウザの音声認識APIサポートをチェック
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isSupported = !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition);
      setSpeechApiSupported(isSupported);
      
      // サポートされていない場合は無効化
      if (!isSupported && isLyricsEnabled) {
        setLyricsEnabled(false);
      }
    }
  }, []);

  // フォントオプション
  const fontOptions: { value: FontType; label: string }[] = [
    { value: 'teko', label: 'Teko' },
    { value: 'prompt', label: 'Prompt' },
    { value: 'audiowide', label: 'Audiowide' },
    { value: 'russo', label: 'Russo' },
    { value: 'orbitron', label: 'Orbitron' },
  ];

  // アニメーションオプション
  const animationOptions: { value: AnimationType; label: string }[] = [
    { value: 'glow', label: '光る' },
    { value: 'pulse', label: '鼓動' },
    { value: 'bounce', label: '跳ねる' },
    { value: 'fade', label: 'フェード' },
    { value: 'none', label: 'なし' },
  ];

  // 歌詞認識のオン/オフ切り替え
  const toggleLyricsEnabled = () => {
    if (!speechApiSupported && !isLyricsEnabled) {
      // サポートされていない場合は何もしない
      return;
    }
    setLyricsEnabled(!isLyricsEnabled);
  };

  // 歌詞履歴のクリア
  const handleClearHistory = () => {
    clearLyricsHistory();
  };

  // 手動でフォントをプリロード
  useEffect(() => {
    const preloadFonts = () => {
      // 各フォントファミリーのプリロード用にダミーの要素を作成
      fontOptions.forEach(font => {
        const element = document.createElement('div');
        element.style.fontFamily = font.label;
        element.style.opacity = '0';
        element.style.position = 'absolute';
        element.style.pointerEvents = 'none';
        element.textContent = 'Preload Font';
        document.body.appendChild(element);
        
        // ブラウザがフォントをロードするまで少し待ってから要素を削除
        setTimeout(() => {
          document.body.removeChild(element);
        }, 100);
      });
    };
    
    preloadFonts();
  }, []);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <h3 className="text-sm font-medium text-gray-300">歌詞認識・表示</h3>
          <button 
            className="ml-2 text-gray-400 hover:text-gray-200 p-1 rounded-full focus:outline-none group relative"
            onMouseEnter={() => setShowHelpTooltip(true)}
            onMouseLeave={() => setShowHelpTooltip(false)}
            aria-label="情報"
          >
            <FiInfo size={16} />
            {showHelpTooltip && (
              <div className="absolute z-50 left-full ml-2 top-0 w-64 p-2 bg-gray-800 rounded shadow-lg text-xs text-white">
                {speechApiSupported === false ? (
                  <p>お使いのブラウザは音声認識をサポートしていません。Chrome、Edge、Safariなどの最新ブラウザをお試しください。</p>
                ) : (
                  <p>この機能はマイク入力から歌詞を認識し、リアルタイムで表示します。音楽の音量が大きいと認識精度が下がる場合があります。</p>
                )}
              </div>
            )}
          </button>
        </div>
        <Button
          onClick={toggleLyricsEnabled}
          variant={isLyricsEnabled ? 'primary' : 'outline'}
          size="sm"
          icon={isLyricsEnabled ? <FiStopCircle /> : <FiPlayCircle />}
          disabled={speechApiSupported === false}
        >
          {isLyricsEnabled ? '停止' : '開始'}
        </Button>
      </div>

      {/* ブラウザ非対応の場合のメッセージ */}
      {speechApiSupported === false && (
        <div className="bg-yellow-800 bg-opacity-30 text-yellow-300 p-3 rounded-md text-sm mb-4">
          お使いのブラウザは音声認識（Web Speech API）をサポートしていません。<br />
          Chrome、Edge、Safariなどの最新ブラウザでご利用ください。
        </div>
      )}

      {/* フォント選択 */}
      <div className="space-y-2">
        <label className="text-sm text-gray-300 block">フォントスタイル</label>
        <div className="grid grid-cols-3 gap-2">
          {fontOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setLyricsFont(option.value)}
              className={`px-2 py-1 text-sm rounded-md transition-colors ${
                lyricsFont === option.value
                  ? 'bg-v1z3r-primary bg-opacity-20 border border-v1z3r-primary'
                  : 'bg-gray-800 hover:bg-gray-700'
              } ${option.value === 'teko' ? 'font-teko' : ''}
                ${option.value === 'prompt' ? 'font-prompt' : ''}
                ${option.value === 'audiowide' ? 'font-audiowide' : ''}
                ${option.value === 'russo' ? 'font-russo' : ''}
                ${option.value === 'orbitron' ? 'font-orbitron' : ''}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* アニメーション選択 */}
      <div className="space-y-2">
        <label className="text-sm text-gray-300 block">アニメーション</label>
        <div className="grid grid-cols-3 gap-2">
          {animationOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setLyricsAnimation(option.value)}
              className={`px-2 py-1 text-sm rounded-md transition-colors ${
                lyricsAnimation === option.value
                  ? 'bg-v1z3r-primary bg-opacity-20 border border-v1z3r-primary'
                  : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* カラー選択 */}
      <ColorPicker
        color={lyricsColor}
        onChange={setLyricsColor}
        label="歌詞カラー"
        presetColors={[
          '#ffffff', // 白
          '#00ccff', // 水色
          '#ff3366', // ピンク
          '#ffcc00', // 黄色
          '#66ff99', // 緑
          '#ff9900', // オレンジ
          '#ff66ff', // マゼンタ
          '#00ffcc', // ターコイズ
        ]}
      />

      {/* 歌詞履歴 */}
      {isLyricsEnabled && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-medium text-gray-300">認識履歴</h4>
            <Button
              onClick={handleClearHistory}
              variant="outline"
              size="sm"
              icon={<FiRefreshCw />}
            >
              クリア
            </Button>
          </div>
          
          <div className="bg-gray-800 rounded-md p-2 h-32 overflow-y-auto">
            {lyricsHistory.length > 0 ? (
              <ul className="space-y-1">
                {lyricsHistory.slice(0, 10).map((item) => (
                  <li
                    key={item.id}
                    className="text-sm text-gray-300 border-b border-gray-700 pb-1"
                  >
                    {item.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 text-center">
                歌詞認識履歴がありません
              </p>
            )}
          </div>
        </div>
      )}

      {/* 現在の認識ステータス */}
      {isLyricsEnabled && (
        <div className="bg-gray-800 rounded-md p-2 text-sm">
          <p className="text-gray-300">
            現在の認識: <span className="text-white">{currentLyrics || '（待機中）'}</span>
          </p>
          {nextLyrics && (
            <p className="text-gray-400 mt-1">
              認識中: {nextLyrics}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default LyricsControl;
