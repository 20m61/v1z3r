import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  const [beatDetected, setBeatDetected] = useState<boolean>(false);
  const lastLyricsUpdateRef = useRef<number>(Date.now());
  const audioBufferRef = useRef<number[]>([]);
  const lastBeatTime = useRef<number>(0);
  
  // 音量変化の検出とビートの検出
  const detectBeat = useCallback((currentAudioData: Uint8Array) => {
    if (!currentAudioData || currentAudioData.length === 0) return false;
    
    const now = Date.now();
    const timeSinceLastBeat = now - lastBeatTime.current;
    
    // 前回のビート検出から短すぎる場合は検出しない（フラッタリング防止）
    if (timeSinceLastBeat < 200) {
      return false;
    }
    
    // 低周波数領域のエネルギーを計算（一般的にビートは低周波に現れる）
    const bassRange = 10; // 低音域の範囲（最初のN個のバンド）
    let bassEnergy = 0;
    
    // データの長さに応じて範囲を調整
    const effectiveBassRange = Math.min(bassRange, Math.floor(currentAudioData.length / 5));
    
    for (let i = 0; i < effectiveBassRange; i++) {
      bassEnergy += currentAudioData[i];
    }
    
    // 過去の値と比較するためのバッファ
    audioBufferRef.current.push(bassEnergy);
    if (audioBufferRef.current.length > 20) {
      audioBufferRef.current.shift();
    }
    
    // バッファ内の平均値を計算
    const average = audioBufferRef.current.reduce((a, b) => a + b, 0) / audioBufferRef.current.length;
    
    // 閾値を設定（平均より一定以上高い場合にビートと判定）
    const threshold = average * 1.3;
    
    // 現在の低音エネルギーが閾値を超えた場合、ビートとして検出
    const isBeat = bassEnergy > threshold && bassEnergy > 50; // 最小値を設定
    
    if (isBeat) {
      lastBeatTime.current = now;
    }
    
    return isBeat;
  }, []);
  
  // オーディオデータに応じてアニメーション強度を変更
  useEffect(() => {
    if (!audioData || !audioData.length) return;
    
    // ビート検出
    const isBeat = detectBeat(audioData);
    if (isBeat) {
      setBeatDetected(true);
      
      // 500ms後に状態をリセット
      setTimeout(() => {
        setBeatDetected(false);
      }, 300);
    }
    
    // オーディオデータから平均振幅を計算
    const sum = audioData.reduce((a, b) => a + b, 0);
    const avg = sum / audioData.length;
    
    // 平均値に基づいてアニメーション強度を設定（0.5〜1.5の範囲）
    const newIntensity = 0.5 + Math.min(avg / 200, 1);
    setAnimationIntensity(newIntensity);
    
    // 大きな音量変化があれば、フォントサイズも変更
    const baseFontSize = 6; // 基本サイズ (rem)
    const sizeVariation = Math.min(avg / 150, 2); // 音量に基づく変動量
    setFontSize(baseFontSize * (0.9 + sizeVariation * 0.2));
  }, [audioData, detectBeat]);
  
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
  const getAnimationStyle = (animation: AnimationType) => {
    // ベーススタイル
    const baseStyle: React.CSSProperties & { [key: string]: string | number } = {
      color: lyricsColor,
      opacity: getOpacityFromConfidence(lyricsConfidence),
    };
    
    // CSSカスタムプロパティを追加
    baseStyle['--glow-color'] = `${lyricsColor}80`; // 半透明のカラー（グロー効果用）
    
    // 音量に応じてアニメーション強度を調整
    if (animation === 'glow' || animation === 'bounce') {
      baseStyle.animationDuration = `${2 / animationIntensity}s`;
    }
    
    if (animation === 'pulse' || animation === 'bounce') {
      baseStyle.animationDuration = `${1.5 / animationIntensity}s`;
    }
    
    // ビート検出時に一時的なスケール効果を追加
    if (beatDetected) {
      baseStyle.transform = 'scale(1.05)';
      baseStyle.transition = 'transform 0.2s ease-out';
    } else {
      baseStyle.transform = 'scale(1)';
      baseStyle.transition = 'transform 0.3s ease-in-out';
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
