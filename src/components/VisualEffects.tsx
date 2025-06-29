import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import styles from '@/styles/VisualEffects.module.css';
import { EffectType } from '@/store/visualizerStore';
import { startMeasure, endMeasure, throttle } from '@/utils/performance';

interface VisualEffectsProps {
  audioData?: Uint8Array;
  effectType: EffectType;
  colorTheme: string;
  quality?: 'low' | 'medium' | 'high';
}

// オフスクリーンキャンバスの作成（Worker対応ブラウザのみ）
const createOffscreenCanvas = (width: number, height: number): HTMLCanvasElement | OffscreenCanvas => {
  if (typeof window !== 'undefined' && 'OffscreenCanvas' in window) {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

// パフォーマンス最適化のためにコンポーネントをメモ化
const VisualEffects: React.FC<VisualEffectsProps> = memo(({
  audioData,
  effectType = 'spectrum',
  colorTheme = '#00ccff',
  quality = 'medium'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | OffscreenCanvas | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastRenderTimeRef = useRef<number>(0);
  const [fps, setFps] = useState<number>(60);
  const fpsCounterRef = useRef<{ frames: number, lastUpdate: number }>({ frames: 0, lastUpdate: 0 });

  // quality設定に基づいてレンダリング設定を決定
  const renderConfig = useMemo(() => {
    const config = {
      particleCount: 32,
      smoothing: true,
      antialiasing: true,
      resolution: 1,
      targetFps: 60,
    };

    switch (quality) {
      case 'low':
        config.particleCount = 16;
        config.smoothing = false;
        config.antialiasing = false;
        config.resolution = 0.75;
        config.targetFps = 30;
        break;
      case 'high':
        config.particleCount = 64;
        config.resolution = 1.25;
        break;
      default: // medium
        break;
    }

    return config;
  }, [quality]);

  // FPS計測
  const updateFpsCounter = useCallback(() => {
    const now = performance.now();
    fpsCounterRef.current.frames++;
    
    if (now - fpsCounterRef.current.lastUpdate >= 1000) {
      setFps(fpsCounterRef.current.frames);
      fpsCounterRef.current.frames = 0;
      fpsCounterRef.current.lastUpdate = now;
    }
  }, []);

  // キャンバスのリサイズ（スロットリング適用）
  const handleResize = useCallback(throttle(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const { width, height } = canvas.getBoundingClientRect();
    
    // 解像度設定に基づいてスケーリング
    const scaledWidth = width * renderConfig.resolution;
    const scaledHeight = height * renderConfig.resolution;
    
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    
    // オフスクリーンキャンバスのリサイズ
    if (offscreenCanvasRef.current) {
      if (offscreenCanvasRef.current instanceof OffscreenCanvas) {
        offscreenCanvasRef.current.width = scaledWidth;
        offscreenCanvasRef.current.height = scaledHeight;
      } else {
        offscreenCanvasRef.current.width = scaledWidth;
        offscreenCanvasRef.current.height = scaledHeight;
      }
    }
  }, 200), [renderConfig.resolution]);

  // 周波数スペクトラムの描画（メモ化）
  const drawSpectrum = useCallback((
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    canvas: HTMLCanvasElement | OffscreenCanvas,
    data: Uint8Array,
    color: string
  ) => {
    startMeasure('drawSpectrum');
    
    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // スムージング設定
    if (ctx.imageSmoothingEnabled !== undefined) {
      ctx.imageSmoothingEnabled = renderConfig.smoothing;
    }
    
    const barWidth = canvas.width / data.length;
    const heightScale = canvas.height / 256;

    ctx.fillStyle = color;
    
    // 描画の最適化: バーが細すぎる場合は結合
    let skipFactor = 1;
    if (barWidth < 2 && data.length > 256) {
      skipFactor = Math.ceil(2 / barWidth);
    }
    
    for (let i = 0; i < data.length; i += skipFactor) {
      // 複数データポイントの平均を取る
      let sum = 0;
      for (let j = 0; j < skipFactor && i + j < data.length; j++) {
        sum += data[i + j];
      }
      const avgValue = sum / skipFactor;
      
      const barHeight = avgValue * heightScale;
      const x = (i / skipFactor) * barWidth * skipFactor;
      const y = canvas.height - barHeight;
      
      // 高速化: 小さなバーはまとめて描画
      if (barWidth * skipFactor <= 1) {
        // 線として描画
        ctx.fillRect(x, y, barWidth * skipFactor, barHeight);
      } else {
        // 通常のバーとして描画（間隔あり）
        ctx.fillRect(x, y, barWidth * skipFactor - 1, barHeight);
      }
    }
    
    endMeasure('drawSpectrum');
  }, [renderConfig.smoothing]);

  // 波形の描画（メモ化）
  const drawWaveform = useCallback((
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    canvas: HTMLCanvasElement | OffscreenCanvas,
    data: Uint8Array,
    color: string
  ) => {
    startMeasure('drawWaveform');
    
    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * renderConfig.resolution;
    ctx.beginPath();

    // 波形描画の最適化: データ間引き
    const skipFactor = data.length > 512 ? Math.floor(data.length / 512) : 1;
    const sliceWidth = canvas.width / (data.length / skipFactor);
    
    let x = 0;
    for (let i = 0; i < data.length; i += skipFactor) {
      const v = data[i] / 128.0;
      const y = v * canvas.height / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    // アンチエイリアシング設定
    if (ctx.imageSmoothingEnabled !== undefined) {
      ctx.imageSmoothingEnabled = renderConfig.antialiasing;
    }
    
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    
    endMeasure('drawWaveform');
  }, [renderConfig.resolution, renderConfig.antialiasing]);

  // パーティクルの描画（メモ化）
  const drawParticles = useCallback((
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    canvas: HTMLCanvasElement | OffscreenCanvas,
    data: Uint8Array,
    color: string
  ) => {
    startMeasure('drawParticles');
    
    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // スムージング設定
    if (ctx.imageSmoothingEnabled !== undefined) {
      ctx.imageSmoothingEnabled = renderConfig.antialiasing;
    }
    
    // 簡易的なパーティクル表示
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // 周波数帯域を均等に分割してサンプリング（パーティクル数に応じて調整）
    const sampleSize = renderConfig.particleCount;
    const step = Math.floor(data.length / sampleSize);
    
    // パーティクルをバッチ処理で描画
    ctx.fillStyle = color;
    
    for (let i = 0; i < sampleSize; i++) {
      const dataIndex = i * step;
      const value = dataIndex < data.length ? data[dataIndex] : 0;
      
      // パーティクルのサイズと距離を音量に基づいて計算
      const size = value / 10 * renderConfig.resolution;
      const distance = (value / 256) * Math.min(canvas.width, canvas.height) / 2;
      
      // 円周上の位置を計算
      const angle = (i / sampleSize) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      
      // パーティクルを描画
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    endMeasure('drawParticles');
  }, [renderConfig.antialiasing, renderConfig.particleCount, renderConfig.resolution]);

  // デモ表示（メモ化）
  const drawDemo = useCallback((
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    canvas: HTMLCanvasElement | OffscreenCanvas,
    color: string
  ) => {
    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const time = performance.now() / 1000;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 4;
    
    // 波打つ円を描画
    ctx.beginPath();
    
    // 解像度に応じて円の滑らかさを調整
    const stepSize = renderConfig.antialiasing ? 0.01 : 0.05;
    
    for (let angle = 0; angle < Math.PI * 2; angle += stepSize) {
      const xOffset = Math.cos(angle);
      const yOffset = Math.sin(angle);
      const r = radius * (1 + 0.2 * Math.sin(angle * 6 + time * 2));
      
      const x = centerX + xOffset * r;
      const y = centerY + yOffset * r;
      
      if (angle === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    // アンチエイリアシング設定
    if (ctx.imageSmoothingEnabled !== undefined) {
      ctx.imageSmoothingEnabled = renderConfig.antialiasing;
    }
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * renderConfig.resolution;
    ctx.stroke();
  }, [renderConfig.antialiasing, renderConfig.resolution]);

  // メインのレンダリングループ
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const offscreenCanvas = offscreenCanvasRef.current;
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const offscreenCtx = offscreenCanvas ? 
      (offscreenCanvas instanceof OffscreenCanvas ? 
        offscreenCanvas.getContext('2d') : 
        offscreenCanvas.getContext('2d')
      ) : null;
      
    if (!ctx || !offscreenCtx) return;
    
    // FPS制限のための時間計測
    const now = performance.now();
    const elapsed = now - lastRenderTimeRef.current;
    const frameInterval = 1000 / renderConfig.targetFps;
    
    // 目標FPS以上の頻度ではレンダリングしない
    if (elapsed < frameInterval) {
      animationFrameRef.current = requestAnimationFrame(renderFrame);
      return;
    }
    
    startMeasure('fullRenderCycle');
    
    // FPS計測更新
    updateFpsCounter();
    
    // オーディオデータに基づく描画
    if (audioData && audioData.length > 0 && offscreenCanvas && offscreenCtx) {
      // オフスクリーンキャンバスに描画
      switch (effectType) {
        case 'waveform':
          drawWaveform(offscreenCtx, offscreenCanvas, audioData, colorTheme);
          break;
        case 'particles':
          drawParticles(offscreenCtx, offscreenCanvas, audioData, colorTheme);
          break;
        case 'spectrum':
        default:
          drawSpectrum(offscreenCtx, offscreenCanvas, audioData, colorTheme);
          break;
      }
    } else if (offscreenCanvas && offscreenCtx) {
      // データがない場合はデモ表示
      drawDemo(offscreenCtx, offscreenCanvas, colorTheme);
    }
    
    // オフスクリーンキャンバスをメインキャンバスにコピー
    if (offscreenCanvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(offscreenCanvas, 0, 0, canvas.width, canvas.height);
    }
    
    endMeasure('fullRenderCycle');
    
    // 次のフレームの準備
    lastRenderTimeRef.current = now;
    animationFrameRef.current = requestAnimationFrame(renderFrame);
  }, [audioData, effectType, colorTheme, renderConfig.targetFps, drawSpectrum, drawWaveform, drawParticles, drawDemo, updateFpsCounter]);

  // コンポーネントのマウント/アンマウント処理
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // オフスクリーンキャンバスの初期化
    offscreenCanvasRef.current = createOffscreenCanvas(canvas.width, canvas.height);
    
    // 初期化
    handleResize();
    window.addEventListener('resize', handleResize);
    
    // FPSカウンター初期化
    fpsCounterRef.current = { frames: 0, lastUpdate: performance.now() };
    
    // レンダリング開始
    lastRenderTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(renderFrame);
    
    // クリーンアップ
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [handleResize, renderFrame]);

  // effectTypeが'lyrics'または'camera'の場合は何も描画しない
  if (effectType === 'lyrics' || effectType === 'camera') {
    return null;
  }

  return (
    <div className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}, (prevProps, nextProps) => {
  // 最適化: 必要な場合のみ再レンダリング
  if (prevProps.effectType !== nextProps.effectType) return false;
  if (prevProps.colorTheme !== nextProps.colorTheme) return false;
  if (prevProps.quality !== nextProps.quality) return false;
  
  // audioDataは参照ではなくコンテンツで比較
  if (prevProps.audioData && nextProps.audioData) {
    // データサイズが変わった場合は再レンダリング
    if (prevProps.audioData.length !== nextProps.audioData.length) {
      return false;
    }
    
    // サンプリングしてデータの変化を検出（すべての値をチェックするのは非効率）
    const sampleSize = Math.min(prevProps.audioData.length, 10);
    const sampleStep = Math.floor(prevProps.audioData.length / sampleSize);
    
    for (let i = 0; i < sampleSize; i++) {
      const index = i * sampleStep;
      if (Math.abs(prevProps.audioData[index] - nextProps.audioData[index]) > 5) {
        return false;
      }
    }
    
    // データに大きな変化がなければ再レンダリングしない
    return true;
  }
  
  // データの有無が変わった場合は再レンダリング
  return !!prevProps.audioData === !!nextProps.audioData;
});

export default VisualEffects;
