import React, { useEffect, useRef } from 'react';
import styles from '@/styles/VisualEffects.module.css';
import { EffectType } from '@/store/visualizerStore';

interface VisualEffectsProps {
  audioData?: Uint8Array;
  effectType: EffectType;
  colorTheme: string;
}

const VisualEffects: React.FC<VisualEffectsProps> = ({
  audioData,
  effectType = 'spectrum',
  colorTheme = '#00ccff'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };

    resize();
    window.addEventListener('resize', resize);

    // アニメーションの更新関数
    const draw = () => {
      if (!ctx || !canvas) return;
      
      // キャンバスをクリア
      ctx.fillStyle = '#121212';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // オーディオデータがある場合のみ描画
      if (audioData && audioData.length > 0) {
        // effectTypeに応じた描画処理
        switch (effectType) {
          case 'waveform':
            drawWaveform(ctx, canvas, audioData, colorTheme);
            break;
          case 'particles':
            drawParticles(ctx, canvas, audioData, colorTheme);
            break;
          case 'spectrum':
          default:
            drawSpectrum(ctx, canvas, audioData, colorTheme);
            break;
        }
      } else {
        // デモ表示
        drawDemo(ctx, canvas, colorTheme);
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioData, effectType, colorTheme]);

  // 周波数スペクトラムの描画
  const drawSpectrum = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    data: Uint8Array,
    color: string
  ) => {
    const barWidth = canvas.width / data.length;
    const heightScale = canvas.height / 256;

    ctx.fillStyle = color;
    
    for (let i = 0; i < data.length; i++) {
      const barHeight = data[i] * heightScale;
      const x = i * barWidth;
      const y = canvas.height - barHeight;
      
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    }
  };

  // 波形の描画
  const drawWaveform = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    data: Uint8Array,
    color: string
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sliceWidth = canvas.width / data.length;
    let x = 0;

    for (let i = 0; i < data.length; i++) {
      const v = data[i] / 128.0;
      const y = v * canvas.height / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  };

  // パーティクルの描画
  const drawParticles = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    data: Uint8Array,
    color: string
  ) => {
    // 簡易的なパーティクル表示
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // 周波数帯域を均等に分割してサンプリング
    const sampleSize = 32;
    const step = Math.floor(data.length / sampleSize);
    
    for (let i = 0; i < sampleSize; i++) {
      const dataIndex = i * step;
      const value = data[dataIndex];
      
      // パーティクルのサイズと距離を音量に基づいて計算
      const size = value / 10;
      const distance = (value / 256) * Math.min(canvas.width, canvas.height) / 2;
      
      // 円周上の位置を計算
      const angle = (i / sampleSize) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      
      // パーティクルを描画
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  };

  // デモ表示（オーディオデータがない場合）
  const drawDemo = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    color: string
  ) => {
    const time = Date.now() / 1000;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 4;
    
    // 波打つ円を描画
    ctx.beginPath();
    for (let angle = 0; angle < Math.PI * 2; angle += 0.01) {
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
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  // effectTypeが'lyrics'または'camera'の場合は何も描画しない
  if (effectType === 'lyrics' || effectType === 'camera') {
    return null;
  }

  return <canvas ref={canvasRef} className={styles.canvas} />;
};

export default VisualEffects;
