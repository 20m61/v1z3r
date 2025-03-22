import { useEffect, useRef, useState } from 'react';

interface AudioAnalyzerProps {
  onAudioData?: (data: Uint8Array) => void;
}

const AudioAnalyzer: React.FC<AudioAnalyzerProps> = ({ onAudioData }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // オーディオ解析を開始
  const startAnalyzing = async () => {
    try {
      // ブラウザがWeb Audio APIをサポートしているか確認
      if (!window.AudioContext) {
        console.error('Web Audio APIはこのブラウザでサポートされていません');
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
      
      // 解析データの取得を開始
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateData = () => {
        analyser.getByteFrequencyData(dataArray);
        if (onAudioData) {
          onAudioData(dataArray);
        }
        animationFrameRef.current = requestAnimationFrame(updateData);
      };
      
      updateData();
    } catch (error) {
      console.error('オーディオの解析中にエラーが発生しました:', error);
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
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsAnalyzing(false);
  };

  // コンポーネントのアンマウント時にリソースを解放
  useEffect(() => {
    return () => {
      stopAnalyzing();
    };
  }, []);

  return (
    <div>
      {!isAnalyzing ? (
        <button onClick={startAnalyzing}>マイク解析を開始</button>
      ) : (
        <button onClick={stopAnalyzing}>解析を停止</button>
      )}
    </div>
  );
};

export default AudioAnalyzer;
