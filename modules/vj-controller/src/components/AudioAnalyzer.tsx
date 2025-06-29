import React, { useEffect, useRef, useState } from 'react';
import { useVisualizerStore } from '@/store/visualizerStore';
import Button from './ui/Button';

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
  
  const { isMicrophoneEnabled, setMicrophoneEnabled } = useVisualizerStore();

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
  }, [isMicrophoneEnabled]);

  // オーディオ解析を開始
  const startAnalyzing = async () => {
    try {
      // ブラウザがWeb Audio APIをサポートしているか確認
      if (!window.AudioContext) {
        console.error('Web Audio APIはこのブラウザでサポートされていません');
        setError('Web Audio APIはこのブラウザでサポートされていません');
        return;
      }

      // マイクへのアクセスを要求
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // AudioContextの作成
      audioContextRef.current = new AudioContext();
      const audioContext = audioContextRef.current;
      
      // アナライザーノードの作成
      analyserRef.current = audioContext.createAnalyser();
      const analyser = analyserRef.current;
      analyser.fftSize = 2048;
      
      // マイク入力のソースノードを作成
      sourceRef.current = audioContext.createMediaStreamSource(stream);
      const source = sourceRef.current;
      
      // ソースをアナライザーに接続
      source.connect(analyser);
      
      setIsAnalyzing(true);
      setMicrophoneEnabled(true);
      setError(null);
      
      // 解析データの取得を開始
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateData = () => {
        if (!analyser) return;
        
        try {
          analyser.getByteFrequencyData(dataArray);
          if (onAudioData) {
            onAudioData(dataArray);
          }
          animationFrameRef.current = requestAnimationFrame(updateData);
        } catch (err) {
          console.error('オーディオデータの取得中にエラーが発生しました:', err);
          stopAnalyzing();
        }
      };
      
      updateData();
    } catch (error) {
      console.error('オーディオの解析中にエラーが発生しました:', error);
      setError('マイクへのアクセスが拒否されたか、エラーが発生しました。');
      setIsAnalyzing(false);
      setMicrophoneEnabled(false);
    }
  };

  // オーディオ解析を停止
  const stopAnalyzing = () => {
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
        console.warn('AudioContextのクローズ中にエラーが発生しました:', e);
      }
      audioContextRef.current = null;
    }
    
    setIsAnalyzing(false);
    setMicrophoneEnabled(false);
  };

  // エラーメッセージを表示
  if (error) {
    return (
      <div className="p-4 bg-red-500 bg-opacity-20 text-red-200 rounded mb-4">
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
