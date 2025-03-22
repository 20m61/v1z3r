import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVisualizerStore, FontType, AnimationType } from '@/store/visualizerStore';

interface LyricsVisualizerProps {
  audioData?: Uint8Array;
  className?: string;
}

const LyricsVisualizer: React.FC<LyricsVisualizerProps> = ({ audioData, className = '' }) => {
  const {
    isLyricsEnabled,
    currentLyrics,
    nextLyrics,
    lyricsFont,
    lyricsAnimation,
    lyricsColor,
    lyricsConfidence,
  } = useVisualizerStore();

  const [previousLyrics, setPreviousLyrics] = useState<string>('');
  const [fontSize, setFontSize] = useState<number>(6); // rem単位
  const [animationIntensity, setAnimationIntensity] = useState<number>(1);
  const lastLyricsUpdateRef = useRef<number>(Date.now());
  
  // オーディオデータに応じてアニメーション強度を変更
  useEffect(() => {
    if (!audioData || !audioData.length) return;
    
    // オーディオデータからピーク値を取得
    const sum = audioData.reduce((a, b) => a + b, 0);
    const avg = sum / audioData.length;
    
    // 平均値に基づいてアニメーション強度を設定（0.5〜1.5の範囲）
    const newIntensity = 0.5 + Math.min(avg / 200, 1);
    setAnimationIntensity(newIntensity);
    
    // 大きな音量変化があれば、フォントサイズも変更
    const baseFontSize = 6; // 基本サイズ (rem)
    const sizeVariation = Math.min(avg / 150, 2); // 音量に基づく変動量
    setFontSize(baseFontSize * (0.9 + sizeVariation * 0.2));
  }, [audioData]);
  
  // 歌詞更新時の処理
  useEffect(() => {
    if (currentLyrics !== previousLyrics && currentLyrics.trim()) {
      setPreviousLyrics(currentLyrics);
      lastLyricsUpdateRef.current = Date.now();
    }
  }, [currentLyrics, previousLyrics]);

  // フォントクラスの設定
  const getFontClass = (font: FontType): string => {
    switch (font) {
      case 'teko': return 'font-teko';
      case 'prompt': return 'font-prompt';
      case 'audiowide': return 'font-audiowide';
      case 'russo': return 'font-russo';
      case 'orbitron': return 'font-orbitron';
      default: return 'font-teko';
    }
  };

  // アニメーションクラスの設定
  const getAnimationClass = (animation: AnimationType): string => {
    switch (animation) {
      case 'glow': return 'lyrics-glow';
      case 'pulse': return 'lyrics-pulse';
      case 'bounce': return 'lyrics-pulse lyrics-glow';
      case 'fade': return '';
      case 'none': return '';
      default: return 'lyrics-glow';
    }
  };

  // 信頼度に基づく不透明度の設定
  const getOpacityFromConfidence = (confidence: number): number => {
    // 信頼度に応じて0.7〜1.0の範囲で不透明度を調整
    return 0.7 + (confidence * 0.3);
  };

  // カスタムアニメーションスタイルの計算
  const getAnimationStyle = (animation: AnimationType): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      // カラーテーマを反映
      '--glow-color': `${lyricsColor}80`, // 半透明のカラー（グロー効果用）
      color: lyricsColor,
      opacity: getOpacityFromConfidence(lyricsConfidence),
    };
    
    // 音量に応じてアニメーション強度を調整
    if (animation === 'glow' || animation === 'bounce') {
      baseStyle.animationDuration = `${2 / animationIntensity}s`;
    }
    
    if (animation === 'pulse' || animation === 'bounce') {
      baseStyle.animationDuration = `${1.5 / animationIntensity}s`;
    }
    
    return baseStyle;
  };

  // 歌詞が有効でない場合は何も表示しない
  if (!isLyricsEnabled) return null;

  return (
    <div className={`lyrics-container ${className}`}>
      <div className="lyrics-text">
        <AnimatePresence mode="wait">
          {currentLyrics && (
            <motion.div
              key={currentLyrics}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              style={{ fontSize: `${fontSize}rem`, ...getAnimationStyle(lyricsAnimation) }}
              className={`lyrics-current ${getFontClass(lyricsFont)} ${getAnimationClass(lyricsAnimation)}`}
            >
              {currentLyrics}
            </motion.div>
          )}
        </AnimatePresence>

        {nextLyrics && nextLyrics !== currentLyrics && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            className={`lyrics-next ${getFontClass(lyricsFont)}`}
            style={{ color: lyricsColor }}
          >
            {nextLyrics}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default LyricsVisualizer;
