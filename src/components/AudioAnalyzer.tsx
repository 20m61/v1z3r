import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useVisualizerStore } from '@/store/visualizerStore';
import Button from './ui/Button';
import { validateAudioData, ValidationError } from '@/utils/validation';
import { globalRateLimiters } from '@/utils/rateLimiter';
import { getReusableAudioBuffer, returnAudioBuffer } from '@/utils/memoryManager';

interface AudioAnalyzerProps {
  onAudioData?: (data: Uint8Array) => void;
}

const AudioAnalyzer: React.FC<AudioAnalyzerProps> = ({ onAudioData }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  
  const { isMicrophoneEnabled, setMicrophoneEnabled } = useVisualizerStore();

  // オーディオ解析を開始
  const startAnalyzing = useCallback(async () => {
    try {
      // ブラウザがWeb Audio APIをサポートしているか確認
      if (!window.AudioContext && !(window as any).webkitAudioContext) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Web Audio APIはこのブラウザでサポートされていません');
        }
        setError('Web Audio APIはこのブラウザでサポートされていません');
        return;
      }

      // iOS Safari対応: ユーザージェスチャー後のみAudioContext作成
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      // マイクへのアクセスを要求（iOS制限を考慮）
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: false, // iOS最適化
            noiseSuppression: false,
            autoGainControl: false
          } 
        });
      } catch (micError) {
        // Silent fallback on mobile - this is expected behavior
        if (process.env.NODE_ENV === 'development') {
          console.warn('マイクアクセスに失敗、デモモードで継続:', micError);
        }
        setError('マイクアクセスが拒否されました。視覚エフェクトはデモモードで動作します。');
        return;
      }
      
      // AudioContextの作成（iOS Safari対応）
      audioContextRef.current = new AudioContextClass();
      const audioContext = audioContextRef.current;
      
      // iOS Safari: AudioContextの状態確認と再開
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      // アナライザーノードの作成
      analyserRef.current = audioContext.createAnalyser();
      const analyser = analyserRef.current;
      analyser.fftSize = 1024; // iOS最適化: より小さなFFTサイズ
      
      // マイク入力のソースノードを作成
      sourceRef.current = audioContext.createMediaStreamSource(stream);
      const source = sourceRef.current;
      
      // ソースをアナライザーに接続
      source.connect(analyser);
      
      setIsAnalyzing(true);
      setMicrophoneEnabled(true);
      setError(null);
      
      // Get reusable audio buffer for analysis data
      const dataArray = getReusableAudioBuffer(analyser.frequencyBinCount);
      dataArrayRef.current = dataArray;
      
      const updateData = () => {
        if (!analyser) return;
        
        try {
          analyser.getByteFrequencyData(dataArray);
          
          // Rate limit audio data updates
          const clientId = 'audio-analyzer'; // Could be user-specific in a multi-user context
          if (!globalRateLimiters.audioData.isAllowed(clientId)) {
            // Skip this frame if rate limited
            animationFrameRef.current = requestAnimationFrame(updateData);
            return;
          }
          
          // Validate audio data before passing to callback
          try {
            const validatedData = validateAudioData(dataArray);
            if (onAudioData) {
              onAudioData(validatedData);
            }
            globalRateLimiters.audioData.recordSuccess(clientId);
          } catch (validationError) {
            if (validationError instanceof ValidationError) {
              if (process.env.NODE_ENV === 'development') {
                console.warn('Audio data validation failed:', validationError.message);
              }
              globalRateLimiters.audioData.recordFailure(clientId);
              // Continue with animation loop but don't pass invalid data
            } else {
              throw validationError;
            }
          }
          
          animationFrameRef.current = requestAnimationFrame(updateData);
        } catch (err) {
          console.error('オーディオデータの取得中にエラーが発生しました:', err);
          stopAnalyzing();
        }
      };
      
      updateData();
    } catch (error) {
      const errorMessage = 'オーディオの解析中にエラーが発生しました';
      // エラーハンドラを使用してログ記録
      const { errorHandler } = await import('@/utils/errorHandler');
      errorHandler.audioError(errorMessage, error instanceof Error ? error : new Error(String(error)), {
        isAnalyzing,
        isMicrophoneEnabled,
        timestamp: new Date().toISOString()
      });
      
      setError('マイクへのアクセスが拒否されたか、エラーが発生しました。');
      setIsAnalyzing(false);
      setMicrophoneEnabled(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAudioData, setMicrophoneEnabled]);

  // オーディオ解析を停止
  const stopAnalyzing = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('AudioContextのクローズ中にエラーが発生しました:', e);
        }
      }
      audioContextRef.current = null;
    }

    // Return the audio buffer to the pool for reuse
    if (dataArrayRef.current) {
      returnAudioBuffer(dataArrayRef.current);
      dataArrayRef.current = null;
    }
    
    setIsAnalyzing(false);
    setMicrophoneEnabled(false);
  }, [setMicrophoneEnabled]);

  // コンポーネントマウント時に自動的に解析を開始
  useEffect(() => {
    // ユーザーによるマイク有効化設定を監視
    if (isMicrophoneEnabled && !isAnalyzing) {
      startAnalyzing();
    } else if (!isMicrophoneEnabled && isAnalyzing) {
      stopAnalyzing();
    }

    // コンポーネントのアンマウント時にリソースを解放
    return () => {
      stopAnalyzing();
    };
  }, [isMicrophoneEnabled, isAnalyzing, startAnalyzing, stopAnalyzing]);

  // エラーメッセージを表示
  if (error) {
    return (
      <div className="p-4 bg-red-500 bg-opacity-20 text-red-200 rounded mb-4" data-testid="error-message">
        <p className="font-medium">エラー:</p>
        <p>{error}</p>
        <Button 
          onClick={() => { setError(null); startAnalyzing(); }}
          className="mt-2"
          variant="outline"
          size="sm"
        >
          再試行
        </Button>
      </div>
    );
  }

  // UI表示なし（バックグラウンドで動作）
  return null;
};

export default AudioAnalyzer;
